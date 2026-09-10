import { useState } from "react";
import { Button, Input, List, Section } from "@telegram-apps/telegram-ui";
import {
  MAX_SEATS,
  updateTripDtoSchema,
  type Trip,
  type TripTag,
} from "@edem/contracts";
import { TRIP_TAGS } from "@/consts/tags";
import { bookingErrorMessage } from "@/helpers/bookingErrors";
import { useUpdateTripMutation } from "@/queries/useTripsQuery";

function toDateTimeLocal(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Inline-редактирование поездки водителем (паритет VK EditTripModal).
 * Маршрут заблокирован сервером (strict-схема отвергает fromCity/toCity) —
 * UI его не показывает, отправляет только разрешённые поля.
 */
export function EditTripForm({
  trip,
  onDone,
}: {
  trip: Trip;
  onDone: () => void;
}) {
  const update = useUpdateTripMutation();
  const [fromAddress, setFromAddress] = useState(trip.fromAddress ?? "");
  const [toAddress, setToAddress] = useState(trip.toAddress ?? "");
  const [departure, setDeparture] = useState(toDateTimeLocal(trip.departureAt));
  const [durationHours, setDurationHours] = useState(
    String(Math.max(1, Math.round(trip.durationMinutes / 60))),
  );
  const [distanceKm, setDistanceKm] = useState(String(trip.distanceKm));
  const [price, setPrice] = useState(String(trip.price));
  const [seats, setSeats] = useState(String(trip.seatsTotal));
  const [tags, setTags] = useState<TripTag[]>([...(trip.tags ?? [])]);
  const [comment, setComment] = useState(trip.comment ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleTag = (tag: TripTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const submit = () => {
    setValidationError(null);
    const departureAt = new Date(departure);
    if (!Number.isFinite(departureAt.getTime()) || departureAt <= new Date()) {
      setValidationError("Укажите будущие дату и время отправления");
      return;
    }
    const parsed = updateTripDtoSchema.safeParse({
      fromAddress: fromAddress.trim(),
      toAddress: toAddress.trim(),
      departureAt: departureAt.toISOString(),
      durationMinutes: Number(durationHours) * 60,
      distanceKm: Number(distanceKm),
      price: Number(price),
      seatsTotal: Number(seats),
      tags,
      comment: comment.trim() ? comment.trim() : undefined,
    });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Проверьте данные поездки",
      );
      return;
    }
    update.mutate(
      { id: trip.id, data: parsed.data },
      { onSuccess: () => onDone() },
    );
  };

  return (
    <Section header="Редактировать поездку">
      <List>
        <p>Маршрут изменить нельзя — только адреса, время и условия.</p>
        <label className="FormField">
          Адрес отправления
          <Input
            value={fromAddress}
            onChange={(event) => setFromAddress(event.target.value)}
            placeholder="Например: м. Тёплый Стан"
          />
        </label>
        <label className="FormField">
          Адрес назначения
          <Input
            value={toAddress}
            onChange={(event) => setToAddress(event.target.value)}
            placeholder="Например: пр-т Ленина"
          />
        </label>
        <label className="FormField">
          Дата и время
          <Input
            type="datetime-local"
            value={departure}
            onChange={(event) => setDeparture(event.target.value)}
          />
        </label>
        <label className="FormField">
          Время в пути, часов
          <Input
            type="number"
            min="1"
            max="168"
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
          />
        </label>
        <label className="FormField">
          Расстояние, км
          <Input
            type="number"
            min="1"
            max="20000"
            value={distanceKm}
            onChange={(event) => setDistanceKm(event.target.value)}
          />
        </label>
        <label className="FormField">
          Цена, ₽
          <Input
            type="number"
            min="1"
            max="100000"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className="FormField">
          Места (1–{MAX_SEATS})
          <Input
            type="number"
            min="1"
            max={MAX_SEATS}
            value={seats}
            onChange={(event) => setSeats(event.target.value)}
          />
        </label>
        <fieldset className="FormField">
          <legend>Особенности</legend>
          {TRIP_TAGS.map((tag) => (
            <label key={tag}>
              <input
                type="checkbox"
                checked={tags.includes(tag)}
                onChange={() => toggleTag(tag)}
              />
              {tag}
            </label>
          ))}
        </fieldset>
        <label className="FormField">
          Комментарий пассажирам
          <textarea
            value={comment}
            maxLength={500}
            rows={3}
            placeholder="Например: одна остановка в пути, багажник свободен"
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        {validationError && (
          <p className="FormError" role="alert">
            {validationError}
          </p>
        )}
        {update.error && (
          <p className="FormError" role="alert">
            {bookingErrorMessage(update.error)}
          </p>
        )}
        <div className="ButtonRow">
          <Button stretched loading={update.isPending} onClick={submit}>
            Сохранить
          </Button>
          <Button mode="outline" stretched disabled={update.isPending} onClick={onDone}>
            Отмена
          </Button>
        </div>
      </List>
    </Section>
  );
}
