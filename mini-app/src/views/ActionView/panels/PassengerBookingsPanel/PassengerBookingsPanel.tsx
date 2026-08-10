// mini-app/src/views/ActionView/panels/PassengerBookingsPanel/PassengerBookingsPanel.tsx
import { type FC, useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Caption,
  Flex,
  Group,
  Panel,
  PanelHeaderBack,
  PullToRefresh,
  SegmentedControl,
  Spacing,
  Subhead,
  Text,
} from "@vkontakte/vkui";
import type { PassengerBooking, PassengerBookingScope, Trip } from "@/types";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
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
  if (booking.status === "confirmed") {
    // «Завершена» только когда поездка реально завершена: воркер
    // автозавершения может ещё не отработать, хотя бронь уже в истории.
    if (booking.scope === "history" && booking.trip.status === "completed") {
      return "Завершена";
    }
    return "Подтверждена";
  }
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

const BookingCardFooter: FC<{
  booking: PassengerBooking;
  onOpenReview: (trip: Trip) => void;
}> = ({ booking, onOpenReview }) => {
  return (
    <>
      <Flex justify="space-between" align="center">
        <Caption level="1" weight="2">
          Место {booking.seat}
        </Caption>
        <Subhead weight="2" style={{ color: getStatusColor(booking) }}>
          {getStatusLabel(booking)}
        </Subhead>
      </Flex>

      {booking.comment && (
        <Text className="PassengerBookingsPanel__comment">
          «{booking.comment}»
        </Text>
      )}

      {booking.scope === "history" && booking.canReview && (
        <>
          <Spacing size={12} />
          <Button
            size="s"
            mode="primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReview(booking.trip);
            }}
          >
            Оставить отзыв
          </Button>
        </>
      )}

      {booking.scope === "history" && booking.hasReview && (
        <Caption level="1" className="PassengerBookingsPanel__comment">
          Отзыв оставлен
        </Caption>
      )}
    </>
  );
};

BookingCardFooter.displayName = "BookingCardFooter";

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
    isFetching,
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

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const isRefreshing = isFetching && !isLoading;

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Мои поездки
      </AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
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
              <TripCard
                key={booking.id}
                trip={booking.trip}
                onOpen={() => onOpenTrip(booking.trip)}
                hideSeats
              >
                <BookingCardFooter
                  booking={booking}
                  onOpenReview={onOpenReview}
                />
              </TripCard>
            ))}
            </Flex>
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
      </PullToRefresh>
    </Panel>
  );
};
