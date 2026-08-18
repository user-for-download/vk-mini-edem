// mini-app/src/components/BookingRequestRow.tsx
import { type FC, memo, useState } from "react";
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
  onSetStatus: (bookingId: string, status: DriverBookingAction) => Promise<void>;
}

export const BookingRequestRow: FC<BookingRequestRowProps> = memo(
  ({ booking, onSetStatus }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const statusColor =
      booking.status === "confirmed"
        ? "var(--vkui--color_text_accent)"
        : booking.status === "declined"
          ? "var(--vkui--color_text_secondary)"
          : "var(--vkui--color_text_accent)";

    const handleStatus = async (status: DriverBookingAction) => {
      if (isUpdating) {
        return;
      }

      setIsUpdating(true);
      try {
        await onSetStatus(booking.id, status);
      } finally {
        setIsUpdating(false);
      }
    };

    return (
      <>
        <Box padding="system">
          <Flex gap={10}>
            <Avatar src={resolveAvatar(booking.passenger.avatar)} size={44} />

            <Flex direction="column" gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Flex justify="space-between" gap={8}>
                <Text weight="2">{booking.passenger.name}</Text>
                <Caption level="1" style={{ flexShrink: 0, color: "var(--vkui--color_text_secondary)" }}>
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
                  <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
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
                      onClick={() => handleStatus("confirmed")}
                      disabled={isUpdating}
                      loading={isUpdating}
                    >
                      Подтвердить
                    </Button>

                    <Button
                      size="s"
                      mode="secondary"
                      appearance="negative"
                      onClick={() => handleStatus("declined")}
                      disabled={isUpdating}
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
                    style={{ color: statusColor }}
                  >
                    {STATUS_LABEL[booking.status]}
                  </Subhead>
                </>
              )}
            </Flex>
          </Flex>
        </Box>

        <Separator />
      </>
    );
  }
);

BookingRequestRow.displayName = "BookingRequestRow";
