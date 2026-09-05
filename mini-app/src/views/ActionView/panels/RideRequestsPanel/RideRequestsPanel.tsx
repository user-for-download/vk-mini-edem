import { type FC, useState } from "react";
import { Button, FormItem, Group, Input, Panel, PanelHeaderBack, Select, Spacing, Text } from "@vkontakte/vkui";
import { useAllCitiesQuery } from "@/queries/useAllCities";
import { useRideRequestsQuery, useCreateRideRequestMutation, useRideRequestStatusMutation, useCancelRideRequestMutation } from "@/queries/useRideRequestsQuery";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useSnackbar } from "@/providers/SnackbarProvider";

export interface RideRequestsPanelProps { id: string; onBack: () => void; }

export const RideRequestsPanel: FC<RideRequestsPanelProps> = ({ id, onBack }) => {
  const cities = useAllCitiesQuery();
  const requests = useRideRequestsQuery();
  const create = useCreateRideRequestMutation();
  const setStatus = useRideRequestStatusMutation();
  const cancel = useCancelRideRequestMutation();
  const { enqueue: notify } = useSnackbar();
  const [fromCityId, setFromCityId] = useState("");
  const [toCityId, setToCityId] = useState("");
  const [earliestAt, setEarliestAt] = useState("");
  const [latestAt, setLatestAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const submit = async () => {
    try {
      await create.mutateAsync({ fromCityId, toCityId, earliestAt: new Date(earliestAt).toISOString(), latestAt: new Date(latestAt).toISOString(), expiresAt: new Date(expiresAt).toISOString(), seats: 1 });
      setFromCityId(""); setToCityId(""); setEarliestAt(""); setLatestAt(""); setExpiresAt("");
      notify({ type: "success", title: "Запрос опубликован" });
    } catch (error) { notify({ type: "error", title: error instanceof Error ? error.message : "Не удалось создать запрос" }); }
  };
  const cityOptions = (cities.data ?? []).map((city) => ({ label: city.name, value: city.id }));

  return <Panel id={id}>
    <AppPanelHeader before={<PanelHeaderBack onClick={onBack} />}>Ищу попутку</AppPanelHeader>
    <Group header="Новый запрос">
      <FormItem top="Откуда"><Select value={fromCityId} onChange={(event) => setFromCityId(event.target.value)} options={cityOptions} placeholder="Выберите город" /></FormItem>
      <FormItem top="Куда"><Select value={toCityId} onChange={(event) => setToCityId(event.target.value)} options={cityOptions.filter((city) => city.value !== fromCityId)} placeholder="Выберите город" /></FormItem>
      <FormItem top="Время отправления от"><Input type="datetime-local" value={earliestAt} onChange={(event) => setEarliestAt(event.target.value)} /></FormItem>
      <FormItem top="Время отправления до"><Input type="datetime-local" value={latestAt} onChange={(event) => setLatestAt(event.target.value)} /></FormItem>
      <FormItem top="Запрос действует до"><Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></FormItem>
      <FormItem><Button stretched mode="primary" onClick={() => void submit()} loading={create.isPending} disabled={!fromCityId || !toCityId || !earliestAt || !latestAt || !expiresAt}>Опубликовать запрос</Button></FormItem>
    </Group>
    <Group header="Мои запросы">
      {requests.isLoading && <Text>Загрузка...</Text>}
      {!requests.isLoading && (requests.data ?? []).length === 0 && <Text>Активных запросов пока нет.</Text>}
      {(requests.data ?? []).map((request) => <FormItem key={request.id} top={`${request.fromCity.name} → ${request.toCity.name}`} bottom={`${new Date(request.earliestAt).toLocaleString("ru-RU")} · ${request.status}`}>
        {request.status === "active" && <Button size="s" mode="secondary" onClick={() => void setStatus.mutateAsync({ id: request.id, status: "paused" })}>Поставить на паузу</Button>}
        {request.status === "paused" && <Button size="s" mode="secondary" onClick={() => void setStatus.mutateAsync({ id: request.id, status: "active" })}>Возобновить</Button>}
        {(request.status === "active" || request.status === "paused") && <Button size="s" mode="tertiary" onClick={() => void cancel.mutateAsync(request.id)}>Отменить</Button>}
      </FormItem>)}
    </Group>
    <Spacing size={24} />
  </Panel>;
};
