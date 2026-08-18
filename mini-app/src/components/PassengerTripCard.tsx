// mini-app/src/components/PassengerTripCard.tsx
import { type FC } from "react";
import { Button, Caption, Spacing, Text } from "@vkontakte/vkui";
import { TripCard } from "@/components/TripCard";
import type { Booking, Trip } from "@/types";

function isPast(date?: string): boolean {
  if (!date) {
    return false;
  }

  const time = Date.parse(date);

  return !Number.isNaN(time) && time <= Date.now();
}

/**
 * Единая логика статуса брони пассажира.
 * Используется на экранах «Мои поездки» (активные + история) и «История поездок» —
 * чтобы статус одной и той же брони отображался одинаково везде.
 */
function getStatusData(booking: Booking): { label: string; color: string } {
  const trip = booking.trip as Trip & {
    status?: "active" | "cancelled" | "completed";
    departureAt?: string;
  };

  // 1. Поездка отменена (глобальный статус поездки)
  if (trip.status === "cancelled") {
    return {
      label: "отменено",
      color: "var(--vkui--color_text_negative)",
    };
  }

  // 2. Бронь отменена пассажиром
  if (booking.status === "cancelled") {
    return {
      label: "отменено вами",
      color: "var(--vkui--color_text_negative)",
    };
  }

  // 3. Заявка отклонена водителем
  if (booking.status === "declined") {
    return {
      label: "отклонено",
      color: "var(--vkui--color_text_secondary)",
    };
  }

  // 4. Не состоялась: заявка так и не подтверждена, а время поездки прошло
  if (booking.status === "pending" && isPast(trip.departureAt)) {
    return {
      label: "не состоялось",
      color: "var(--vkui--color_text_secondary)",
    };
  }

  // 5. Ждёт подтверждения
  if (booking.status === "pending") {
    return {
      label: "ожидает",
      color: "var(--vkui--color_text_accent)",
    };
  }

  // 6. Завершена: бронь подтверждена, поездка завершена или время прошло
  if (
    booking.status === "confirmed" &&
    (trip.status === "completed" || isPast(trip.departureAt))
  ) {
    return {
      label: "завершено",
      color: "var(--vkui--color_text_accent)",
    };
  }

  // 7. Подтверждена
  if (booking.status === "confirmed") {
    return {
      label: "подтверждено",
      color: "var(--vkui--color_text_accent)",
    };
  }

  return {
    label: "неизвестно",
    color: "var(--vkui--color_text_secondary)",
  };
}

/**
 * Карточка поездки для пассажирской брони: статус брони встроен в строку
 * места в правой колонке («Место 1 подтверждено», цвет по статусу),
 * комментарий и кнопка отзыва — в теле карточки, без отдельного футера.
 */
export const PassengerTripCard: FC<{
  booking: Booking;
  onOpen?: (trip: Trip) => void;
  onOpenReview?: (trip: Trip) => void;
}> = ({ booking, onOpen, onOpenReview }) => {
  const status = getStatusData(booking);
  const canReview = Boolean(booking.canReview && onOpenReview);
  const hasDetails = Boolean(booking.comment || canReview || booking.hasReview);

  return (
    <TripCard
      trip={booking.trip}
      onOpen={onOpen}
      seatsLabel={`Место ${booking.seat} ${status.label}`}
    >
      {hasDetails && (
        <>
          {booking.comment && (
            <Text style={{ fontStyle: "italic", color: "var(--vkui--color_text_secondary)" }}>
              «{booking.comment}»
            </Text>
          )}

          {canReview && (
        <>
          <Spacing size={12} />
          <Button
            size="s"
            mode="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReview?.(booking.trip);
                }}
          >
            Оставить отзыв
          </Button>
        </>
      )}

          {booking.hasReview && (
            <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
              Отзыв оставлен
            </Caption>
          )}
        </>
      )}
    </TripCard>
  );
};

PassengerTripCard.displayName = "PassengerTripCard";
