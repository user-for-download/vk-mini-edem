// mini-app/src/views/ActionView/panels/PassengerBookingsPanel/PassengerBookingsPanel.tsx
import { type FC, memo, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Caption,
  Card,
  Group,
  Panel,
  PanelHeaderBack,
  SegmentedControl,
  Separator,
  Spacing,
  Subhead,
  Text,
  Title,
} from "@vkontakte/vkui";
import type { PassengerBooking, PassengerBookingScope, Trip } from "@/types";
import { RouteLine } from "@/components/RouteLine";
import { RatingBadge } from "@/components/RatingBadge";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { resolveAvatar } from "@/helpers/avatar";
import { useMyBookingsQuery } from "@/queries/useBookingsQuery";

export interface PassengerBookingsPanelProps {
  id: string;
  onBack: () => void;
  onOpenTrip: (trip: Trip) => void;
  onOpenReview: (trip: Trip) => void;
  onGoSearch: () => void;
}

function getStatusLabel(booking: PassengerBooking): string {
  if (booking.trip.status === "cancelled") return "Поездка отменена";
  if (booking.status === "cancelled") return "Отменена вами";
  if (booking.status === "pending") return "Ждёт подтверждения";
  if (booking.status === "confirmed") return booking.scope === "active" ? "Подтверждена" : "Завершена";
  return "Отклонена";
}

function getStatusColor(booking: PassengerBooking): string {
  if (booking.trip.status === "cancelled" || booking.status === "cancelled") {
    return "var(--vkui--color_text_negative)";
  }
  // ... остальное без изменений
  if (booking.status === "pending") {
    return "var(--vkui--color_text_accent, #3f8ae0)";
  }

  if (booking.status === "confirmed") {
    return "var(--carpool_accent)";
  }

  return "var(--vkui--color_text_secondary)";
}

const BookingCard: FC<{
  booking: PassengerBooking;
  onOpenTrip: (trip: Trip) => void;
  onOpenReview: (trip: Trip) => void;
}> = memo(({ booking, onOpenTrip, onOpenReview }) => {
  const trip = booking.trip;

  return (
    <Card
      mode="shadow"
      onClick={() => onOpenTrip(trip)}
      style={{ cursor: "pointer" }}
    >
      <Box padding="system">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Subhead
            weight="2"
            style={{ color: "var(--vkui--color_text_secondary)" }}
          >
            {trip.date} · {trip.time}
          </Subhead>

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

        <Separator />

        <Spacing size={12} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <Avatar src={resolveAvatar(trip.driver.avatar)} size={32} />

            <div style={{ minWidth: 0 }}>
              <Text
                weight="2"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {trip.driver.name}
              </Text>

              <RatingBadge value={trip.driver.rating} size="s" />
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <Caption level="1" weight="2">
              Место {booking.seat}
            </Caption>

            <Subhead
              weight="2"
              style={{ color: getStatusColor(booking) }}
            >
              {getStatusLabel(booking)}
            </Subhead>
          </div>
        </div>

        {booking.comment && (
          <Text
            style={{
              marginTop: 10,
              color: "var(--vkui--color_text_secondary)",
            }}
          >
            «{booking.comment}»
          </Text>
        )}

        {booking.scope === "history" && booking.canReview && (
          <div style={{ marginTop: 12 }}>
            <Button
              size="s"
              mode="primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReview(trip);
              }}
            >
              Оставить отзыв
            </Button>
          </div>
        )}

        {booking.scope === "history" && booking.hasReview && (
          <Caption
            level="1"
            style={{
              marginTop: 10,
              color: "var(--vkui--color_text_secondary)",
            }}
          >
            Отзыв оставлен
          </Caption>
        )}
      </Box>
    </Card>
  );
});

BookingCard.displayName = "BookingCard";

/**
 * Экран пассажира:
 * - активные брони;
 * - история поездок;
 * - возможность оставить отзыв после завершенной поездки.
 */
export const PassengerBookingsPanel: FC<PassengerBookingsPanelProps> = ({
  id,
  onBack,
  onOpenTrip,
  onOpenReview,
  onGoSearch,
}) => {
  const [tab, setTab] = useState<PassengerBookingScope>("active");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useMyBookingsQuery();

  const visibleBookings = useMemo(() => {
    const bookings = ((data as unknown as PassengerBooking[]) ?? []).filter(
      (booking) => booking.scope === tab
    );

    return [...bookings].sort((a, b) => {
      const aTime = a.trip.departureAt ? Date.parse(a.trip.departureAt) : 0;
      const bTime = b.trip.departureAt ? Date.parse(b.trip.departureAt) : 0;

      if (tab === "active") {
        return aTime - bTime;
      }

      return bTime - aTime;
    });
  }, [data, tab]);

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Мои поездки
      </AppPanelHeader>

      <Group>
        <Box padding="system">
          <SegmentedControl<PassengerBookingScope>
            value={tab}
            onChange={(value) => setTab(value)}
            options={[
              { label: "Активные", value: "active" },
              { label: "История", value: "history" },
            ]}
          />
        </Box>
      </Group>

      <Group>
        {isLoading && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            aria-busy="true"
          >
            <TripCardSkeleton />
            <TripCardSkeleton />
          </Box>
        )}

        {isError && (
          <EmptyState
            title="Не удалось загрузить поездки"
            subtitle={
              error instanceof Error
                ? error.message
                : "Попробуйте обновить список позже"
            }
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={() => refetch()}>
                  Попробовать снова
                </Button>
              </Box>
            }
          />
        )}

        {!isLoading && !isError && visibleBookings.length > 0 && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            aria-live="polite"
            aria-label={`Список поездок, всего ${visibleBookings.length}`}
          >
            {visibleBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onOpenTrip={onOpenTrip}
                onOpenReview={onOpenReview}
              />
            ))}
          </Box>
        )}

        {!isLoading && !isError && visibleBookings.length === 0 && tab === "active" && (
          <EmptyState
            title="Нет активных бронирований"
            subtitle="Найдите поездку и отправьте заявку водителю"
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={onGoSearch}>
                  Найти поездку
                </Button>
              </Box>
            }
          />
        )}

        {!isLoading && !isError && visibleBookings.length === 0 && tab === "history" && (
          <EmptyState
            title="История пока пуста"
            subtitle="Здесь появятся завершенные поездки"
          />
        )}
      </Group>

      <Spacing size={24} />
    </Panel>
  );
};
