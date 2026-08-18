// mini-app/src/views/ActionView/panels/TripsManagePanel/TripsManagePanel.tsx
import { useMemo, useEffect, useRef, useState, type FC } from "react";
import {
  Box,
  Button,
  Flex,
  Group,
  Panel,
  PanelHeaderButton,
  PullToRefresh,
  Spacing,
  SegmentedControl,
} from "@vkontakte/vkui";
import { Icon28AddOutline } from "@vkontakte/icons";
import type { Trip } from "@/types";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useInfiniteMyTripsQuery } from "@/queries/useTripsQuery";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export interface TripsManagePanelProps {
  id: string;
  onOpenTrip: (trip: Trip) => void;
  onOpenCreateTrip: () => void;
}

type DriverTripTab = "active" | "archive";

function pluralSeats(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "место";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "места";
  return "мест";
}

function getSeatsLabel(trip: Trip): string {
  const pending = trip.pendingRequestsCount ?? 0;
  const confirmed = trip.confirmedBookingsCount ?? 0;

  if (pending > 0) {
    return `Заявки: ${pending}`;
  }

  return confirmed > 0
    ? `Забронировано: ${confirmed} ${pluralSeats(confirmed)}`
    : `Свободно: ${trip.seatsAvailable} ${pluralSeats(trip.seatsAvailable)}`;
}

/**
 * Список поездок водителя.
 *
 * Данные берутся из:
 * GET /api/trips/my
 *
 * Счетчик заявок берется из trip.pendingRequestsCount,
 * который возвращает backend.
 */
export const TripsManagePanel: FC<TripsManagePanelProps> = ({
  id,
  onOpenTrip,
  onOpenCreateTrip,
}) => {
  const [tab, setTab] = useState<DriverTripTab>("active");
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteMyTripsQuery({ status: tab });

  const { isRefreshing, handleRefresh } = usePullToRefresh(refetch);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Фильтрация теперь на бэкенде (параметр status).
  // Плоский список без повторного фильтра по статусу.
  const myTrips = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  return (
    <Panel id={id}>
      <AppPanelHeader
        after={
          <PanelHeaderButton
            onClick={onOpenCreateTrip}
            aria-label="Создать поездку"
          >
            <Icon28AddOutline />
          </PanelHeaderButton>
        }
      >
        Мои поездки
      </AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
      <div>

      <Group>
        <Box padding="system">
          <SegmentedControl<DriverTripTab>
            value={tab}
            onChange={(value) => setTab(value)}
            options={[
              { label: "Активные", value: "active" },
              { label: "Архив", value: "archive" },
            ]}
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
              aria-label="Загрузка списка поездок"
            >
              <TripCardSkeleton />
              <TripCardSkeleton />
            </Flex>
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

        {!isLoading && !isError && myTrips.length > 0 && (
          <Box padding="system">
            <Flex direction="column" gap={12}>
              {myTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpen={onOpenTrip}
                  seatsLabel={getSeatsLabel(trip)}
                  archivedStatus={
                    tab === "archive"
                      ? (trip.status as "completed" | "cancelled")
                      : undefined
                  }
                />
              ))}
              {/* eslint-disable-next-line react/forbid-dom-props */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {isFetchingNextPage && <TripCardSkeleton />}
            </Flex>
          </Box>
        )}

        {!isLoading && !isError && myTrips.length === 0 && tab === "active" && (
          <EmptyState
            title="Нет активных поездок"
            subtitle="Опубликуйте маршрут — и попутчики смогут отправить заявку"
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={onOpenCreateTrip}>
                  Создать поездку
                </Button>
              </Box>
            }
          />
        )}

        {!isLoading && !isError && myTrips.length === 0 && tab === "archive" && (
          <EmptyState
            title="Архив пуст"
            subtitle="Здесь будут завершенные и отмененные поездки"
          />
        )}
      </Group>

      <Spacing size={24} />
      </div>
      </PullToRefresh>
    </Panel>
  );
};
