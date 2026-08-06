// mini-app/src/views/ActionView/panels/PassengerHistoryPanel/PassengerHistoryPanel.tsx
import { type FC, useMemo, useState } from "react";
import {
  Box,
  Button,
  Caption,
  Flex,
  Group,
  Panel,
  PanelHeaderBack,
  SegmentedControl,
  Spacing,
  Subhead,
  Text,
} from "@vkontakte/vkui";
import type { Booking, Trip } from "@/types";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { usePassengerHistoryQuery } from "@/queries/useBookingsQuery";

export interface PassengerHistoryPanelProps {
  id: string;
  onBack: () => void;
  onOpenTrip: (trip: Trip) => void;
  onOpenReview?: (trip: Trip) => void;
  onGoSearch: () => void;
}

type HistoryFilter = "all" | "completed" | "cancelled";

function isPast(date?: string): boolean {
  if (!date) {
    return false;
  }

  const time = Date.parse(date);

  if (Number.isNaN(time)) {
    return false;
  }

  return time <= Date.now();
}

function getStatusData(booking: Booking): {
  label: string;
  color: string;
} {
  const trip = booking.trip as Trip & {
    status?: "active" | "cancelled" | "completed";
    departureAt?: string;
  };

  if (trip.status === "cancelled") {
    return {
      label: "Поездка отменена",
      color: "var(--vkui--color_text_negative)",
    };
  }

  if (booking.status === "declined") {
    return {
      label: "Заявка отклонена",
      color: "var(--vkui--color_text_secondary)",
    };
  }

  if (
    booking.status === "confirmed" &&
    (trip.status === "completed" || isPast(trip.departureAt))
  ) {
    return {
      label: "Завершена",
      color: "var(--carpool_accent)",
    };
  }

  if (booking.status === "pending" && isPast(trip.departureAt)) {
    return {
      label: "Не состоялась",
      color: "var(--vkui--color_text_secondary)",
    };
  }

  return {
    label: "История",
    color: "var(--vkui--color_text_secondary)",
  };
}

const HistoryCardFooter: FC<{
  booking: Booking;
  status: { label: string; color: string };
  onOpenReview?: (trip: Trip) => void;
}> = ({ booking, status, onOpenReview }) => {
  return (
    <>
      <Flex justify="space-between" align="center">
        <Caption level="1" weight="2">
          Место {booking.seat}
        </Caption>
        <Subhead weight="2" style={{ color: status.color }}>
          {status.label}
        </Subhead>
      </Flex>

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

      {booking.canReview && onOpenReview && (
        <Button
          size="s"
          mode="primary"
          style={{ marginTop: 12 }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenReview(booking.trip);
          }}
        >
          Оставить отзыв
        </Button>
      )}

      {booking.hasReview && (
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
    </>
  );
};

HistoryCardFooter.displayName = "HistoryCardFooter";

/**
 * Экран истории поездок пассажира.
 *
 * Данные берутся из:
 * GET /api/bookings/history
 */
export const PassengerHistoryPanel: FC<PassengerHistoryPanelProps> = ({
  id,
  onBack,
  onOpenTrip,
  onOpenReview,
  onGoSearch,
}) => {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = usePassengerHistoryQuery();

  const historyItems = data ?? [];

  const visibleItems = useMemo(() => {
    let items = historyItems;

    if (filter !== "all") {
      items = items.filter((item) => item.historyCategory === filter);
    }

    return [...items].sort((a, b) => {
      const aTrip = a.trip as Trip & { departureAt?: string };
      const bTrip = b.trip as Trip & { departureAt?: string };

      const aTime = aTrip.departureAt ? Date.parse(aTrip.departureAt) : 0;
      const bTime = bTrip.departureAt ? Date.parse(bTrip.departureAt) : 0;

      return bTime - aTime;
    });
  }, [historyItems, filter]);

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        История поездок
      </AppPanelHeader>

      <Group>
        <Box padding="system">
          <SegmentedControl<HistoryFilter>
            value={filter}
            onChange={(value) => setFilter(value)}
            options={[
              { label: "Все", value: "all" },
              { label: "Завершенные", value: "completed" },
              { label: "Отмененные", value: "cancelled" },
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
            aria-label="Загрузка истории поездок"
          >
            <TripCardSkeleton />
            <TripCardSkeleton />
          </Box>
        )}

        {isError && (
          <EmptyState
            title="Не удалось загрузить историю"
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

        {!isLoading && !isError && visibleItems.length > 0 && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {visibleItems.map((booking) => (
              <TripCard
                key={booking.id}
                trip={booking.trip}
                onOpen={() => onOpenTrip(booking.trip)}
                hideSeats
              >
                <HistoryCardFooter
                  booking={booking}
                  status={getStatusData(booking)}
                  onOpenReview={onOpenReview}
                />
              </TripCard>
            ))}
          </Box>
        )}

        {!isLoading && !isError && visibleItems.length === 0 && filter === "all" && (
          <EmptyState
            title="История пока пуста"
            subtitle="Здесь появятся завершенные и отмененные поездки"
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={onGoSearch}>
                  Найти поездку
                </Button>
              </Box>
            }
          />
        )}

        {!isLoading &&
          !isError &&
          visibleItems.length === 0 &&
          filter === "completed" && (
            <EmptyState
              title="Нет завершенных поездок"
              subtitle="Когда вы совершите поездку, она появится здесь"
            />
          )}

        {!isLoading &&
          !isError &&
          visibleItems.length === 0 &&
          filter === "cancelled" && (
            <EmptyState
              title="Нет отмененных поездок"
              subtitle="Здесь появятся отмененные и отклоненные заявки"
            />
          )}
      </Group>

      <Spacing size={24} />
    </Panel>
  );
};
