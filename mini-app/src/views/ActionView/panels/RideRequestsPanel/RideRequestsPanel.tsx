import { type FC, useId, useState } from "react";
import {
  Button,
  FormItem,
  Group,
  Input,
  Panel,
  PanelHeaderBack,
  Select,
  Spacing,
  Text,
} from "@vkontakte/vkui";
import { useAllCitiesQuery } from "@/queries/useAllCities";
import {
  useRideRequestsQuery,
  useCreateRideRequestMutation,
  useRideRequestStatusMutation,
  useCancelRideRequestMutation,
} from "@/queries/useRideRequestsQuery";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { ApiError } from "@/api/client";
import { getErrorMessage } from "@/helpers/errorMessages";

export interface RideRequestsPanelProps {
  id: string;
  onBack: () => void;
}

export const RideRequestsPanel: FC<RideRequestsPanelProps> = ({
  id,
  onBack,
}) => {
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
  const [formError, setFormError] = useState<string | null>(null);

  // Связка FormItem htmlFor ↔ поле id (a11y, дока Select/FormItem).
  const fromCityFieldId = useId();
  const toCityFieldId = useId();
  const earliestFieldId = useId();
  const latestFieldId = useId();
  const expiresFieldId = useId();

  const submit = async () => {
    setFormError(null);
    try {
      if (fromCityId && fromCityId === toCityId) {
        const msg = "Города отправления и прибытия должны различаться";
        setFormError(msg);
        notify({ type: "error", title: msg });
        return;
      }
      const earliest = new Date(earliestAt);
      const latest = new Date(latestAt);
      const expires = new Date(expiresAt);
      if (
        ![earliest, latest, expires].every((date) =>
          Number.isFinite(date.getTime()),
        ) ||
        earliest >= latest ||
        expires <= new Date()
      ) {
        const msg =
          "Срок действия должен быть в будущем, а окно отправления — корректным";
        setFormError(msg);
        notify({
          type: "error",
          title: "Проверьте время запроса",
          subtitle: msg,
        });
        return;
      }
      await create.mutateAsync({
        fromCityId,
        toCityId,
        earliestAt: earliest.toISOString(),
        latestAt: latest.toISOString(),
        expiresAt: expires.toISOString(),
        seats: 1,
      });
      setFromCityId("");
      setToCityId("");
      setEarliestAt("");
      setLatestAt("");
      setExpiresAt("");
      notify({ type: "success", title: "Запрос опубликован" });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      const msg = getErrorMessage(
        code,
        error instanceof Error ? error.message : "Не удалось создать запрос",
      );
      setFormError(msg);
      notify({ type: "error", title: msg });
    }
  };

  const handleStatusChange = async (
    requestId: string,
    status: "active" | "paused",
  ) => {
    try {
      await setStatus.mutateAsync({ id: requestId, status });
      notify({
        type: "success",
        title: status === "paused" ? "Запрос на паузе" : "Запрос активен",
      });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify({
        type: "error",
        title: getErrorMessage(
          code,
          error instanceof Error ? error.message : "Не удалось изменить статус",
        ),
      });
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await cancel.mutateAsync(requestId);
      notify({ type: "success", title: "Запрос отменён" });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify({
        type: "error",
        title: getErrorMessage(
          code,
          error instanceof Error ? error.message : "Не удалось отменить запрос",
        ),
      });
    }
  };
  const cityOptions = (cities.data ?? []).map((city) => ({
    label: city.name,
    value: city.id,
  }));

  return (
    <Panel id={id}>
      <AppPanelHeader before={<PanelHeaderBack onClick={onBack} />}>
        Ищу попутку
      </AppPanelHeader>
      <Group header="Новый запрос">
        {/* Select onChange: значение берём из второго аргумента (дока Select) —
          event.target.value надёжен только для NativeSelect (мобилы). */}
        <FormItem top="Откуда" htmlFor={fromCityFieldId}>
          <Select
            id={fromCityFieldId}
            value={fromCityId}
            onChange={(_, v) => setFromCityId(String(v ?? ""))}
            options={cityOptions}
            placeholder="Выберите город"
          />
        </FormItem>
        <FormItem top="Куда" htmlFor={toCityFieldId}>
          <Select
            id={toCityFieldId}
            value={toCityId}
            onChange={(_, v) => setToCityId(String(v ?? ""))}
            options={cityOptions.filter((city) => city.value !== fromCityId)}
            placeholder="Выберите город"
          />
        </FormItem>
        <FormItem
          top="Время отправления от"
          htmlFor={earliestFieldId}
          status={formError ? "error" : "default"}
          bottom={formError ?? undefined}
        >
          <Input
            id={earliestFieldId}
            type="datetime-local"
            value={earliestAt}
            onChange={(event) => setEarliestAt(event.target.value)}
            aria-invalid={formError ? true : undefined}
          />
        </FormItem>
        <FormItem top="Время отправления до" htmlFor={latestFieldId}>
          <Input
            id={latestFieldId}
            type="datetime-local"
            value={latestAt}
            onChange={(event) => setLatestAt(event.target.value)}
          />
        </FormItem>
        <FormItem top="Запрос действует до" htmlFor={expiresFieldId}>
          <Input
            id={expiresFieldId}
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </FormItem>
        <FormItem>
          <Button
            stretched
            mode="primary"
            onClick={() => void submit()}
            loading={create.isPending}
            disabled={
              !fromCityId || !toCityId || !earliestAt || !latestAt || !expiresAt
            }
          >
            Опубликовать запрос
          </Button>
        </FormItem>
      </Group>
      <Group header="Мои запросы">
        {requests.isLoading && <Text role="status">Загрузка...</Text>}
        {requests.isError && (
          <FormItem>
            <Text role="alert">Не удалось загрузить запросы.</Text>
            <Button
              size="s"
              mode="secondary"
              onClick={() => void requests.refetch()}
            >
              Попробовать снова
            </Button>
          </FormItem>
        )}
        {!requests.isLoading &&
          !requests.isError &&
          (requests.data ?? []).length === 0 && (
            <Text>Активных запросов пока нет.</Text>
          )}
        {(requests.data ?? []).map((request) => (
          <FormItem
            key={request.id}
            top={`${request.fromCity.name} → ${request.toCity.name}`}
            bottom={`${new Date(request.earliestAt).toLocaleString("ru-RU")} · ${request.status}`}
          >
            {request.status === "active" && (
              <Button
                size="s"
                mode="secondary"
                loading={setStatus.isPending}
                disabled={setStatus.isPending || cancel.isPending}
                aria-label={`Поставить на паузу запрос ${request.fromCity.name} — ${request.toCity.name}`}
                onClick={() => void handleStatusChange(request.id, "paused")}
              >
                Поставить на паузу
              </Button>
            )}
            {request.status === "paused" && (
              <Button
                size="s"
                mode="secondary"
                loading={setStatus.isPending}
                disabled={setStatus.isPending || cancel.isPending}
                aria-label={`Возобновить запрос ${request.fromCity.name} — ${request.toCity.name}`}
                onClick={() => void handleStatusChange(request.id, "active")}
              >
                Возобновить
              </Button>
            )}
            {(request.status === "active" || request.status === "paused") && (
              <Button
                size="s"
                mode="tertiary"
                loading={cancel.isPending}
                disabled={setStatus.isPending || cancel.isPending}
                onClick={() => void handleCancel(request.id)}
              >
                Отменить
              </Button>
            )}
          </FormItem>
        ))}
      </Group>
      <Spacing size={24} />
    </Panel>
  );
};
