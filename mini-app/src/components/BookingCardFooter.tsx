// mini-app/src/components/BookingCardFooter.tsx
import { type FC } from "react";
import {
  Button,
  Caption,
  Flex,
  Spacing,
  Subhead,
  Text,
} from "@vkontakte/vkui";
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
      label: "Поездка отменена",
      color: "var(--vkui--color_text_negative)",
    };
  }

  // 2. Бронь отменена пассажиром
  if (booking.status === "cancelled") {
    return {
      label: "Отменена вами",
      color: "var(--vkui--color_text_negative)",
    };
  }

  // 3. Заявка отклонена водителем
  if (booking.status === "declined") {
    return {
      label: "Заявка отклонена",
      color: "var(--vkui--color_text_secondary)",
    };
  }

  // 4. Не состоялась: заявка так и не подтверждена, а время поездки прошло
  if (booking.status === "pending" && isPast(trip.departureAt)) {
    return {
      label: "Не состоялась",
      color: "var(--vkui--color_text_secondary)",
    };
  }

  // 5. Ждёт подтверждения
  if (booking.status === "pending") {
    return {
      label: "Ждёт подтверждения",
      color: "var(--vkui--color_text_accent, #3f8ae0)",
    };
  }

  // 6. Завершена: бронь подтверждена, поездка завершена или время прошло
  if (
    booking.status === "confirmed" &&
    (trip.status === "completed" || isPast(trip.departureAt))
  ) {
    return {
      label: "Завершена",
      color: "var(--carpool_accent)",
    };
  }

  // 7. Подтверждена
  if (booking.status === "confirmed") {
    return {
      label: "Подтверждена",
      color: "var(--carpool_accent)",
    };
  }

  return {
    label: "Неизвестно",
    color: "var(--vkui--color_text_secondary)",
  };
}

export const BookingCardFooter: FC<{
  booking: Booking;
  onOpenReview?: (trip: Trip) => void;
}> = ({ booking, onOpenReview }) => {
  const { label, color } = getStatusData(booking);

  const showReviewDone = Boolean(booking.hasReview);

  return (
    <>
      <Flex justify="space-between" align="center">
        <Caption level="1" weight="2">
          Место {booking.seat}
        </Caption>
        <Subhead weight="2" style={{ color }}>
          {label}
        </Subhead>
      </Flex>

      {booking.comment && (
        <Text className="BookingCardFooter__comment">
          «{booking.comment}»
        </Text>
      )}

      {booking.canReview && onOpenReview && (
        <>
          <Spacing size={12} />
          <Button
            size="s"
            mode="primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReview(booking.trip);
            }}
          >
            Оставить отзыв
          </Button>
        </>
      )}

      {showReviewDone && (
        <Caption level="1" className="BookingCardFooter__comment">
          Отзыв оставлен
        </Caption>
      )}
    </>
  );
};

BookingCardFooter.displayName = "BookingCardFooter";
