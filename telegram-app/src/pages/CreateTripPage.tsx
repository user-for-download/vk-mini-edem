import { useState } from "react";
import { Button, Input, List, Placeholder, Section } from "@telegram-apps/telegram-ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { MutationError } from "@/components/MutationError";
import { useAllCitiesQuery } from "@/queries/useAllCities";
import { useCreateTripMutation } from "@/queries/useTripsQuery";
import { createTripDtoSchema } from "@edem/contracts";

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

export function CreateTripPage() {
  const navigate = useNavigate();
  const cities = useAllCitiesQuery();
  const create = useCreateTripMutation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [date, setDate] = useState(tomorrow().slice(0, 16));
  const [durationHours, setDurationHours] = useState("1");
  const [distanceKm, setDistanceKm] = useState("");
  const [price, setPrice] = useState("500");
  const [seats, setSeats] = useState("1");
  const [validationError, setValidationError] = useState<string | null>(null);
  const fromCity = cities.data?.find((city) => city.name === from);
  const toCity = cities.data?.find((city) => city.name === to);
  const submit = () => {
    setValidationError(null);
    if (!fromCity || !toCity) {
      setValidationError("Выберите города из справочника");
      return;
    }
    const departureAt = new Date(date);
    if (!Number.isFinite(departureAt.getTime()) || departureAt <= new Date()) {
      setValidationError("Укажите будущие дату и время отправления");
      return;
    }
    const parsed = createTripDtoSchema.safeParse({
      fromCity: fromCity.name,
      toCity: toCity.name,
      fromCityId: fromCity.id,
      toCityId: toCity.id,
      fromAddress: fromAddress.trim(),
      toAddress: toAddress.trim(),
      departureAt: departureAt.toISOString(),
      durationMinutes: Number(durationHours) * 60,
      distanceKm: Number(distanceKm),
      price: Number(price),
      seatsTotal: Number(seats),
      tags: [],
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Проверьте данные поездки");
      return;
    }
    create.mutate(parsed.data, { onSuccess: (trip) => navigate(`/trips/${trip.id}`) });
  };
  if (cities.isLoading) return <Placeholder>Загружаем города…</Placeholder>;
  return <><PageHeader title="Создать поездку" /><Section><List><label className="FormField">Город отправления<Input list="trip-cities" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="FormField">Адрес отправления<Input value={fromAddress} onChange={(event) => setFromAddress(event.target.value)} /></label><label className="FormField">Город назначения<Input list="trip-cities" value={to} onChange={(event) => setTo(event.target.value)} /></label><label className="FormField">Адрес назначения<Input value={toAddress} onChange={(event) => setToAddress(event.target.value)} /></label><datalist id="trip-cities">{cities.data?.map((city) => <option key={city.id} value={city.name} />)}</datalist><label className="FormField">Дата и время<Input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="FormField">Время в пути, часов<Input type="number" min="1" max="168" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} /></label><label className="FormField">Расстояние, км<Input type="number" min="1" max="20000" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} /></label><label className="FormField">Цена, ₽<Input type="number" min="1" max="100000" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="FormField">Места<Input type="number" min="1" max="3" value={seats} onChange={(event) => setSeats(event.target.value)} /></label>{validationError && <p className="FormError" role="alert">{validationError}</p>}<MutationError error={create.error} /><Button stretched loading={create.isPending} onClick={submit}>Опубликовать</Button></List></Section></>;
}
