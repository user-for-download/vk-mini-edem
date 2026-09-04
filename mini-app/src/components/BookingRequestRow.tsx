// mini-app/src/components/BookingRequestRow.tsx

import { type FC, memo, useState } from "react";
import {
  Avatar,
  Button,
  ButtonGroup,
  Caption,
  Flex,
  RichCell,
  Spacing,
  Tappable,
  Text,
} from "@vkontakte/vkui";
import {
  Icon28MessageTextOutline,
} from "@vkontakte/icons";
import type { DriverBookingAction } from "@edem/contracts";
import type { Booking  } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { resolveAvatar } from "@/helpers/avatar";
import { openVkMessages } from "@/helpers/vkLink";



export interface BookingRequestRowProps {
  booking: Booking;
  onSetStatus: (bookingId: string, status: DriverBookingAction) => Promise<void>;
  /** Открыть профиль пассажира; если не задан — аватар некликабелен. */
  onOpenProfile?: () => void;
}

export const BookingRequestRow: FC<BookingRequestRowProps> = memo(
  ({ booking, onSetStatus, onOpenProfile }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const { passenger, trip } = booking;

    // «Написать в VK» водителю: с момента заявки (pending) и после принятия (confirmed).
    const canWriteMessage =
      passenger.vkUserId != null &&
      (booking.status === "pending" || booking.status === "confirmed");

    const handleWriteMessage = () => {
      if (passenger.vkUserId != null) {
        void openVkMessages(passenger.vkUserId);
      }
    };

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

    const subtitleText = booking.comment
      ? `«${booking.comment}»`
      : `${trip.fromCity} → ${trip.toCity} · ${trip.date}`;

    return (
      <RichCell
        beforeAlign="center"
        contentAlign="center"
        afterAlign="center"
        before={
          onOpenProfile ? (
            <Tappable
              onClick={onOpenProfile}
              aria-label="Открыть профиль пассажира"
              style={{ borderRadius: "50%" }}
            >
              <Avatar src={resolveAvatar(passenger.avatar)} size={48} >
              <Avatar.Badge background="stroke">
                <RatingBadge
                value={booking.passenger.rating}
                size="s"
                />
              </Avatar.Badge>
              </Avatar>
            </Tappable>
          ) : (
            <Avatar src={resolveAvatar(passenger.avatar)} size={48} />
          )
        }
        after={
          canWriteMessage ? (
            <Button
              mode="secondary"
              aria-label="Написать в VK"
              before={<Icon28MessageTextOutline />}
              onClick={handleWriteMessage}
              disabled={isUpdating}
            />
          ) : undefined
        }
        subtitle={
            <Caption style={{ color: "var(--vkui--color_text_secondary)"}}>
                {subtitleText}
            </Caption>
        }
        actions={
          booking.status === "pending" ? (
            <Spacing size={8}>
              <ButtonGroup mode="horizontal"  stretched>
                <Button
                  mode="outline"
                  size="s"
                  onClick={() => handleStatus("confirmed")}
                  disabled={isUpdating}
                >
                  Принять заявку
                </Button>
                <Button
                  mode="secondary"
                  appearance="negative"
                  size="s"
                  onClick={() => handleStatus("declined")}
                  disabled={isUpdating}
                >
                  Отклонить
                </Button>
              </ButtonGroup>
            </Spacing>
          ) : undefined
        }
      >
        <Flex align="center" gap={8}>
          <Text weight="2">{passenger.name}</Text>
          <Caption style={{ color: "var(--vkui--color_text_secondary)"}}>
              (Бронь места № {booking.seat})
          </Caption>
        </Flex>
      </RichCell>
    );
  }
);

BookingRequestRow.displayName = "BookingRequestRow";
