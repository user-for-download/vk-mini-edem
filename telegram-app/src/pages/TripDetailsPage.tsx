import { useState } from "react";
import { Button, Cell, List, Placeholder, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { hapticFeedback } from "@telegram-apps/sdk-react";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmAction } from "@/components/ConfirmAction";
import { EditTripForm } from "@/components/EditTripForm";
import { OfflineBanner } from "@/components/OfflineBanner";
import { bookingErrorMessage } from "@/helpers/bookingErrors";
import { shareTrip } from "@/helpers/tripShare";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuthStore } from "@/store/useAuthStore";
import { TRIP_KEYS, useTripDetailQuery } from "@/queries/useTripsQuery";
import {
  useCancelBookingMutation,
  useCreateBookingMutation,
  useTripBookingsQuery,
} from "@/queries/useBookingsQuery";
import {
  useCancelTripMutation,
  useCompleteTripMutation,
} from "@/queries/useTripsQuery";

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours} ч ${rest} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${rest} мин`;
}

/**
 * Детали поездки (паритет VK TripDetailsPanel): адреса/теги/длительность/
 * дистанция, выбор места + комментарий, confirm-guards, шаринг, edit trip,
 * expired/authorization/conflict/offline-состояния. Бэкенд — авторитет.
 */
export function TripDetailsPage() {
  const { tripId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const trip = useTripDetailQuery(tripId);
  const createBooking = useCreateBookingMutation();
  const cancelBooking = useCancelBookingMutation();
  const user = useAuthStore((state) => state.user);
  const { isOnline } = useOnlineStatus();
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (trip.isLoading) {
    return (
      <>
        <PageHeader title="Детали поездки" />
        <Placeholder>
          <Spinner size="m" />
        </Placeholder>
      </>
    );
  }
  if (trip.isError || !trip.data) {
    return (
      <>
        <PageHeader title="Детали поездки" />
        <OfflineBanner />
        <Placeholder
          header="Поездка не найдена"
          description={trip.error ? bookingErrorMessage(trip.error) : "Вернитесь к поиску и выберите другую поездку."}
        >
          <div className="ButtonRow">
            <Button onClick={() => void trip.refetch()}>Повторить</Button>
            <Button mode="outline" onClick={() => navigate("/trips")}>К поиску</Button>
          </div>
          {!isOnline && <p>Проверьте подключение к интернету.</p>}
        </Placeholder>
      </>
    );
  }

  const item = trip.data;
  const isDriver = item.driver.id === user?.id;
  const departureTime = item.departureAt ? new Date(item.departureAt).getTime() : null;
  const departed = departureTime !== null && departureTime <= Date.now();
  const isActive = !item.status || item.status === "active";
  const hasActiveBooking =
    !!item.myBooking &&
    item.myBooking.status !== "cancelled" &&
    item.myBooking.status !== "declined";
  const canBook =
    !isDriver &&
    isActive &&
    item.seatsAvailable > 0 &&
    !hasActiveBooking &&
    departureTime !== null &&
    departureTime > Date.now();

  const takenSeats = item.bookedSeats ?? [];
  const availableSeats = Array.from({ length: item.seatsTotal }, (_, index) => index + 1).filter(
    (seat) => !takenSeats.includes(seat),
  );
  const effectiveSeat =
    selectedSeat !== null && !takenSeats.includes(selectedSeat)
      ? selectedSeat
      : (availableSeats[0] ?? null);

  const canCompleteTrip = isDriver && isActive && departureTime !== null && departureTime <= Date.now();

  const handleShare = () => {
    setShareStatus(null);
    void shareTrip(item.id).then((result) => {
      if (result === "shared") setShareStatus("Ссылка отправлена — поделитесь поездкой с попутчиками");
      else if (result === "copied") setShareStatus("Ссылка скопирована — поделитесь поездкой с попутчиками");
      else setShareStatus("Не удалось поделиться — скопируйте адрес страницы вручную");
      hapticFeedback.notificationOccurred.ifAvailable("success");
    });
  };

  return (
    <>
      <PageHeader title="Детали поездки" />
      <OfflineBanner />
      <Section header={`${item.fromCity} → ${item.toCity}`}>
        <List>
          <Cell subtitle={`${item.date} в ${item.time}`}>Маршрут</Cell>
          {item.fromAddress || item.toAddress ? (
            <Cell subtitle={`${item.fromAddress ?? "—"} → ${item.toAddress ?? "—"}`}>
              Адреса встречи
            </Cell>
          ) : (
            <Cell subtitle="Точное место встречи станет доступно после подтверждения брони">
              Адреса встречи
            </Cell>
          )}
          <Cell subtitle={`${formatDuration(item.durationMinutes)} · ${item.distanceKm} км`}>
            Время в пути и расстояние
          </Cell>
          <Cell subtitle={`${item.seatsAvailable} из ${item.seatsTotal}`}>Свободные места</Cell>
          <Cell subtitle={`${item.driver.rating.toFixed(1)} · ${item.driver.reviewsCount} отзывов`}>
            Водитель: {item.driver.name}
          </Cell>
          <Cell subtitle={item.driver.car?.model ?? "Автомобиль не указан"}>Автомобиль</Cell>
          {item.tags.length > 0 && (
            <Cell subtitle={item.tags.join(" · ")}>Особенности</Cell>
          )}
          {item.comment && <Cell subtitle={item.comment}>Комментарий водителя</Cell>}
          <Cell subtitle={`${item.price} ₽`}>Цена за место</Cell>
        </List>
      </Section>

      {item.myBooking && (
        <Section header="Ваша заявка">
          <List>
            <Cell
              subtitle={
                item.myBooking.status === "confirmed"
                  ? `Место №${item.myBooking.seat} подтверждено — приятной поездки!`
                  : `Заявка на место №${item.myBooking.seat} отправлена — ожидайте подтверждения водителя.`
              }
            >
              Статус: {item.myBooking.status}
            </Cell>
            {(item.myBooking.status === "pending" || item.myBooking.status === "confirmed") && (
              <ConfirmAction
                label="Отменить бронирование"
                confirmLabel="Отменить бронь"
                description="Заявка будет отменена, а место снова станет доступно."
                pending={cancelBooking.isPending}
                onConfirm={() =>
                  cancelBooking.mutate(item.myBooking!.id, {
                    onSuccess: () =>
                      hapticFeedback.notificationOccurred.ifAvailable("success"),
                  })
                }
              />
            )}
            {cancelBooking.error && (
              <p className="FormError" role="alert">
                {bookingErrorMessage(cancelBooking.error)}
              </p>
            )}
          </List>
        </Section>
      )}

      {canBook && (
        <Section header="Бронирование">
          <List>
            <div role="group" aria-label="Выбор места">
              <p>Место</p>
              <div className="ButtonRow">
                {Array.from({ length: item.seatsTotal }, (_, index) => index + 1).map((seat) =>
                  takenSeats.includes(seat) ? (
                    <Button key={seat} mode="outline" disabled aria-label={`Место ${seat} занято`}>
                      {seat} (зан.)
                    </Button>
                  ) : effectiveSeat === seat ? (
                    <Button
                      key={seat}
                      disabled={createBooking.isPending}
                      onClick={() => setSelectedSeat(seat)}
                      aria-pressed
                      aria-label={`Место ${seat} выбрано`}
                    >
                      {seat}
                    </Button>
                  ) : (
                    <Button
                      key={seat}
                      mode="outline"
                      disabled={createBooking.isPending}
                      onClick={() => setSelectedSeat(seat)}
                      aria-pressed={false}
                      aria-label={`Выбрать место ${seat}`}
                    >
                      {seat}
                    </Button>
                  )
                )}
              </div>
            </div>
            <label className="FormField">
              Комментарий водителю
              <textarea
                value={comment}
                maxLength={300}
                rows={3}
                placeholder="Например: буду с небольшим чемоданом, подойду к 9:25"
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <Button
              stretched
              loading={createBooking.isPending}
              disabled={effectiveSeat === null || createBooking.isPending}
              onClick={() => {
                if (effectiveSeat === null) return;
                createBooking.mutate(
                  {
                    tripId: item.id,
                    seat: effectiveSeat,
                    comment: comment.trim() ? comment.trim() : undefined,
                  },
                  {
                    onSuccess: () => {
                      hapticFeedback.notificationOccurred.ifAvailable("success");
                      setComment("");
                    },
                    onError: (error) => {
                      // Гонка за место: обновляем схему мест с сервера.
                      if (
                        error instanceof Error &&
                        "code" in error &&
                        (error as { code?: string }).code === "SEAT_TAKEN"
                      ) {
                        void queryClient.invalidateQueries({
                          queryKey: TRIP_KEYS.detail(item.id),
                        });
                      }
                    },
                  },
                );
              }}
            >
              Забронировать место · {item.price} ₽
            </Button>
            {createBooking.error && (
              <p className="FormError" role="alert">
                {bookingErrorMessage(createBooking.error)}
              </p>
            )}
          </List>
        </Section>
      )}

      {!isDriver && isActive && !departed && item.seatsAvailable <= 0 && !hasActiveBooking && (
        <Placeholder header="Свободных мест нет" description="Попробуйте другую поездку или оставьте запрос попутчика." />
      )}
      {!isDriver && isActive && departed && (
        <Placeholder header="Поездка уже отправилась" description="Бронирование недоступно. Найдите другую поездку." />
      )}
      {item.status === "cancelled" && <Placeholder header="Поездка отменена" />}
      {item.status === "completed" && <Placeholder header="Поездка завершена" />}

      {isDriver && (
        <DriverBlock
          tripId={item.id}
          status={item.status}
          isActive={isActive}
          canCompleteTrip={canCompleteTrip}
          editing={editing}
          onToggleEdit={() => setEditing((value) => !value)}
          trip={item}
        />
      )}

      <Section header="Поделиться">
        <List>
          <Button mode="outline" stretched onClick={handleShare}>
            Поделиться поездкой
          </Button>
          {shareStatus && <p role="status">{shareStatus}</p>}
        </List>
      </Section>

    </>
  );
}

function DriverBlock({
  tripId,
  status,
  isActive,
  canCompleteTrip,
  editing,
  onToggleEdit,
  trip,
}: {
  tripId: string;
  status: string | undefined;
  isActive: boolean;
  canCompleteTrip: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  trip: Parameters<typeof EditTripForm>[0]["trip"];
}) {
  const navigate = useNavigate();
  const cancelTrip = useCancelTripMutation();
  const completeTrip = useCompleteTripMutation();
  // Заявки видны только водителю: остальным бэкенд вернёт 403,
  // поэтому запрос делаем только здесь (паттерн VK TripDetailsPanel).
  const bookings = useTripBookingsQuery(tripId, { enabled: isActive });
  const pendingCount =
    bookings.data?.pages
      .flatMap((page) => page.items)
      .filter((booking) => booking.status === "pending").length ?? 0;

  return (
    <Section header="Управление поездкой">
      <List>
        <Cell subtitle="Это ваша поездка">Водитель</Cell>
        {status === "completed" && <Cell subtitle="Пассажиры могут оставить отзыв">Поездка завершена</Cell>}
        {status === "cancelled" && <Cell subtitle="Поездка недоступна для бронирования">Поездка отменена</Cell>}
        {isActive && (
          <>
            <Button mode="outline" stretched onClick={() => navigate(`/trips/my/${tripId}/requests`)}>
              Заявки пассажиров{bookings.data ? ` (${pendingCount})` : ""}
            </Button>
            {bookings.isError && (
              <p className="FormError" role="alert">
                {bookingErrorMessage(bookings.error)}{" "}
                <Button mode="plain" size="s" onClick={() => void bookings.refetch()}>
                  Повторить
                </Button>
              </p>
            )}
            <Button mode="outline" stretched onClick={onToggleEdit}>
              {editing ? "Скрыть редактирование" : "Редактировать поездку"}
            </Button>
            {editing && <EditTripForm trip={trip} onDone={onToggleEdit} />}
            <ConfirmAction
              label="Завершить поездку"
              confirmLabel="Завершить"
              description="Поездка будет перенесена в архив, а пассажиры смогут оставить отзывы."
              pending={completeTrip.isPending}
              disabled={!canCompleteTrip || completeTrip.isPending || cancelTrip.isPending}
              onConfirm={() => completeTrip.mutate(tripId)}
            />
            {!canCompleteTrip && (
              <p>Завершение станет доступно после времени отправления.</p>
            )}
            <ConfirmAction
              label="Отменить поездку"
              confirmLabel="Отменить поездку"
              description="Поездка станет недоступна, а пассажиры получат уведомление об отмене."
              pending={cancelTrip.isPending}
              onConfirm={() => cancelTrip.mutate(tripId)}
            />
            {(cancelTrip.error || completeTrip.error) && (
              <p className="FormError" role="alert">
                {bookingErrorMessage(cancelTrip.error ?? completeTrip.error)}
              </p>
            )}
          </>
        )}
      </List>
    </Section>
  );
}
