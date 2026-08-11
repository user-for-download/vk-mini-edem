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
import type { PassengerBooking, Trip } from "@/types";

function getStatusLabel(booking: PassengerBooking): string {
  if (booking.trip.status === "cancelled") return "Поездка отменена";
  if (booking.status === "cancelled") return "Отменена вами";
  if (booking.status === "pending") return "Ждёт подтверждения";
  if (booking.status === "confirmed") {
    // «Завершена» только когда поездка реально завершена: воркер
    // автозавершения может ещё не отработать, хотя бронь уже в истории.
    if (booking.scope === "history" && booking.trip.status === "completed") {
      return "Завершена";
    }
    return "Подтверждена";
  }
  return "Отклонена";
}

function getStatusColor(booking: PassengerBooking): string {
  if (booking.trip.status === "cancelled" || booking.status === "cancelled") {
    return "var(--vkui--color_text_negative)";
  }
  if (booking.status === "pending") {
    return "var(--vkui--color_text_accent, #3f8ae0)";
  }

  if (booking.status === "confirmed") {
    return "var(--carpool_accent)";
  }

  return "var(--vkui--color_text_secondary)";
}

export const BookingCardFooter: FC<{
  booking: PassengerBooking;
  onOpenReview: (trip: Trip) => void;
}> = ({ booking, onOpenReview }) => {
  return (
    <>
      <Flex justify="space-between" align="center">
        <Caption level="1" weight="2">
          Место {booking.seat}
        </Caption>
        <Subhead weight="2" style={{ color: getStatusColor(booking) }}>
          {getStatusLabel(booking)}
        </Subhead>
      </Flex>

      {booking.comment && (
        <Text className="BookingCardFooter__comment">
          «{booking.comment}»
        </Text>
      )}

      {booking.scope === "history" && booking.canReview && (
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

      {booking.scope === "history" && booking.hasReview && (
        <Caption level="1" className="BookingCardFooter__comment">
          Отзыв оставлен
        </Caption>
      )}
    </>
  );
};

BookingCardFooter.displayName = "BookingCardFooter";
