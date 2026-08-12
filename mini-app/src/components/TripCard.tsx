// mini-app/src/components/TripCard.tsx
import { type FC, type KeyboardEvent, type ReactNode } from "react";
import {
  Avatar,
  Card,
  Footnote,
  Text,
  Box,
  Separator,
  Flex,
  RichCell,
  Spacing,
} from "@vkontakte/vkui";
import { Icon16Favorite } from "@vkontakte/icons";
import { RouteLine } from "@/components/RouteLine";
import { resolveAvatar } from "@/helpers/avatar";
import type { Trip } from "@/types";

export interface TripCardProps {
  trip: Trip;
  onOpen?: (trip: Trip) => void;
  requestsCount?: number;
  hideSeats?: boolean;
  /** Переопределяет автоматический текст «X из Y мест». */
  seatsLabel?: string;
  /** Цвет текста мест (перекрывает цвет по умолчанию). */
  seatsColor?: string;
  archivedStatus?: "completed" | "cancelled";
  /** Дополнительный контент в теле карточки (после блока водителя, без Separator). */
  children?: ReactNode;
  disabled?: boolean;
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || "ЭД";
}

export const TripCard: FC<TripCardProps> = ({
  trip,
  onOpen,
  hideSeats = false,
  seatsLabel: seatsLabelProp,
  archivedStatus,
  children,
  disabled = false,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) {
        onOpen?.(trip);
      }
    }
  };

  const isInteractive = Boolean(onOpen) && !disabled;
  const isArchived = Boolean(archivedStatus);

  const seatsLeft = trip.seatsAvailable;
  const seatsLabelText =
    seatsLabelProp !== undefined
      ? seatsLabelProp
      : seatsLeft === 0
        ? "нет мест"
        : `${seatsLeft} из ${trip.seatsTotal} ${pluralSeats(trip.seatsTotal)}`;

  const driver = trip.driver;
  const car = trip.car;
  const carText = car ? `${car.brand} ${car.model} · ${car.number}` : undefined;
  const durationText = formatDuration(trip.durationMinutes);
  const distanceText = trip.distanceKm ? `${trip.distanceKm} км` : "";

  return (
    <Card
      mode="outline"
      // eslint-disable-next-line react/forbid-dom-props
      style={{
        borderRadius: 12,
        backgroundColor: "var(--vkui--color_background_content)",
        overflow: "hidden",
        cursor: disabled ? "default" : "pointer",
        opacity: isArchived ? 0.6 : 1,
      }}
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
      <Box padding={16}>
        <RouteLine
          from={{ city: trip.fromCity, address: trip.fromAddress }}
          to={{ city: trip.toCity, address: trip.toAddress }}
          dateLabel={trip.date}
          time={trip.time}
          price={trip.price}
          duration={durationText}
          distance={distanceText}
          seatsLeft={hideSeats ? undefined : seatsLeft}
          seatsLabel={hideSeats ? undefined : seatsLabelText}
        />
      </Box>

      <Separator />

      <RichCell
        disabled
        before={
          <Avatar
            size={48}
            src={resolveAvatar(driver.avatarUrl)}
            initials={initialsOf(driver.name)}
          />
        }
        after={
          <Flex align="center" gap="2xs">
            <Icon16Favorite style={{ color: "var(--vkui--color_icon_accent_themed)" }} />
            <Footnote
              weight="2"
              // eslint-disable-next-line react/forbid-dom-props
              style={{ color: "var(--vkui--color_text_primary)" }}
            >
              {(driver.driverRating ?? 5.0).toFixed(1)}
            </Footnote>
          </Flex>
        }
      >
        <Text
          weight="2"
          // eslint-disable-next-line react/forbid-dom-props
          style={{ color: "var(--vkui--color_text_primary)" }}
        >
          {driver.name}
        </Text>
        {carText && (
          <>
            <Spacing size={2} />
            <Footnote
              // eslint-disable-next-line react/forbid-dom-props
              style={{ color: "var(--vkui--color_text_tertiary)" }}
            >
              {carText}
            </Footnote>
          </>
        )}
      </RichCell>

      {children}
    </Card>
  );
};
