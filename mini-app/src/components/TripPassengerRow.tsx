// mini-app/src/components/TripPassengerRow.tsx
//
// Строка подтверждённого пассажира в RichCell (шаблон как у BookingRequestRow):
// before: Avatar с бейджем рейтинга, children: ФИО + место,
// subtitle: «комментарий» / «маршрут · дата», after: «Написать в VK».
// Кнопок решений нет — заявка уже подтверждена.
import { type FC } from "react";
import {
  Avatar,
  Button,
  Caption,
  Flex,
  RichCell,
  Tappable,
  Text,
} from "@vkontakte/vkui";
import { Icon28MessageTextOutline } from "@vkontakte/icons";
import type { Booking } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { resolveAvatar } from "@/helpers/avatar";
import { openVkMessages } from "@/helpers/vkLink";

export interface TripPassengerRowProps {
  booking: Booking;
  onOpenProfile?: () => void;
}

/** Строка подтверждённого пассажира в деталях поездки водителя. */
export const TripPassengerRow: FC<TripPassengerRowProps> = ({
  booking,
  onOpenProfile,
}) => {
  const { passenger, trip } = booking;

  // «Написать в VK» — для активных броней (pending/confirmed) при наличии vkUserId.
  const canWriteMessage =
    passenger.vkUserId != null && booking.status === "confirmed";

  const handleWriteMessage = () => {
    if (passenger.vkUserId != null) {
      void openVkMessages(passenger.vkUserId);
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
            <Avatar src={resolveAvatar(passenger.avatar)} size={48}>
              <Avatar.Badge background="stroke">
                <RatingBadge
                  value={passenger.rating}
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
          />
        ) : undefined
      }
      subtitle={
        <Caption style={{ color: "var(--vkui--color_text_secondary)" }}>
          {subtitleText}
        </Caption>
      }
    >
      <Flex align="center" gap={8}>
        <Text weight="2">{passenger.name}</Text>
        <Caption style={{ color: "var(--vkui--color_text_secondary)" }}>
          (Забронированно #{booking.seat})
        </Caption>
      </Flex>
    </RichCell>
  );
};
