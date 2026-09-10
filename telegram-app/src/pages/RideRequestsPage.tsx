import { useState } from "react";
import { Button, Cell, Input, List, Section } from "@telegram-apps/telegram-ui";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { ConfirmAction } from "@/components/ConfirmAction";
import { OfflineBanner } from "@/components/OfflineBanner";
import { bookingErrorMessage } from "@/helpers/bookingErrors";
import { useAllCitiesQuery } from "@/queries/useAllCities";
import {
  useCancelRideRequestMutation,
  useCreateRideRequestMutation,
  useRideRequestStatusMutation,
  useRideRequestsQuery,
  useUpdateRideRequestMutation,
} from "@/queries/useRideRequestsQuery";
import {
  createRideRequestDtoSchema,
  updateRideRequestDtoSchema,
  type RideRequest,
} from "@edem/contracts";

function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Запросы «Ищу попутку» (паритет VK RideRequestsPanel): создание, inline-
 * редактирование (PATCH, строгая схема бэкенда), пауза/возобновление,
 * отмена через confirm-guard, retry/offline.
 */
export function RideRequestsPage() {
  const requests = useRideRequestsQuery();
  const cities = useAllCitiesQuery();
  const create = useCreateRideRequestMutation();
  const update = useUpdateRideRequestMutation();
  const status = useRideRequestStatusMutation();
  const cancel = useCancelRideRequestMutation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [earliest, setEarliest] = useState("");
  const [latest, setLatest] = useState("");
  const [seats, setSeats] = useState("1");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEarliest, setEditEarliest] = useState("");
  const [editLatest, setEditLatest] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [editSeats, setEditSeats] = useState("1");
  const [editError, setEditError] = useState<string | null>(null);

  const submit = () => {
    const fromCity = cities.data?.find((city) => city.name === from);
    const toCity = cities.data?.find((city) => city.name === to);
    const earliestDate = new Date(earliest);
    const latestDate = new Date(latest);
    if (!fromCity || !toCity || !Number.isFinite(earliestDate.getTime()) || !Number.isFinite(latestDate.getTime())) {
      setValidationError("Выберите города и временной интервал");
      return;
    }
    if (fromCity.id === toCity.id) {
      setValidationError("Города отправления и прибытия должны различаться");
      return;
    }
    const parsed = createRideRequestDtoSchema.safeParse({ fromCityId: fromCity.id, toCityId: toCity.id, earliestAt: earliestDate.toISOString(), latestAt: latestDate.toISOString(), expiresAt: earliestDate.toISOString(), seats: Number(seats) });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Проверьте параметры запроса");
      return;
    }
    setValidationError(null);
    create.mutate(parsed.data, { onSuccess: () => { setFrom(""); setTo(""); setEarliest(""); setLatest(""); } });
  };

  const startEdit = (request: RideRequest) => {
    setEditingId(request.id);
    setEditError(null);
    setEditEarliest(toDateTimeLocal(request.earliestAt));
    setEditLatest(toDateTimeLocal(request.latestAt));
    setEditExpires(request.expiresAt ? toDateTimeLocal(request.expiresAt) : "");
    setEditSeats(String(request.seats));
  };

  const submitEdit = (requestId: string) => {
    setEditError(null);
    const earliestDate = new Date(editEarliest);
    const latestDate = new Date(editLatest);
    const expiresDate = new Date(editExpires);
    if (
      !Number.isFinite(earliestDate.getTime()) ||
      !Number.isFinite(latestDate.getTime()) ||
      !Number.isFinite(expiresDate.getTime()) ||
      earliestDate >= latestDate ||
      expiresDate <= new Date()
    ) {
      setEditError("Срок действия должен быть в будущем, а окно отправления — корректным");
      return;
    }
    const parsed = updateRideRequestDtoSchema.safeParse({
      earliestAt: earliestDate.toISOString(),
      latestAt: latestDate.toISOString(),
      expiresAt: expiresDate.toISOString(),
      seats: Number(editSeats),
    });
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "Проверьте параметры запроса");
      return;
    }
    update.mutate(
      { id: requestId, data: parsed.data },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <>
      <PageHeader title="Ищу попутку" />
      <OfflineBanner />
      <Section header="Новый запрос">
        <List>
          <label className="FormField">Откуда<Input list="request-cities" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="FormField">Куда<Input list="request-cities" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <datalist id="request-cities">{cities.data?.map((city) => <option key={city.id} value={city.name} />)}</datalist>
          <label className="FormField">Не раньше<Input type="datetime-local" value={earliest} onChange={(event) => setEarliest(event.target.value)} /></label>
          <label className="FormField">Не позже<Input type="datetime-local" value={latest} onChange={(event) => setLatest(event.target.value)} /></label>
          <label className="FormField">Места<Input type="number" min="1" max="3" value={seats} onChange={(event) => setSeats(event.target.value)} /></label>
          {validationError && <p className="FormError" role="alert">{validationError}</p>}
          {create.error && <p className="FormError" role="alert">{bookingErrorMessage(create.error)}</p>}
          <Button stretched loading={create.isPending} onClick={submit}>Опубликовать запрос</Button>
        </List>
      </Section>
      {(status.error || cancel.error || update.error) && (
        <p className="FormError" role="alert">
          {bookingErrorMessage(status.error ?? cancel.error ?? update.error)}
        </p>
      )}
      <QueryState loading={requests.isLoading} error={requests.error} empty={!requests.data?.length} emptyText="Активных запросов нет." onRetry={() => void requests.refetch()}>
        <List>
          {requests.data?.map((request) => (
            <Section key={request.id}>
              <Cell subtitle={`${request.earliestAt} — ${request.latestAt} · ${request.seats} мест`}>
                {request.fromCity.name} → {request.toCity.name}
              </Cell>
              {editingId === request.id ? (
                <>
                  <label className="FormField">Не раньше<Input type="datetime-local" value={editEarliest} onChange={(event) => setEditEarliest(event.target.value)} /></label>
                  <label className="FormField">Не позже<Input type="datetime-local" value={editLatest} onChange={(event) => setEditLatest(event.target.value)} /></label>
                  <label className="FormField">Действует до<Input type="datetime-local" value={editExpires} onChange={(event) => setEditExpires(event.target.value)} /></label>
                  <label className="FormField">Места<Input type="number" min="1" max="3" value={editSeats} onChange={(event) => setEditSeats(event.target.value)} /></label>
                  {editError && <p className="FormError" role="alert">{editError}</p>}
                  <div className="ButtonRow">
                    <Button stretched loading={update.isPending} onClick={() => submitEdit(request.id)}>Сохранить</Button>
                    <Button mode="outline" stretched disabled={update.isPending} onClick={() => setEditingId(null)}>Отмена</Button>
                  </div>
                </>
              ) : (
                <>
                  {request.status === "active" && (
                    <Button mode="outline" stretched loading={status.isPending && status.variables?.id === request.id} disabled={status.isPending || cancel.isPending} onClick={() => status.mutate({ id: request.id, status: "paused" })}>
                      Поставить на паузу
                    </Button>
                  )}
                  {request.status === "paused" && (
                    <Button mode="outline" stretched loading={status.isPending && status.variables?.id === request.id} disabled={status.isPending || cancel.isPending} onClick={() => status.mutate({ id: request.id, status: "active" })}>
                      Возобновить
                    </Button>
                  )}
                  {(request.status === "active" || request.status === "paused") && (
                    <>
                      <Button mode="outline" stretched disabled={status.isPending || cancel.isPending} onClick={() => startEdit(request)}>
                        Редактировать
                      </Button>
                      <ConfirmAction
                        label="Отменить запрос"
                        confirmLabel="Отменить запрос"
                        description="Запрос будет снят с публикации."
                        pending={cancel.isPending}
                        onConfirm={() => cancel.mutate(request.id)}
                      />
                    </>
                  )}
                </>
              )}
            </Section>
          ))}
        </List>
      </QueryState>
    </>
  );
}
