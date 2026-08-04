import { type FC, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Caption,
  Card,
  Group,
  Panel,
  PanelHeaderBack,
  Separator,
  Spacing,
  Subhead,
  Text,
  Title,
} from "@vkontakte/vkui";
import type { Booking, BookingStatus, Trip } from "@/types";
import { RouteLine } from "@/components/RouteLine";
import { RatingBadge } from "@/components/RatingBadge";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import {
  useMyBookingsQuery,
  useCancelBookingMutation,
} from "@/queries/useBookingsQuery";
import { useSnackbarStore } from "@/store/useSnackbarStore";

export interface MyBookingsPanelProps {
  id: string;
  onBack: () => void;
  onOpenTrip: (trip: Trip) => void;
  onGoSearch: () => void;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Ждёт подтверждения",
  confirmed: "Подтверждена",
  declined: "Отклонена",
};

function getStatusWeight(status: BookingStatus): number {
  if (status === "pending") return 0;
  if (status === "confirmed") return 1;
  return 2;
}

function getStatusColor(status: BookingStatus): string {
  if (status === "confirmed") {
    return "var(--carpool_accent)";
  }

  if (status === "declined") {
    return "var(--vkui--color_text_negative)";
  }

  return "var(--vkui--color_text_accent, #3f8ae0)";
}

const BookingCard: FC<{
  booking: Booking;
  onOpenTrip: (trip: Trip) => void;
  onCancel: (booking: Booking) => void;
  isCancelling: boolean;
}> = ({ booking, onOpenTrip, onCancel, isCancelling }) => {
  const trip = booking.trip;

  const canCancel =
    (booking.status === "pending" || booking.status === "confirmed") &&
    trip.status !== "cancelled";

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
            <Avatar src={trip.driver.avatar} size={32} />

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
              style={{ color: getStatusColor(booking.status) }}
            >
              {STATUS_LABEL[booking.status]}
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

        {canCancel && (
          <div style={{ marginTop: 12 }}>
            <Button
              size="s"
              mode="secondary"
              appearance="negative"
              loading={isCancelling}
              disabled={isCancelling}
              onClick={(e) => {
                e.stopPropagation();
                onCancel(booking);
              }}
            >
              Отменить заявку
            </Button>
          </div>
        )}
      </Box>
    </Card>
  );
};

/**
 * Экран «Мои брони пассажира».
 *
 * Данные берутся из:
 * GET /api/bookings/my
 *
 * Отмена брони:
 * PATCH /api/bookings/:id/cancel
 */
export const MyBookingsPanel: FC<MyBookingsPanelProps> = ({
  id,
  onBack,
  onOpenTrip,
  onGoSearch,
}) => {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useMyBookingsQuery();

  const cancelBooking = useCancelBookingMutation();
  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const bookings = [...(data ?? [])].sort((a, b) => {
    return getStatusWeight(a.status) - getStatusWeight(b.status);
  });

  const handleCancelBooking = (booking: Booking) => {
    setCancellingId(booking.id);

    cancelBooking.mutate(booking.id, {
      onSettled: () => {
        setCancellingId(null);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Бронь отменена",
          subtitle: "Место освобождено",
          dedupeKey: `cancel_booking_${booking.id}`,
        });
      },
      onError: (cancelError) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось отменить бронь",
          subtitle:
            cancelError instanceof Error ? cancelError.message : undefined,
          dedupeKey: `cancel_booking_error_${booking.id}`,
        });
      },
    });
  };

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Мои брони
      </AppPanelHeader>

      <Group>
        {isLoading && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            aria-busy="true"
            aria-label="Загрузка бронирований"
          >
            <TripCardSkeleton />
            <TripCardSkeleton />
          </Box>
        )}

        {isError && (
          <EmptyState
            title="Не удалось загрузить брони"
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

        {!isLoading && !isError && bookings.length > 0 && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onOpenTrip={onOpenTrip}
                onCancel={handleCancelBooking}
                isCancelling={cancellingId === booking.id}
              />
            ))}
          </Box>
        )}

        {!isLoading && !isError && bookings.length === 0 && (
          <EmptyState
            title="У вас пока нет бронирований"
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
      </Group>

      <Spacing size={24} />
    </Panel>
  );
};
