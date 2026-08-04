// mini-app/src/components/TripCard.tsx
import { type FC, type KeyboardEvent } from "react";
import { Avatar, Card, Caption, Spacing, Text, Title, Div, Subhead, Separator, ContentBadge } from "@vkontakte/vkui";
import { RouteLine } from "@/components/RouteLine";
import { RatingBadge } from "@/components/RatingBadge";
import type { Trip } from "@/types";

export interface TripCardProps {
  trip: Trip;
  onOpen?: (trip: Trip) => void;
  requestsCount?: number;
  hideSeats?: boolean;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} ч ${m} мин`;
  if (h > 0) return `${h} ч`;
  return `${m} мин`;
}

export const TripCard: FC<TripCardProps> = ({
  trip,
  onOpen,
  requestsCount = 0,
  hideSeats = false,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen?.(trip);
    }
  };

  const isInteractive = Boolean(onOpen);

  const seatsLabel =
    trip.seatsAvailable === 0
      ? "Мест нет"
      : `${trip.seatsAvailable} из ${trip.seatsTotal} ${trip.seatsTotal === 1 ? "места" : "мест"}`;

  return (
    <Card
      mode="shadow"
      onClick={isInteractive ? () => onOpen?.(trip) : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? "button" : undefined}
      aria-label={
        isInteractive
          ? `Поездка ${trip.fromCity} — ${trip.toCity}, ${trip.date} в ${trip.time}, ${trip.price} рублей`
          : undefined
      }
      style={{
        cursor: isInteractive ? "pointer" : "default",
        outline: "none",
      }}
    >
      <Div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Subhead weight="2" style={{ color: "var(--vkui--color_text_secondary)" }}>
            {trip.date} · {trip.time}
          </Subhead>
          <Title level="3" weight="2">
            {trip.price.toLocaleString("ru-RU")} ₽
          </Title>
        </div>

        <Spacing size={12} />
        <RouteLine from={{ city: trip.fromCity, address: trip.fromAddress }} to={{ city: trip.toCity, address: trip.toAddress }} />

        <Spacing size={8} />
        <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
          В пути ≈ {formatDuration(trip.durationMinutes)} · {trip.distanceKm} км
        </Caption>

        {trip.tags && trip.tags.length > 0 && (
          <>
            <Spacing size={10} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {trip.tags.map((tag) => (
                <ContentBadge key={tag} mode="secondary">
                  {tag}
                </ContentBadge>
              ))}
            </div>
          </>
        )}

        <Spacing size={12} />
        <Separator />
        <Spacing size={12} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Avatar src={trip.driver.avatar} size={32} />
            <div style={{ minWidth: 0 }}>
              <Text weight="2" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {trip.driver.name}
              </Text>
              <RatingBadge value={trip.driver.rating} size="s" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            {!hideSeats && (
              <Caption
                level="1"
                weight="2"
                style={{ color: trip.seatsAvailable === 0 ? "var(--vkui--color_text_secondary)" : "var(--carpool_accent)", flexShrink: 0, marginLeft: 8 }}
              >
                {seatsLabel}
              </Caption>
            )}
            {requestsCount > 0 && (
              <Caption level="1" style={{ marginTop: 2, color: "var(--carpool_accent)" }}>
                Новых заявок: {requestsCount}
              </Caption>
            )}
          </div>
        </div>
      </Div>
    </Card>
  );
};
