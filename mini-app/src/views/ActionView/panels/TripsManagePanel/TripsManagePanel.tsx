// mini-app/src/views/ActionView/panels/TripsManagePanel/TripsManagePanel.tsx
import { useMemo, useEffect, useRef, useState, type FC } from "react";
import {
  Box,
  Button,
  Flex,
  Group,
  Panel,
  PanelHeaderButton,
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

export interface TripsManagePanelProps {
  id: string;
  onOpenTrip: (trip: Trip) => void;
  onOpenCreateTrip: () => void;
}

type DriverTripTab = "active" | "archive";

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
  } = useInfiniteMyTripsQuery();

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

  const myTrips = useMemo(() => {
    const trips = data?.pages.flatMap((page) => page.items) ?? [];
    return trips.filter((trip) => {
      if (tab === "active") return trip.status === "active";
      return trip.status === "completed" || trip.status === "cancelled";
    });
  }, [data, tab]);

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
                  requestsCount={trip.pendingRequestsCount ?? 0}
                  hideSeats
                  archivedStatus={
                    tab === "archive"
                      ? (trip.status as "completed" | "cancelled")
                      : undefined
                  }
                />
              ))}
              <div ref={sentinelRef} className="TripsManagePanel__sentinel" />
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
    </Panel>
  );
};
