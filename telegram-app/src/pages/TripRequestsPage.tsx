import { Button, Cell, List, Placeholder, Section, Spinner } from "@telegram-apps/telegram-ui";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { bookingErrorMessage, isAuthorizationError } from "@/helpers/bookingErrors";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTripBookingsQuery, useUpdateBookingStatusMutation } from "@/queries/useBookingsQuery";

/**
 * Заявки пассажиров (паритет VK TripDetailsPanel: управление заявками +
 * подтверждённые пассажиры). Бэкенд driver-only: чужой deep-link → 403
 * с явным authorization-состоянием.
 */
export function TripRequestsPage() {
  const { tripId = "" } = useParams();
  const navigate = useNavigate();
  const requests = useTripBookingsQuery(tripId);
  const update = useUpdateBookingStatusMutation();
  const { isOnline } = useOnlineStatus();

  if (requests.isLoading) {
    return (
      <>
        <PageHeader title="Заявки пассажиров" />
        <Placeholder><Spinner size="m" /></Placeholder>
      </>
    );
  }
  if (requests.isError) {
    const forbidden = isAuthorizationError(requests.error);
    return (
      <>
        <PageHeader title="Заявки пассажиров" />
        <OfflineBanner />
        <Placeholder
          header={forbidden ? "Нет доступа" : "Не удалось загрузить заявки"}
          description={
            forbidden
              ? "Заявки видит только водитель поездки."
              : bookingErrorMessage(requests.error)
          }
        >
          <div className="ButtonRow">
            {!forbidden && <Button onClick={() => void requests.refetch()}>Повторить</Button>}
            <Button mode="outline" onClick={() => navigate("/trips/my")}>К моим поездкам</Button>
          </div>
          {!isOnline && <p>Проверьте подключение к интернету.</p>}
        </Placeholder>
      </>
    );
  }

  const items = requests.data?.pages.flatMap((page) => page.items) ?? [];
  const pending = items.filter((booking) => booking.status === "pending");
  const confirmed = items.filter((booking) => booking.status === "confirmed");

  return (
    <>
      <PageHeader title="Заявки пассажиров" />
      <OfflineBanner />
      {update.error && (
        <p className="FormError" role="alert">
          {bookingErrorMessage(update.error)}
        </p>
      )}
      <List>
        {!items.length && <Placeholder header="Заявок нет" />}
        {pending.length > 0 && (
          <Section header={`Ожидают решения (${pending.length})`}>
            {pending.map((booking) => (
              <div key={booking.id}>
                <Cell subtitle={`${booking.passenger.name} · место ${booking.seat}${booking.comment ? ` · «${booking.comment}»` : ""}`}>
                  Ожидает решения
                </Cell>
                <div className="ButtonRow">
                  <Button
                    stretched
                    loading={update.isPending && update.variables?.id === booking.id}
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: booking.id, status: "confirmed" })}
                  >
                    Принять
                  </Button>
                  <Button
                    mode="outline"
                    stretched
                    loading={update.isPending && update.variables?.id === booking.id}
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: booking.id, status: "declined" })}
                  >
                    Отклонить
                  </Button>
                </div>
              </div>
            ))}
          </Section>
        )}
        {confirmed.length > 0 && (
          <Section header={`Подтверждены (${confirmed.length})`}>
            {confirmed.map((booking) => (
              <Cell key={booking.id} subtitle={`${booking.passenger.name} · место ${booking.seat}`}>
                Подтверждён
              </Cell>
            ))}
          </Section>
        )}
      </List>
      {requests.hasNextPage && (
        <Button stretched onClick={() => void requests.fetchNextPage()} disabled={requests.isFetchingNextPage}>
          Показать ещё
        </Button>
      )}
      <Button mode="outline" stretched onClick={() => navigate("/trips/my")}>
        К моим поездкам
      </Button>
    </>
  );
}
