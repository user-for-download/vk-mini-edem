// mini-app/src/views/ActionView/panels/TripRequestsPanel/TripRequestsPanel.tsx
import { type FC, memo } from "react";
import {
  Avatar,
  Button,
  Caption,
  Box,
  Group,
  Panel,
  PanelHeaderBack,
  PanelHeaderContent,
  Separator,
  Subhead,
  Text,
} from "@vkontakte/vkui";
import type { DriverBookingAction } from "@edem/contracts";
import type { Booking, BookingStatus, Trip } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";

export interface TripRequestsPanelProps {
  id: string;
  trip: Trip | null;
  bookings: Booking[];
  isLoading: boolean;
  isError: boolean;
  onBack: () => void;
  onSetStatus: (bookingId: string, status: DriverBookingAction) => void;
  onRetry: () => void;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Ждёт решения",
  confirmed: "Подтверждено",
  declined: "Отклонено",
  cancelled: "Отменена",
};

const BookingRequestRow: FC<{
  booking: Booking;
  onSetStatus: (bookingId: string, status: DriverBookingAction) => void;
}> = memo(({ booking, onSetStatus }) => {
  const statusColor =
    booking.status === "confirmed"
      ? "var(--carpool_accent)"
      : booking.status === "declined"
        ? "var(--vkui--color_text_secondary)"
        : "var(--vkui--color_text_accent, #3f8ae0)";

  return (
    <>
      <Box padding="system" style={{ display: "flex", gap: 10 }}>
        <Avatar src={booking.passenger.avatar} size={44} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text weight="2">{booking.passenger.name}</Text>
            <Caption
              level="1"
              style={{
                color: "var(--vkui--color_text_secondary)",
                flexShrink: 0,
              }}
            >
              Место {booking.seat}
            </Caption>
          </div>

          <RatingBadge
            value={booking.passenger.rating}
            reviewsCount={booking.passenger.reviewsCount}
            size="s"
          />

          {booking.comment && (
            <Text
              style={{
                marginTop: 6,
                color: "var(--vkui--color_text_secondary)",
              }}
            >
              «{booking.comment}»
            </Text>
          )}

          {booking.status === "pending" ? (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button
                size="s"
                mode="primary"
                appearance="positive"
                onClick={() => onSetStatus(booking.id, "confirmed")}
              >
                Подтвердить
              </Button>

              <Button
                size="s"
                mode="secondary"
                appearance="negative"
                onClick={() => onSetStatus(booking.id, "declined")}
              >
                Отклонить
              </Button>
            </div>
          ) : (
            <Subhead weight="2" style={{ color: statusColor, marginTop: 8 }}>
              {STATUS_LABEL[booking.status]}
            </Subhead>
          )}
        </div>
      </Box>

      <Separator />
    </>
  );
});

BookingRequestRow.displayName = "BookingRequestRow";

export const TripRequestsPanel: FC<TripRequestsPanelProps> = ({
  id,
  trip,
  bookings,
  isLoading,
  isError,
  onBack,
  onSetStatus,
  onRetry,
}) => {
  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        <PanelHeaderContent
          subtitle={
            trip
              ? `${trip.fromCity} → ${trip.toCity}, ${trip.date}`
              : undefined
          }
        >
          Заявки
        </PanelHeaderContent>
      </AppPanelHeader>

      <Group>
        {isLoading && (
          <Box padding="system">
            <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
              Загрузка заявок...
            </Text>
          </Box>
        )}

        {isError && (
          <EmptyState
            title="Не удалось загрузить заявки"
            subtitle="Попробуйте обновить страницу или повторить позже"
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={onRetry}>
                  Попробовать снова
                </Button>
              </Box>
            }
          />
        )}

        {!isLoading && !isError && bookings.length > 0 && (
          <Box aria-live="polite" aria-label={`Список заявок, ${bookings.length}`}>
            {bookings.map((booking) => (
              <BookingRequestRow
                key={booking.id}
                booking={booking}
                onSetStatus={onSetStatus}
              />
            ))}
          </Box>
        )}

        {!isLoading && !isError && bookings.length === 0 && (
          <EmptyState
            title="Заявок пока нет"
            subtitle="Как только кто-то отправит заявку, она появится здесь"
          />
        )}
      </Group>
    </Panel>
  );
};
