import { Button, Cell, List, Section } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmAction } from "@/components/ConfirmAction";
import { OfflineBanner } from "@/components/OfflineBanner";
import { QueryState } from "@/components/QueryState";
import { bookingErrorMessage } from "@/helpers/bookingErrors";
import { useCancelBookingMutation, useMyBookingsQuery } from "@/queries/useBookingsQuery";

/**
 * Активные брони пассажира: открытие поездки, отмена через confirm-guard
 * (паритет VK TripDetailsPanel.cancelMyBooking), retry/offline/conflict.
 */
export function PassengerBookingsPage() {
  const navigate = useNavigate();
  const bookings = useMyBookingsQuery();
  const cancel = useCancelBookingMutation();
  return (
    <>
      <PageHeader title="Мои брони" action={{ label: "История", to: "/bookings/history" }} />
      <OfflineBanner />
      {cancel.error && (
        <p className="FormError" role="alert">
          {bookingErrorMessage(cancel.error)}
        </p>
      )}
      <QueryState loading={bookings.isLoading} error={bookings.error} empty={!bookings.data?.length} emptyText="У вас пока нет активных броней." onRetry={() => void bookings.refetch()}>
        <List>
          {bookings.data?.map((booking) => (
            <Section key={booking.id}>
              <Cell
                subtitle={`Статус: ${booking.status} · место №${booking.seat}${booking.comment ? ` · «${booking.comment}»` : ""}`}
              >
                {booking.trip.fromCity} → {booking.trip.toCity}
              </Cell>
              <Button mode="plain" stretched onClick={() => navigate(`/trips/${booking.trip.id}`)}>
                Открыть поездку
              </Button>
              {(booking.status === "pending" || booking.status === "confirmed") && (
                <ConfirmAction
                  label="Отменить заявку"
                  confirmLabel="Отменить бронь"
                  description="Заявка будет отменена, а место снова станет доступно."
                  pending={cancel.isPending}
                  onConfirm={() => cancel.mutate(booking.id)}
                />
              )}
            </Section>
          ))}
        </List>
      </QueryState>
    </>
  );
}
