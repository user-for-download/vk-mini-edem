// mini-app/src/views/ActionView/panels/TripRequestsPanel/TripRequestsPanel.tsx
import { type FC } from "react";
import {
  Avatar,
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
import { useSnackbarStore } from "@/store/useSnackbarStore";

export interface TripRequestsPanelProps {
  id: string;
  trip: Trip | null;
  bookings: Booking[];
  isLoading: boolean;
  isError: boolean;
  onBack: () => void;
  onSetStatus: (bookingId: string, status: DriverBookingAction) => void;
  onRetry: () => void;
}

export const TripRequestsPanel: FC<TripRequestsPanelProps> = ({
  id,
  trip,
  bookings,
  isLoading,
  isError,
  onBack,
  onSetStatus,
  onRetry,
}) => {
  const modalApi = useModalApi();
  const cancelTrip = useCancelTripMutation();
  const completeTrip = useCompleteTripMutation();
  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);

  const handleEditTrip = async () => {
    if (!trip) return;
    const { EditTripModal } = await import("@/modals/EditTripModal");
    modalApi.openCustomModalPage({
      component: EditTripModal,
      additionalProps: { trip },
      baseProps: { settlingHeight: 100 },
    });
  };

  const handleCancelTrip = () => {
    if (!trip || trip.status !== "active") return;
    cancelTrip.mutate(trip.id, {
      onSuccess: () => {
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

  const handleCompleteTrip = () => {
    if (!trip || trip.status !== "active") return;
    completeTrip.mutate(trip.id, {
      onSuccess: () => {
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
    departureTime <= Date.now();

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
                  style={{ marginBottom: 8 }}
                  disabled={cancelTrip.isPending || completeTrip.isPending}
                >
                  Редактировать поездку
                </Button>
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
                    style={{
                      color: "var(--vkui--color_text_secondary)",
                      marginTop: 8,
                      textAlign: "center",
                    }}
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
              />
            ))}
          </Box>
        )}

        {!isLoading && !isError && bookings.length === 0 && (
          <EmptyState
            title="Заявок пока нет"
            subtitle="Как только кто-то отправит заявку, она появится здесь"
          />
        )}
      </Group>
    </Panel>
  );
};
