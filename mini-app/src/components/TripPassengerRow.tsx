// mini-app/src/components/TripPassengerRow.tsx
import { type FC } from "react";
import { Avatar, Caption, RichCell } from "@vkontakte/vkui";
import type { Booking } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { resolveAvatar } from "@/helpers/avatar";

export interface TripPassengerRowProps {
  booking: Booking;
  onOpenProfile?: () => void;
}

/**
 * Строка подтверждённого пассажира.
 * В отличие от BookingRequestRow, здесь нет кнопок действий,
 * только информация о пассажире и его место.
 */
export const TripPassengerRow: FC<TripPassengerRowProps> = ({
  booking,
  onOpenProfile,
}) => {
  return (
    <RichCell
      before={<Avatar src={resolveAvatar(booking.passenger.avatar)} size={48} />}
      after={
        <Caption
          level="1"
          style={{ color: "var(--vkui--color_text_secondary)" }}
        >
          Место {booking.seat}
        </Caption>
      }
      afterAlign="center"
      subtitle={
        <RatingBadge
          value={booking.passenger.rating}
          reviewsCount={booking.passenger.reviewsCount}
          size="s"
        />
      }
      bottom={
        booking.comment ? (
          <Caption
            level="1"
            style={{ color: "var(--vkui--color_text_secondary)" }}
          >
            «{booking.comment}»
          </Caption>
        ) : undefined
      }
      multiline
      hasHover={Boolean(onOpenProfile)}
      hasActive={Boolean(onOpenProfile)}
      onClick={onOpenProfile}
    >
      {booking.passenger.name}
    </RichCell>
  );
};
