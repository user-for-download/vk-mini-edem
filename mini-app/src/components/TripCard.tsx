// mini-app/src/components/TripCard.tsx
import { type FC } from "react";
import { Avatar, Box, Card, Caption, Spacing, Text, Title } from "@vkontakte/vkui";
import { RouteLine } from "@/components/RouteLine";
import { RatingBadge } from "@/components/RatingBadge";
import type { Trip } from "@/types";

export interface TripCardProps {
  trip: Trip;
  onOpen?: (trip: Trip) => void;
  requestsCount?: number;
  hideSeats?: boolean;
}

export const TripCard: FC<TripCardProps> = ({
  trip,
  onOpen,
  requestsCount = 0,
  hideSeats = false,
}) => {
  return (
    <Card
      mode="shadow"
      onClick={() => onOpen?.(trip)}
      style={{ cursor: "pointer" }}
    >
      <Box padding="system">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
            {trip.date} · {trip.time}
          </Caption>
          <Title level="3" weight="2">
            {trip.price.toLocaleString("ru-RU")} ₽
          </Title>
        </div>
        <Spacing size={12} />
        <RouteLine
          from={{ city: trip.fromCity, address: trip.fromAddress }}
          to={{ city: trip.toCity, address: trip.toAddress }}
        />
        <Spacing size={12} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar src={trip.driver.avatar} size={28} />
          <Text weight="2" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {trip.driver.name}
          </Text>
          <RatingBadge value={trip.driver.rating} size="s" />
        </div>
        {!hideSeats && (
          <Caption level="1" style={{ marginTop: 8, color: "var(--vkui--color_text_secondary)" }}>
            Свободно мест: {trip.seatsAvailable} из {trip.seatsTotal}
          </Caption>
        )}
        {requestsCount > 0 && (
          <Caption level="1" style={{ marginTop: 4, color: "var(--carpool_accent)" }}>
            Новых заявок: {requestsCount}
          </Caption>
        )}
      </Box>
    </Card>
  );
};
