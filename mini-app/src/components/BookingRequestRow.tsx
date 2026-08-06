// mini-app/src/components/BookingRequestRow.tsx
import { type FC, memo } from "react";
import {
  Avatar,
  Button,
  Caption,
  Box,
  Separator,
  Subhead,
  Text,
  Flex,
  Spacing,
} from "@vkontakte/vkui";
import type { DriverBookingAction } from "@edem/contracts";
import type { Booking, BookingStatus } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { resolveAvatar } from "@/helpers/avatar";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Ждёт решения",
  confirmed: "Подтверждено",
  declined: "Отклонено",
  cancelled: "Отменена",
};

export interface BookingRequestRowProps {
  booking: Booking;
  onSetStatus: (bookingId: string, status: DriverBookingAction) => void;
}

export const BookingRequestRow: FC<BookingRequestRowProps> = memo(
  ({ booking, onSetStatus }) => {
    const statusColor =
      booking.status === "confirmed"
        ? "var(--carpool_accent)"
        : booking.status === "declined"
          ? "var(--vkui--color_text_secondary)"
          : "var(--vkui--color_text_accent, #3f8ae0)";

    return (
      <>
        <Box padding="system">
          <Flex gap={10}>
            <Avatar src={resolveAvatar(booking.passenger.avatar)} size={44} />

            <div className="BookingRequestRow__main">
              <Flex justify="space-between" gap={8}>
                <Text weight="2">{booking.passenger.name}</Text>
                <Caption level="1" className="BookingRequestRow__seat">
                  Место {booking.seat}
                </Caption>
              </Flex>

              <RatingBadge
                value={booking.passenger.rating}
                reviewsCount={booking.passenger.reviewsCount}
                size="s"
              />

              {booking.comment && (
                <>
                  <Spacing size={6} />
                  <Text className="BookingRequestRow__comment">
                    «{booking.comment}»
                  </Text>
                </>
              )}

              {booking.status === "pending" ? (
                <>
                  <Spacing size={10} />
                  <Flex gap={8}>
                    <Button
                      size="s"
                      mode="primary"
                      appearance="positive"
                      onClick={() => onSetStatus(booking.id, "confirmed")}
                    >
                      Подтвердить
                    </Button>

                    <Button
                      size="s"
                      mode="secondary"
                      appearance="negative"
                      onClick={() => onSetStatus(booking.id, "declined")}
                    >
                      Отклонить
                    </Button>
                  </Flex>
                </>
              ) : (
                <>
                  <Spacing size={8} />
                  <Subhead
                    weight="2"
                    // eslint-disable-next-line react/forbid-dom-props -- цвет зависит от статуса бронирования
                    style={{ color: statusColor }}
                  >
                    {STATUS_LABEL[booking.status]}
                  </Subhead>
                </>
              )}
            </div>
          </Flex>
        </Box>

        <Separator />
      </>
    );
  }
);

BookingRequestRow.displayName = "BookingRequestRow";
