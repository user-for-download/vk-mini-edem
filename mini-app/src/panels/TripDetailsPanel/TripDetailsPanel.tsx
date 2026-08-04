// mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx
import { type FC, useState } from "react";
import {
  Avatar,
  Button,
  Caption,
  Card,
  Box,
  FormItem,
  FormStatus,
  Group,
  Header,
  InfoRow,
  Panel,
  PanelHeaderBack,
  Paragraph,
  ScreenSpinner,
  Separator,
  Spacing,
  Text,
  Textarea,
  Title,
} from "@vkontakte/vkui";
import type { Role, Trip } from "@/types";
import { RouteLine } from "@/components/RouteLine";
import { RatingBadge } from "@/components/RatingBadge";
import { SeatScheme } from "@/components/SeatScheme";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useSnackbarStore } from "@/store/useSnackbarStore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreateBookingMutation } from "@/queries/useBookingsQuery";
import {
  useCancelTripMutation,
  useCompleteTripMutation,
} from "@/queries/useTripsQuery";

export interface TripDetailsPanelProps {
  id: string;
  trip: Trip | null;
  role: Role;
  onBack: () => void;
  onOpenDriver: () => void;
}

export const TripDetailsPanel: FC<TripDetailsPanelProps> = ({
  id,
  trip,
  role,
  onBack,
  onOpenDriver,
}) => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [isCancellingTrip, setIsCancellingTrip] = useState(false);
  const [isCompletingTrip, setIsCompletingTrip] = useState(false);

  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);
  const currentUser = useCurrentUser();

  if (!currentUser) {
    return (
      <Panel id={id}>
        <AppPanelHeader before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}>Поездка</AppPanelHeader>
        <ScreenSpinner state="loading" />
      </Panel>
    );
  }

  const createBooking = useCreateBookingMutation();
  const cancelTrip = useCancelTripMutation();
  const completeTrip = useCompleteTripMutation();

  if (!trip) {
    return (
      <Panel id={id}>
        <AppPanelHeader
          before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
        >
          Поездка
        </AppPanelHeader>
      </Panel>
    );
  }

  const isOwnTrip = role === "driver" && trip.driver.id === currentUser.id;

  const isTripActive = trip.status ? trip.status === "active" : true;
  const isTripCompleted = trip.status === "completed";
  const isTripCancelled = trip.status === "cancelled";

  const noSeats = trip.seatsAvailable === 0;
  const takenSeats = trip.bookedSeats ?? [];

  const canBook = !isOwnTrip && isTripActive && !noSeats;

  const departureTime = trip.departureAt ? Date.parse(trip.departureAt) : null;

  const canCompleteTrip =
    isOwnTrip &&
    isTripActive &&
    departureTime !== null &&
    departureTime <= Date.now();

  const handleFooterClick = () => {
    if (!canBook) {
      return;
    }

    if (!bookingOpen) {
      setBookingOpen(true);
      return;
    }

    if (selectedSeat === null) {
      return;
    }

    setIsSubmittingBooking(true);

    createBooking.mutate(
      {
        tripId: trip.id,
        seat: selectedSeat,
        comment: comment.trim() ? comment.trim() : undefined,
      },
      {
        onSettled: () => {
          setIsSubmittingBooking(false);
        },
        onSuccess: () => {
          enqueueSnackbar({
            type: "success",
            title: "Заявка отправлена",
            subtitle: "Ожидайте подтверждения от водителя",
            dedupeKey: `book_${trip.id}`,
          });
          onBack();
        },
        onError: (error) => {
          enqueueSnackbar({
            type: "error",
            title: "Не удалось отправить заявку",
            subtitle: error instanceof Error ? error.message : undefined,
            dedupeKey: `book_error_${trip.id}`,
          });
        },
      }
    );
  };

  const handleCancelTrip = () => {
    if (!isOwnTrip || trip.status !== "active") {
      return;
    }

    setIsCancellingTrip(true);

    cancelTrip.mutate(trip.id, {
      onSettled: () => {
        setIsCancellingTrip(false);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Поездка отменена",
          subtitle: "Пассажиры получат уведомление",
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
    if (!canCompleteTrip) {
      return;
    }

    setIsCompletingTrip(true);

    completeTrip.mutate(trip.id, {
      onSettled: () => {
        setIsCompletingTrip(false);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Поездка завершена",
          subtitle: "Пассажиры смогут оставить отзыв",
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

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Детали поездки
      </AppPanelHeader>

      <Group>
        <Box padding="system">
          <Title level="2" weight="2">
            {trip.date} в {trip.time}
          </Title>
          <Spacing size={16} />
          <RouteLine
            from={{ city: trip.fromCity, address: trip.fromAddress }}
            to={{ city: trip.toCity, address: trip.toAddress }}
          />
        </Box>

        <Box
          padding="system"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <InfoRow header="Цена за место">
            {trip.price.toLocaleString("ru-RU")} ₽
          </InfoRow>
          <InfoRow header="Свободно мест">
            {`${trip.seatsAvailable} из ${trip.seatsTotal}`}
          </InfoRow>
          <InfoRow header="В пути">
            {`${Math.floor(trip.durationMinutes / 60)} ч ${
              trip.durationMinutes % 60
            } мин`}
          </InfoRow>
          <InfoRow header="Расстояние">{`${trip.distanceKm} км`}</InfoRow>
        </Box>

        {trip.tags.length > 0 && (
          <Box
            padding="system"
            style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
          >
            {trip.tags.map((tag) => (
              <Caption
                key={tag}
                level="1"
                weight="2"
                style={{
                  padding: "6px 10px",
                  borderRadius: 100,
                  background: "var(--vkui--color_background_secondary)",
                }}
              >
                {tag}
              </Caption>
            ))}
          </Box>
        )}

        {trip.comment && (
          <Box padding="system">
            <Paragraph style={{ color: "var(--vkui--color_text_secondary)" }}>
              «{trip.comment}»
            </Paragraph>
          </Box>
        )}
      </Group>

      <Group header={<Header size="s">Водитель</Header>}>
        <Card
          mode="outline"
          onClick={onOpenDriver}
          style={{ cursor: "pointer", margin: "0 12px 12px" }}
        >
          <Box
            padding="system"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <Avatar src={trip.driver.avatar} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text weight="2">{trip.driver.name}</Text>
              <RatingBadge
                value={trip.driver.rating}
                reviewsCount={trip.driver.reviewsCount}
                size="s"
              />
              {trip.driver.car && (
                <Caption
                  level="1"
                  style={{
                    color: "var(--vkui--color_text_secondary)",
                    marginTop: 2,
                  }}
                >
                  {trip.driver.car.model}, {trip.driver.car.color}
                </Caption>
              )}
            </div>
          </Box>
        </Card>
      </Group>

      {isOwnTrip && (
        <Box padding="system">
          {isTripCompleted && (
            <FormStatus mode="default" title="Поездка завершена">
              Пассажиры могут оставить отзыв о поездке.
            </FormStatus>
          )}

          {isTripCancelled && (
            <FormStatus mode="default" title="Поездка отменена">
              Эта поездка больше недоступна для бронирования.
            </FormStatus>
          )}

          {isTripActive && (
            <>
              <FormStatus mode="default" title="Это ваша поездка">
                Заявками пассажиров можно управлять на вкладке «Поездки» → «Мои
                поездки».
              </FormStatus>

              <Spacing size={16} />

              <Button
                size="m"
                mode="primary"
                stretched
                loading={isCompletingTrip}
                disabled={!canCompleteTrip || isCompletingTrip || isCancellingTrip}
                onClick={handleCompleteTrip}
              >
                Завершить поездку
              </Button>

              {!canCompleteTrip && (
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

              <Spacing size={12} />

              <Button
                size="m"
                mode="secondary"
                appearance="negative"
                stretched
                loading={isCancellingTrip}
                disabled={isCancellingTrip || isCompletingTrip}
                onClick={handleCancelTrip}
              >
                Отменить поездку
              </Button>
            </>
          )}
        </Box>
      )}

      {!isOwnTrip && !isTripActive && (
        <Box padding="system">
          <FormStatus
            mode="default"
            title={isTripCompleted ? "Поездка завершена" : "Поездка отменена"}
          >
            {isTripCompleted
              ? "Бронирование этой поездки больше недоступно."
              : "Эта поездка больше недоступна для бронирования."}
          </FormStatus>
        </Box>
      )}

      {canBook && (
        <>
          <div
            className={`BookingCollapse${
              bookingOpen ? " BookingCollapse--open" : ""
            }`}
          >
            <div className="BookingCollapse__inner">
              <Group header={<Header size="s">Выберите место</Header>}>
                <Box padding="system">
                  <SeatScheme
                    seatsTotal={trip.seatsTotal}
                    takenSeats={takenSeats}
                    selectedSeat={selectedSeat}
                    onSelect={setSelectedSeat}
                  />
                </Box>
              </Group>

              <Group header={<Header size="s">Комментарий водителю</Header>}>
                <FormItem>
                  <Textarea
                    placeholder="Например: буду с небольшим чемоданом, подойду к 9:25"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </FormItem>
              </Group>
            </div>
          </div>

          <Box
            padding="system"
            style={{
              position: "sticky",
              bottom: 0,
              background: "var(--vkui--color_background_content)",
            }}
          >
            <Separator style={{ marginBottom: 12 }} />

            {bookingOpen && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text weight="2">Итого</Text>
                <Title level="3" weight="2">
                  {trip.price.toLocaleString("ru-RU")} ₽
                </Title>
              </div>
            )}

            <Button
              size="l"
              stretched
              mode="primary"
              disabled={bookingOpen && selectedSeat === null}
              loading={isSubmittingBooking}
              onClick={handleFooterClick}
            >
              {bookingOpen ? "Отправить заявку" : "Забронировать место"}
            </Button>
          </Box>
        </>
      )}

      <Spacing size={24} />
    </Panel>
  );
};
