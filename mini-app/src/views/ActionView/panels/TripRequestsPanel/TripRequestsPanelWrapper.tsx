// mini-app/src/views/ActionView/panels/TripRequestsPanel/TripRequestsPanelWrapper.tsx
import { type FC, useCallback, useMemo } from "react";
import { Box, Button, Panel, PanelHeaderBack, ScreenSpinner } from "@vkontakte/vkui";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { EmptyState } from "@/components/EmptyState";
import { useParams, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { TripRequestsPanel } from "@/views/ActionView/panels/TripRequestsPanel/TripRequestsPanel";
import { useTripDetailQuery } from "@/queries/useTripsQuery";
import {
  useTripBookingsQuery,
  useUpdateBookingStatusMutation,
} from "@/queries/useBookingsQuery";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { DriverBookingAction } from "@edem/contracts";
import { triggerHaptic } from "@/helpers/bridge";

export const TripRequestsPanelWrapper: FC<{ id: string }> = ({ id }) => {
  const params = useParams<"tripId">();
  const routeNavigator = useRouteNavigator();

  const tripId = params?.tripId;

  const {
    data: trip,
    isLoading: isTripLoading,
    isError: isTripError,
    refetch: refetchTrip,
  } = useTripDetailQuery(tripId ?? "");
  const currentUser = useCurrentUser();

  // Заявки видит только водитель поездки (driver-only эндпоинт, иначе 403).
  const isOwnTrip = !!currentUser && !!trip && trip.driver.id === currentUser.id;

  const {
    data: bookingsData,
    isLoading,
    isFetching,
    isError,
    refetch: refetchBookings,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTripBookingsQuery(tripId ?? "", { enabled: isOwnTrip });

  const updateBooking = useUpdateBookingStatusMutation();
  const { enqueue: enqueueSnackbar } = useSnackbar();

  const bookings = useMemo(
    () => bookingsData?.pages.flatMap((page) => page.items) ?? [],
    [bookingsData]
  );

  const handleSetStatus = useCallback(async (bookingId: string, status: DriverBookingAction) => {
    try {
      await updateBooking.mutateAsync({ id: bookingId, status });
      void triggerHaptic(status === "confirmed" ? "medium" : "light");
      enqueueSnackbar({
        type: status === "confirmed" ? "success" : "info",
        title: status === "confirmed" ? "Заявка подтверждена" : "Заявка отклонена",
        dedupeKey: `booking_status_${bookingId}_${status}`,
      });
    } catch (error) {
      enqueueSnackbar({
        type: "error",
        title: "Не удалось обновить заявку",
        subtitle: error instanceof Error ? error.message : undefined,
        dedupeKey: `booking_status_error_${bookingId}`,
      });
    }
  }, [updateBooking, enqueueSnackbar]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchTrip(), refetchBookings()]);
  }, [refetchTrip, refetchBookings]);

  const isRefreshing = isFetching && !isLoading;

  if (isTripLoading) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={() => routeNavigator.back()} aria-label="Назад" />}
        >
          Управление поездкой
        </AppPanelHeader>
        <ScreenSpinner state="loading" />
      </Panel>
    );
  }

  if (!tripId || isTripError || !trip) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={() => routeNavigator.back()} aria-label="Назад" />}
        >
          Управление поездкой
        </AppPanelHeader>
        <EmptyState
          title="Не удалось загрузить поездку"
          subtitle="Проверьте соединение и попробуйте снова"
          action={
            <Box padding="system">
              <Button size="m" mode="primary" onClick={() => refetchTrip()}>
                Попробовать снова
              </Button>
            </Box>
          }
        />
      </Panel>
    );
  }

  if (!isOwnTrip) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={() => routeNavigator.back()} aria-label="Назад" />}
        >
          Управление поездкой
        </AppPanelHeader>
        <EmptyState
          title="Нет доступа к управлению"
          subtitle="Управлять заявками может только водитель этой поездки"
        />
      </Panel>
    );
  }

  return (
    <TripRequestsPanel
      id={id}
      trip={trip}
      bookings={bookings}
      isLoading={isLoading}
      isError={isError}
      isRefreshing={isRefreshing}
      onBack={() => routeNavigator.back()}
      onRefresh={handleRefresh}
      onSetStatus={handleSetStatus}
      onRetry={() => refetchBookings()}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => fetchNextPage()}
    />
  );
};
