// mini-app/src/views/ActionView/panels/TripsManagePanel/TripsManagePanel.tsx
import { useMemo, useEffect, useRef, type FC } from "react";
import {
  Box,
  Button,
  Group,
  Panel,
  PanelHeaderButton,
  Spacing,
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
  onOpenTripRequests: (trip: Trip) => void;
  onOpenCreateTrip: () => void;
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
  onOpenTripRequests,
  onOpenCreateTrip,
}) => {
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

    /**
     * Активные поездки показываем выше.
     */
    return [...trips].sort((a, b) => {
      const aWeight = a.status === "active" ? 0 : 1;
      const bWeight = b.status === "active" ? 0 : 1;

      return aWeight - bWeight;
    });
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

      <Group>
        {isLoading && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            aria-busy="true"
            aria-label="Загрузка списка поездок"
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

        {!isLoading && !isError && myTrips.length > 0 && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {myTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onOpen={onOpenTripRequests}
                requestsCount={trip.pendingRequestsCount ?? 0}
                hideSeats
              />
            ))}
            <div ref={sentinelRef} style={{ height: 1 }} />
            {isFetchingNextPage && <TripCardSkeleton />}
          </Box>
        )}

        {!isLoading && !isError && myTrips.length === 0 && (
          <EmptyState
            title="Пока нет поездок"
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
      </Group>

      <Spacing size={24} />
    </Panel>
  );
};

