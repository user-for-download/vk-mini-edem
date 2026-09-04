// mini-app/src/views/ActionView/panels/PassengerHistoryPanel/PassengerHistoryPanel.tsx
import { type FC, useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Group,
  Panel,
  PanelHeaderBack,
  PullToRefresh,
  SegmentedControl,
  Spacing,
} from "@vkontakte/vkui";
import type { Trip } from "@/types";
import { PassengerTripCard } from "@/components/PassengerTripCard";
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

// VKUI SegmentedControl принимает mutable-массив options — разовый спред
// статичного списка (вычисляется один раз на уровне модуля).
const HISTORY_FILTER_OPTIONS: Array<{ label: string; value: HistoryFilter }> = [
  { label: "Все", value: "all" },
  { label: "Завершенные", value: "completed" },
  { label: "Отмененные", value: "cancelled" },
];

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
    isFetching,
    isError,
    error,
    refetch,
  } = usePassengerHistoryQuery();

  const visibleItems = useMemo(() => {
    let items = data ?? [];

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
  }, [data, filter]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const isRefreshing = isFetching && !isLoading;

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        История поездок
      </AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
      <div>

      <Group>
        <Box padding="system">
          <SegmentedControl<HistoryFilter>
            value={filter}
            onChange={(value) => setFilter(value)}
            options={[...HISTORY_FILTER_OPTIONS]}
          />
        </Box>
      </Group>

      <Group>
        {isLoading && (
          <Box padding="system">
            <Flex
              direction="column"
              gap={12}
              aria-busy="true"
              aria-label="Загрузка истории поездок"
            >
              <TripCardSkeleton />
              <TripCardSkeleton />
            </Flex>
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
          <Box padding="system">
            <Flex direction="column" gap={12}>
              {visibleItems.map((booking) => (
                <PassengerTripCard
                  key={booking.id}
                  booking={booking}
                  onOpen={() => onOpenTrip(booking.trip)}
                  onOpenReview={onOpenReview}
                />
              ))}
            </Flex>
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
      </div>
      </PullToRefresh>
    </Panel>
  );
};