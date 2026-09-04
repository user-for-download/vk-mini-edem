// mini-app/src/views/ActionView/panels/TripRequestsPanel/TripRequestsPanel.tsx
import { useCallback, type FC, useEffect, useState } from "react";
import {
  Button,
  ButtonGroup,
  Caption,
  Box,
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  PanelHeaderContent,
  InfoRow,
  FormStatus,
  PullToRefresh,
  SimpleGrid,
  Spacing,
  Text,
} from "@vkontakte/vkui";
import type { DriverBookingAction } from "@edem/contracts";
import type { Booking, Trip } from "@/types";
import { BookingRequestRow } from "@/components/BookingRequestRow";
import { RouteLine } from "@/components/RouteLine";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useModalApi } from "@/providers/ModalProvider";
import { useCancelTripMutation, useCompleteTripMutation } from "@/queries/useTripsQuery";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useConfirm } from "@/providers/ConfirmProvider";
import { loadModule } from "@/helpers/loadModule";
import { triggerHaptic } from "@/helpers/bridge";
import { openUserProfileModal } from "@/helpers/profileModal";

export interface TripRequestsPanelProps {
  id: string;
  trip: Trip | null;
  bookings: Booking[];
  isLoading: boolean;
  isError: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onRefresh: () => void | Promise<void>;
  onSetStatus: (bookingId: string, status: DriverBookingAction) => Promise<void>;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export const TripRequestsPanel: FC<TripRequestsPanelProps> = ({
  id,
  trip,
  bookings,
  isLoading,
  isError,
  isRefreshing,
  onBack,
  onRefresh,
  onSetStatus,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) => {
  const modalApi = useModalApi();
  const cancelTrip = useCancelTripMutation();
  const completeTrip = useCompleteTripMutation();
  const { enqueue: enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();

  // Date.now() в рендере запрещён (react-hooks/purity) — время обновляем по таймеру
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const handleEditTrip = async () => {
    if (!trip) return;
    const module = await loadModule(() => import("@/modals/EditTripModal"));
    if (!module) return;
    const { EditTripModal } = module;
    modalApi.openCustomModalPage({
      component: EditTripModal,
      additionalProps: { trip },
      baseProps: { settlingHeight: 100 },
    });
  };

  const handleCancelTrip = async () => {
    if (!trip || trip.status !== "active") return;

    const confirmed = await confirm({
      title: "Отменить поездку?",
      description: "Поездка станет недоступна, а пассажиры получат уведомление об отмене.",
      confirmTitle: "Отменить поездку",
    });
    if (!confirmed) return;

    cancelTrip.mutate(trip.id, {
      onSuccess: () => {
        void triggerHaptic("heavy");
        enqueueSnackbar({
          type: "success",
          title: "Поездка отменена",
          dedupeKey: `cancel_trip_${trip.id}`,
        });
        onBack();
      },
      onError: (error) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось отменить поездку",
          subtitle: error instanceof Error ? error.message : undefined,
          dedupeKey: `cancel_trip_error_${trip.id}`,
        });
      },
    });
  };

  const handleCompleteTrip = async () => {
    if (!trip || trip.status !== "active") return;

    const confirmed = await confirm({
      title: "Завершить поездку?",
      description: "Поездка будет перенесена в архив, а пассажиры смогут оставить отзывы.",
      confirmTitle: "Завершить",
      confirmMode: "default",
    });
    if (!confirmed) return;

    completeTrip.mutate(trip.id, {
      onSuccess: () => {
        void triggerHaptic("medium");
        enqueueSnackbar({
          type: "success",
          title: "Поездка завершена",
          dedupeKey: `complete_trip_${trip.id}`,
        });
        onBack();
      },
      onError: (error) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось завершить поездку",
          subtitle: error instanceof Error ? error.message : undefined,
          dedupeKey: `complete_trip_error_${trip.id}`,
        });
      },
    });
  };

  const departureTime = trip?.departureAt ? Date.parse(trip.departureAt) : null;
  const canComplete =
    trip &&
    trip.status === "active" &&
    departureTime !== null &&
    departureTime <= now;

  const handleRefresh = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        <PanelHeaderContent
          subtitle={
            trip
              ? `${trip.fromCity} → ${trip.toCity}, ${trip.date}`
              : undefined
          }
        >
          Управление поездкой
        </PanelHeaderContent>
      </AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
      <div>

      {trip && (
        <Group>
          <Box padding="system">
            <RouteLine
              from={{ city: trip.fromCity, address: trip.fromAddress }}
              to={{ city: trip.toCity, address: trip.toAddress }}
            />
            <Spacing size={12} />
            <SimpleGrid columns={2} gap={12}>
              <InfoRow header="Цена">
                {trip.price.toLocaleString("ru-RU")} ₽
              </InfoRow>
              <InfoRow header="Свободно мест">
                {`${trip.seatsAvailable} из ${trip.seatsTotal}`}
              </InfoRow>
            </SimpleGrid>

            {trip.status === "active" && (
              <>
                <Spacing size={16} />
                <Button
                  size="m"
                  mode="secondary"
                  stretched
                  onClick={handleEditTrip}
                  disabled={cancelTrip.isPending || completeTrip.isPending}
                >
                  Редактировать поездку
                </Button>
                <Spacing size={8} />
                <ButtonGroup mode="horizontal" gap="s" stretched>
                  <Button
                    size="m"
                    mode="primary"
                    appearance="positive"
                    stretched
                    onClick={handleCompleteTrip}
                    loading={completeTrip.isPending}
                    disabled={!canComplete || cancelTrip.isPending}
                  >
                    Завершить
                  </Button>
                  <Button
                    size="m"
                    mode="secondary"
                    appearance="negative"
                    stretched
                    onClick={handleCancelTrip}
                    loading={cancelTrip.isPending}
                    disabled={completeTrip.isPending}
                  >
                    Отменить
                  </Button>
                </ButtonGroup>
                {!canComplete && (
                  <Caption
                    level="1"
                    style={{ textAlign: "center", color: "var(--vkui--color_text_secondary)" }}
                  >
                    Завершение будет доступно после времени отправления
                  </Caption>
                )}
              </>
            )}

            {trip.status === "cancelled" && (
              <FormStatus mode="default" title="Поездка отменена">
                Эта поездка больше недоступна для бронирования.
              </FormStatus>
            )}
            {trip.status === "completed" && (
              <FormStatus mode="default" title="Поездка завершена">
                Пассажиры могут оставить отзыв.
              </FormStatus>
            )}
          </Box>
        </Group>
      )}

      <Group header={<Header size="s">Заявки ({bookings.length})</Header>}>
        {isLoading && (
          <Box padding="system">
            <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
              Загрузка заявок...
            </Text>
          </Box>
        )}

        {isError && (
          <EmptyState
            title="Не удалось загрузить заявки"
            subtitle="Попробуйте обновить страницу или повторить позже"
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={onRetry}>
                  Попробовать снова
                </Button>
              </Box>
            }
          />
        )}

        {!isLoading && !isError && bookings.length > 0 && (
          <Box
            aria-live="polite"
            aria-label={`Список заявок, ${bookings.length}`}
          >
             {bookings.map((booking) => (
              <BookingRequestRow
                key={booking.id}
                booking={booking}
                onSetStatus={onSetStatus}
                onOpenProfile={() => {
                  void openUserProfileModal(modalApi, booking.passenger.id, "Профиль пассажира");
                }}
              />
             ))}
             {hasNextPage && (
               <Box padding="system">
                 <Button size="m" mode="secondary" stretched onClick={onLoadMore} loading={isFetchingNextPage}>
                   Загрузить ещё
                 </Button>
               </Box>
             )}
          </Box>
        )}

        {!isLoading && !isError && bookings.length === 0 && (
          <EmptyState
            title="Заявок пока нет"
            subtitle="Как только кто-то отправит заявку, она появится здесь"
          />
        )}
      </Group>
      </div>
      </PullToRefresh>
    </Panel>
  );
};
