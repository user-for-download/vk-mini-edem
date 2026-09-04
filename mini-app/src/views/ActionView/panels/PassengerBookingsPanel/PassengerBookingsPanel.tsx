// mini-app/src/views/ActionView/panels/PassengerBookingsPanel/PassengerBookingsPanel.tsx
import { useMemo, useState, type FC } from "react";
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
import { useMyBookingsQuery } from "@/queries/useBookingsQuery";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import type { PassengerBookingScope } from "@/types";

// VKUI SegmentedControl принимает mutable-массив options — разовый спред
// статичного списка (вычисляется один раз на уровне модуля).
const BOOKING_SCOPE_OPTIONS: Array<{ label: string; value: PassengerBookingScope }> = [
  { label: "Активные", value: "active" },
  { label: "История", value: "history" },
];

export interface PassengerBookingsPanelProps {
  id: string;
  onBack: () => void;
  onOpenTrip: (trip: Trip) => void;
  onOpenReview: (trip: Trip) => void;
  onGoSearch: () => void;
}

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

  const { isRefreshing, handleRefresh } = usePullToRefresh(refetch);

  const visibleBookings = useMemo(() => {
    const bookings = (data ?? []).filter(
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

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
      <div>
      <Group>
        <Box padding="system">
          <SegmentedControl<PassengerBookingScope>
            value={tab}
            onChange={(value) => setTab(value)}
            options={[...BOOKING_SCOPE_OPTIONS]}
          />
        </Box>
      </Group>

      <Group>
        {isLoading && (
          <Box padding="system">
            <Flex direction="column" gap={12} aria-busy="true">
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

        {!isLoading && !isError && visibleBookings.length > 0 && (
          <Box padding="system">
            <Flex
              direction="column"
              gap={12}
              aria-live="polite"
              aria-label={`Список поездок, всего ${visibleBookings.length}`}
            >
              {visibleBookings.map((booking) => (
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

        {!isLoading && !isError && visibleBookings.length === 0 && tab === "active" && (
          <EmptyState
            title="Нет активных броней"
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
            title="История пуста"
            subtitle="Здесь будут ваши прошлые поездки"
          />
        )}
      </Group>

      <Spacing size={24} />
      </div>
      </PullToRefresh>
    </Panel>
  );
};
