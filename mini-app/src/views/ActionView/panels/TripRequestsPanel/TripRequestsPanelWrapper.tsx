// mini-app/src/views/ActionView/panels/TripRequestsPanel/TripRequestsPanelWrapper.tsx
import { type FC, useCallback } from "react";
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

export const TripRequestsPanelWrapper: FC<{ id: string }> = ({ id }) => {
  const params = useParams<"tripId">();
  const routeNavigator = useRouteNavigator();

  const tripId = params?.tripId;

  const { data: trip, refetch: refetchTrip } = useTripDetailQuery(tripId ?? "");
  const currentUser = useCurrentUser();

  // Заявки видит только водитель поездки (driver-only эндпоинт, иначе 403).
  const isOwnTrip = !!currentUser && !!trip && trip.driver.id === currentUser.id;

  const {
    data: bookings,
    isLoading,
    isFetching,
    isError,
    refetch: refetchBookings,
  } = useTripBookingsQuery(tripId ?? "", { enabled: isOwnTrip });

  const updateBooking = useUpdateBookingStatusMutation();
  const { enqueue: enqueueSnackbar } = useSnackbar();

  const handleSetStatus = useCallback((bookingId: string, status: DriverBookingAction) => {
    updateBooking.mutate(
      { id: bookingId, status },
      {
        onSuccess: () => {
          enqueueSnackbar({
            type: status === "confirmed" ? "success" : "info",
            title:
              status === "confirmed"
                ? "Заявка подтверждена"
                : "Заявка отклонена",
            dedupeKey: `booking_status_${bookingId}_${status}`,
          });
        },
        onError: (error) => {
          enqueueSnackbar({
            type: "error",
            title: "Не удалось обновить заявку",
            subtitle: error instanceof Error ? error.message : undefined,
            dedupeKey: `booking_status_error_${bookingId}`,
          });
        },
      }
    );
  }, [updateBooking, enqueueSnackbar]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchTrip(), refetchBookings()]);
  }, [refetchTrip, refetchBookings]);

  const isRefreshing = isFetching && !isLoading;

  return (
    <TripRequestsPanel
      id={id}
      trip={trip ?? null}
      bookings={bookings ?? []}
      isLoading={isLoading}
      isError={isError}
      isRefreshing={isRefreshing}
      onBack={() => routeNavigator.back()}
      onRefresh={handleRefresh}
      onSetStatus={handleSetStatus}
      onRetry={() => refetchBookings()}
    />
  );
};
