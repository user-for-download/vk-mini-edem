// mini-app/src/components/BookingRequestRow.tsx
import { type FC, memo } from "react";
import { Avatar, Button, Caption, Box, Separator, Subhead, Text } from "@vkontakte/vkui";
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
        <Box padding="system" style={{ display: "flex", gap: 10 }}>
          <Avatar src={resolveAvatar(booking.passenger.avatar)} size={44} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text weight="2">{booking.passenger.name}</Text>
              <Caption
                level="1"
                style={{
                  color: "var(--vkui--color_text_secondary)",
                  flexShrink: 0,
                }}
              >
                Место {booking.seat}
              </Caption>
            </div>

            <RatingBadge
              value={booking.passenger.rating}
              reviewsCount={booking.passenger.reviewsCount}
              size="s"
            />

            {booking.comment && (
              <Text
                style={{
                  marginTop: 6,
                  color: "var(--vkui--color_text_secondary)",
                }}
              >
                «{booking.comment}»
              </Text>
            )}

            {booking.status === "pending" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
              </div>
            ) : (
              <Subhead weight="2" style={{ color: statusColor, marginTop: 8 }}>
                {STATUS_LABEL[booking.status]}
              </Subhead>
            )}
          </div>
        </Box>

        <Separator />
      </>
    );
  }
);

BookingRequestRow.displayName = "BookingRequestRow";