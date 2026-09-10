import { useState } from "react";
import { Button, Cell, List } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { QueryState } from "@/components/QueryState";
import { usePassengerHistoryQuery } from "@/queries/useBookingsQuery";

type HistoryFilter = "all" | "completed" | "cancelled";

const FILTER_LABELS: Record<HistoryFilter, string> = {
  all: "Все",
  completed: "Завершённые",
  cancelled: "Отменённые",
};

/**
 * История поездок пассажира (паритет VK PassengerHistoryPanel): фильтры
 * all/completed/cancelled по historyCategory, сортировка по отправлению,
 * переход в детали поездки, retry/offline.
 */
export function HistoryPage() {
  const navigate = useNavigate();
  const history = usePassengerHistoryQuery();
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const visible = (history.data ?? [])
    .filter((booking) => filter === "all" || booking.historyCategory === filter)
    .sort((a, b) => {
      const aTime = a.trip.departureAt ? Date.parse(a.trip.departureAt) : 0;
      const bTime = b.trip.departureAt ? Date.parse(b.trip.departureAt) : 0;
      return bTime - aTime;
    });

  return (
    <>
      <PageHeader title="История поездок" />
      <OfflineBanner />
      <div className="ButtonRow" role="tablist" aria-label="Фильтр истории">
        {(Object.keys(FILTER_LABELS) as HistoryFilter[]).map((value) => (
          <Button
            key={value}
            role="tab"
            aria-selected={filter === value}
            mode={filter === value ? undefined : "outline"}
            stretched
            onClick={() => setFilter(value)}
          >
            {FILTER_LABELS[value]}
          </Button>
        ))}
      </div>
      <QueryState
        loading={history.isLoading}
        error={history.error}
        empty={!visible.length}
        emptyText={
          filter === "all"
            ? "История пока пуста."
            : filter === "completed"
              ? "Нет завершённых поездок."
              : "Нет отменённых поездок."
        }
        onRetry={() => void history.refetch()}
      >
        <List>
          {visible.map((booking) => (
            <Cell
              key={booking.id}
              subtitle={`${booking.historyCategory ?? booking.status} · место №${booking.seat}`}
              onClick={() => navigate(`/trips/${booking.trip.id}`)}
            >
              {booking.trip.fromCity} → {booking.trip.toCity}
            </Cell>
          ))}
        </List>
      </QueryState>
    </>
  );
}
