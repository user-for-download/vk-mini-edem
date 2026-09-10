import { useState } from "react";
import { Button, Cell, List, Section } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmAction } from "@/components/ConfirmAction";
import { OfflineBanner } from "@/components/OfflineBanner";
import { QueryState } from "@/components/QueryState";
import { TripCard } from "@/components/TripCard";
import { bookingErrorMessage } from "@/helpers/bookingErrors";
import {
  useCancelTripMutation,
  useCompleteTripMutation,
  useInfiniteMyTripsQuery,
} from "@/queries/useTripsQuery";
import type { Trip } from "@edem/contracts";

type DriverTripTab = "active" | "archive";

function seatsLabel(trip: Trip): string {
  const pending = trip.pendingRequestsCount ?? 0;
  const confirmed = trip.confirmedBookingsCount ?? 0;
  if (pending > 0) return `Заявки: ${pending}`;
  if (confirmed > 0) return `Забронировано: ${confirmed}`;
  return `Свободно: ${trip.seatsAvailable}`;
}

/**
 * Поездки водителя (паритет VK TripsManagePanel): вкладки active/archive
 * (фильтр — на бэкенде), счётчики заявок, confirm-guards, retry/offline.
 */
export function MyTripsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DriverTripTab>("active");
  const trips = useInfiniteMyTripsQuery({ status: tab });
  const cancel = useCancelTripMutation();
  const complete = useCompleteTripMutation();
  const items = trips.data?.pages.flatMap((page) => page.items) ?? [];
  const mutationError = cancel.error ?? complete.error;

  return (
    <>
      <PageHeader title="Мои поездки" action={{ label: "Создать", to: "/trips/my/new" }} />
      <OfflineBanner />
      <Section>
        <List>
          <div className="ButtonRow" role="tablist" aria-label="Поездки водителя">
            <Button
              role="tab"
              aria-selected={tab === "active"}
              mode={tab === "active" ? undefined : "outline"}
              stretched
              onClick={() => setTab("active")}
            >
              Активные
            </Button>
            <Button
              role="tab"
              aria-selected={tab === "archive"}
              mode={tab === "archive" ? undefined : "outline"}
              stretched
              onClick={() => setTab("archive")}
            >
              Архив
            </Button>
          </div>
        </List>
      </Section>
      {mutationError && (
        <p className="FormError" role="alert">
          {bookingErrorMessage(mutationError)}
        </p>
      )}
      <QueryState
        loading={trips.isLoading}
        error={trips.error}
        empty={!items.length}
        emptyText={
          tab === "active"
            ? "Нет активных поездок. Создайте первую поездку."
            : "Архив пуст. Здесь будут завершённые и отменённые поездки."
        }
        onRetry={() => void trips.refetch()}
      >
        <List>
          {items.map((trip) => (
            <div key={trip.id}>
              <TripCard trip={trip} />
              <Cell subtitle={seatsLabel(trip)}>
                {trip.status === "completed"
                  ? "Завершена"
                  : trip.status === "cancelled"
                    ? "Отменена"
                    : `${trip.fromCity} → ${trip.toCity}`}
              </Cell>
              <div className="ButtonRow">
                <Button mode="outline" stretched onClick={() => navigate(`/trips/${trip.id}`)}>
                  Детали
                </Button>
                <Button mode="outline" stretched onClick={() => navigate(`/trips/my/${trip.id}/requests`)}>
                  Заявки{(trip.pendingRequestsCount ?? 0) > 0 ? ` (${trip.pendingRequestsCount})` : ""}
                </Button>
              </div>
              {trip.status !== "cancelled" && trip.status !== "completed" && (
                <div className="ButtonRow">
                  <ConfirmAction
                    label="Завершить"
                    confirmLabel="Завершить"
                    description="Поездка будет перенесена в архив, а пассажиры смогут оставить отзывы."
                    pending={complete.isPending}
                    onConfirm={() => complete.mutate(trip.id)}
                  />
                  <ConfirmAction
                    label="Отменить"
                    confirmLabel="Отменить поездку"
                    description="Поездка станет недоступна, а пассажиры получат уведомление об отмене."
                    pending={cancel.isPending}
                    onConfirm={() => cancel.mutate(trip.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </List>
        {trips.hasNextPage && (
          <Button stretched onClick={() => void trips.fetchNextPage()} disabled={trips.isFetchingNextPage}>
            Показать ещё
          </Button>
        )}
      </QueryState>
    </>
  );
}
