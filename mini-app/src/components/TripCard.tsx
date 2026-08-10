// mini-app/src/components/TripCard.tsx
import { type FC, type KeyboardEvent, type ReactNode } from "react";
import {
  Avatar,
  Card,
  Caption,
  Spacing,
  Text,
  Title,
  Box,
  Subhead,
  Separator,
  ContentBadge,
  Flex,
} from "@vkontakte/vkui";
import { RouteLine } from "@/components/RouteLine";
import { RatingBadge } from "@/components/RatingBadge";
import { resolveAvatar } from "@/helpers/avatar";
import type { Trip } from "@/types";

export interface TripCardProps {
  trip: Trip;
  onOpen?: (trip: Trip) => void;
  requestsCount?: number;
  hideSeats?: boolean;
  /** Переопределяет автоматический текст «X из Y мест». */
  seatsLabel?: string;
  archivedStatus?: "completed" | "cancelled";
  /** Дополнительный контент в нижней части карточки (после блока водителя). */
  children?: ReactNode;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} ч ${m} мин`;
  if (h > 0) return `${h} ч`;
  return `${m} мин`;
}

/** Русская плюрализация: 1 место, 2 места, 5 мест. */
function pluralSeats(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "место";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "места";
  return "мест";
}

export const TripCard: FC<TripCardProps> = ({
  trip,
  onOpen,
  requestsCount = 0,
  hideSeats = false,
  seatsLabel: seatsLabelProp,
  archivedStatus,
  children,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen?.(trip);
    }
  };

  const isInteractive = Boolean(onOpen);
  const isArchived = Boolean(archivedStatus);

  const seatsLabel =
    seatsLabelProp !== undefined
      ? seatsLabelProp
      : trip.seatsAvailable === 0
        ? "Мест нет"
        : `${trip.seatsAvailable} из ${trip.seatsTotal} ${pluralSeats(trip.seatsTotal)}`;

  return (
    <Card
      mode="shadow"
      className={isArchived ? "TripCard TripCard--archived" : "TripCard"}
      onClick={isInteractive ? () => onOpen?.(trip) : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? "button" : undefined}
      aria-label={
        isInteractive
          ? `Поездка ${trip.fromCity} — ${trip.toCity}, ${trip.date} в ${trip.time}, ${trip.price} рублей`
          : undefined
      }
    >
      <Box padding="system">
        <Flex justify="space-between" align="baseline">
          <Subhead weight="2" className="TripCard__date">
            {trip.date} · {trip.time}
          </Subhead>
          <Title level="3" weight="2">
            {trip.price.toLocaleString("ru-RU")} ₽
          </Title>
        </Flex>

        {isArchived && (
          <>
            <Spacing size={4} />
            <Caption
              level="1"
              weight="2"
              className={
                archivedStatus === "cancelled"
                  ? "TripCard__archiveStatus TripCard__archiveStatus--cancelled"
                  : "TripCard__archiveStatus TripCard__archiveStatus--completed"
              }
            >
              {archivedStatus === "cancelled" ? "ОТМЕНЕНА" : "ЗАВЕРШЕНА"}
            </Caption>
          </>
        )}

        <Spacing size={12} />
        <RouteLine
          from={{ city: trip.fromCity, address: trip.fromAddress }}
          to={{ city: trip.toCity, address: trip.toAddress }}
        />

        <Spacing size={8} />
        <Caption level="1" className="TripCard__duration">
          В пути ≈ {formatDuration(trip.durationMinutes)} · {trip.distanceKm} км
        </Caption>

        {trip.tags && trip.tags.length > 0 && (
          <>
            <Spacing size={10} />
            <Flex gap={6} wrap="wrap">
              {trip.tags.map((tag) => (
                <ContentBadge key={tag} mode="secondary">
                  {tag}
                </ContentBadge>
              ))}
            </Flex>
          </>
        )}

        <Spacing size={12} />
        <Separator />
        <Spacing size={12} />

        <Flex justify="space-between" align="center">
          <Flex align="center" gap={8} className="TripCard__driver">
            <Avatar src={resolveAvatar(trip.driver.avatar)} size={32} />
            <Flex direction="column" className="TripCard__driverInfo">
              <Text weight="2" className="TripCard__driverName">
                {trip.driver.name}
              </Text>
              <RatingBadge value={trip.driver.rating} size="s" />
            </Flex>
          </Flex>
          <Flex direction="column" align="end">
            {!hideSeats && (
              <Caption
                level="1"
                weight="2"
                className={
                  trip.seatsAvailable === 0
                    ? "TripCard__seats TripCard__seats--none"
                    : "TripCard__seats TripCard__seats--available"
                }
              >
                {seatsLabel}
              </Caption>
            )}
            {requestsCount > 0 && (
              <Caption level="1" className="TripCard__requestsCount">
                Новых заявок: {requestsCount}
              </Caption>
            )}
          </Flex>
        </Flex>

        {children && (
          <>
            <Spacing size={12} />
            <Separator />
            <Spacing size={12} />
            {children}
          </>
        )}
      </Box>
    </Card>
  );
};