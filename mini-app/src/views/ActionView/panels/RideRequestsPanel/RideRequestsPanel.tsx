import { type FC, useId, useState } from "react";
import {
  Button,
  ButtonGroup,
  DateInput,
  FormItem,
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  RichCell,
  Spacing,
  Text,
} from "@vkontakte/vkui";
import type { CityDto } from "@edem/contracts";
import { CityPickerField } from "@/components/CityPickerField/CityPickerField";
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
  const requests = useRideRequestsQuery();
  const create = useCreateRideRequestMutation();
  const setStatus = useRideRequestStatusMutation();
  const cancel = useCancelRideRequestMutation();
  const { enqueue: notify } = useSnackbar();
  // Города — как в CreateTripModal: CityDto через CityPickerField
  // (поиск + excludeCityId), а не сырые id из Select.
  const [fromCity, setFromCity] = useState<CityDto | null>(null);
  const [toCity, setToCity] = useState<CityDto | null>(null);
  // Моменты — как в CreateTripModal: DateInput с enableTime (внутри тот же
  // Calendar); абсолютные Date уходят в ISO — та же семантика, что была
  // у datetime-local (wall-clock сплит через moscowTime здесь не нужен:
  // API принимает ISO-моменты, а не раздельные date/time).
  const [earliestAt, setEarliestAt] = useState<Date | null>(null);
  const [latestAt, setLatestAt] = useState<Date | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // id для CityPickerField (a11y, как в CreateTripModal).
  const fromCityFieldId = useId();
  const toCityFieldId = useId();

  const submit = async () => {
    setFormError(null);
    try {
      const fromCityId = fromCity?.id ?? "";
      const toCityId = toCity?.id ?? "";
      if (fromCityId && fromCityId === toCityId) {
        const msg = "Города отправления и прибытия должны различаться";
        setFormError(msg);
        notify({ type: "error", title: msg });
        return;
      }
      const earliest = earliestAt;
      const latest = latestAt;
      const expires = expiresAt;
      if (
        !earliest ||
        !latest ||
        !expires ||
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
      setFromCity(null);
      setToCity(null);
      setEarliestAt(null);
      setLatestAt(null);
      setExpiresAt(null);
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
  // Подписи статусов для RichCell overTitle.
  const statusLabel: Record<string, string> = {
    active: "Активен",
    paused: "На паузе",
    fulfilled: "Выполнен",
    cancelled: "Отменён",
  };

  return (
    <Panel id={id}>
      <AppPanelHeader before={<PanelHeaderBack onClick={onBack} />}>
        Ищу попутку
      </AppPanelHeader>
            <Group header={<Header size="s">Новый запрос</Header>}>
        <CityPickerField
          id={fromCityFieldId}
          label="Откуда"
          value={fromCity}
          excludeCityId={toCity?.id}
          onChange={setFromCity}
        />
        <CityPickerField
          id={toCityFieldId}
          label="Куда"
          value={toCity}
          excludeCityId={fromCity?.id}
          onChange={setToCity}
        />
        <FormItem
          top="Время отправления от"
          status={formError ? "error" : "default"}
          bottom={formError ?? undefined}
        >
          <DateInput
            value={earliestAt}
            onChange={setEarliestAt}
            enableTime
            disablePast
            size="m"
            placeholder="Выберите дату и время"
            aria-invalid={formError ? true : undefined}
          />
        </FormItem>
        <FormItem top="Время отправления до">
          <DateInput
            value={latestAt}
            onChange={setLatestAt}
            enableTime
            disablePast
            size="m"
            placeholder="Выберите дату и время"
          />
        </FormItem>
        <FormItem top="Запрос действует до">
          <DateInput
            value={expiresAt}
            onChange={setExpiresAt}
            enableTime
            disablePast
            size="m"
            placeholder="Выберите дату и время"
          />
        </FormItem>
        <FormItem>
          <Button
            stretched
            size="m"
            mode="primary"
            onClick={() => void submit()}
            loading={create.isPending}
            disabled={
              !fromCity || !toCity || !earliestAt || !latestAt || !expiresAt
            }
          >
            Опубликовать запрос
          </Button>
        </FormItem>
      </Group>
      <Group header={<Header size="s">Мои запросы</Header>}>
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
        {(requests.data ?? []).map((request) => {
          const route = `${request.fromCity.name} → ${request.toCity.name}`;
          const when = `${new Date(request.earliestAt).toLocaleString("ru-RU")} — ${new Date(request.latestAt).toLocaleString("ru-RU")}`;
          const busy = setStatus.isPending || cancel.isPending;
          return (
            <RichCell
              key={request.id}
              overTitle={statusLabel[request.status] ?? request.status}
              subtitle={when}
              actions={
                request.status === "active" || request.status === "paused" ? (
                  <ButtonGroup mode="horizontal" gap="s" stretched>
                    {request.status === "active" ? (
                      <Button
                        mode="secondary"
                        size="s"
                        loading={setStatus.isPending}
                        disabled={busy}
                        aria-label={`Поставить на паузу запрос ${route}`}
                        onClick={() => void handleStatusChange(request.id, "paused")}
                      >
                        На паузу
                      </Button>
                    ) : (
                      <Button
                        mode="primary"
                        size="s"
                        loading={setStatus.isPending}
                        disabled={busy}
                        aria-label={`Возобновить запрос ${route}`}
                        onClick={() => void handleStatusChange(request.id, "active")}
                      >
                        Возобновить
                      </Button>
                    )}
                    <Button
                      mode="tertiary"
                      size="s"
                      loading={cancel.isPending}
                      disabled={busy}
                      onClick={() => void handleCancel(request.id)}
                    >
                      Отменить
                    </Button>
                  </ButtonGroup>
                ) : undefined
              }
            >
              {route}
            </RichCell>
          );
        })}
      </Group>
      <Spacing size={24} />
    </Panel>
  );
};
