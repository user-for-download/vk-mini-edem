import { useEffect, useRef, useState } from "react";
import { Button, Input, List, Section } from "@telegram-apps/telegram-ui";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { ConfirmAction } from "@/components/ConfirmAction";
import { ApiError } from "@/api/client";
import {
  useRemoveVehicleMutation,
  useUpsertVehicleMutation,
  useVehicleQuery,
} from "@/queries/vehicle";
import {
  VEHICLE_LIMITS,
  normalizeVehicleForm,
  validateVehicleForm,
  vehicleRemoveErrorMessage,
  vehicleServerErrorMessage,
} from "@/pages/vehicleValidation";

/**
 * Автомобиль водителя (порт VK CarFormModal + блок «автомобиль» ProfilePanel).
 *
 * - Просмотр: модель + «цвет · номер» (номер — только свой, из /users/me;
 *   публичные выдачи plate не содержат — см. vehicleApi JSDoc).
 * - Empty-state (VK-копия): «Чтобы публиковать поездки, добавьте
 *   автомобиль» — без авто backend отклоняет создание поездки (NO_CAR).
 * - Добавление/редактирование: POST /users/me/car через useUpsertVehicleMutation
 *   (лимиты/нормализация — vehicleValidation, зеркало CarFormModal).
 * - Remove идентификатора: очистка поля номера + сохранение стирает plate
 *   (backend хранит null).
 * - Полное удаление: кнопка «Удалить автомобиль» → DELETE /users/me/car
 *   (ConfirmAction: первый клик вооружает, второй выполняет). При активных
 *   поездках backend блокирует 409 (инвариант: поездки требуют car) —
 *   показываем объяснение, а не общую ошибку. Полное удаление авто также
 *   происходит каскадом при удалении аккаунта (см. Профиль).
 * - Бан/удаление mid-session: requireUser отвечает 403 — терминальные
 *   экраны вместо общей ошибки (зеркально ProfilePage).
 */
export function VehiclePage() {
  const vehicleQuery = useVehicleQuery();
  const upsert = useUpsertVehicleMutation();
  const remove = useRemoveVehicleMutation();
  const vehicle = vehicleQuery.vehicle ?? null;

  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Защита от двойного сабмита: ref синхронен (в отличие от state),
  // второй клик до ре-рендера не отправит второй запрос (паттерн CarFormModal).
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (vehicleQuery.data && !editing) {
      setModel(vehicleQuery.data.car?.model ?? "");
      setColor(vehicleQuery.data.car?.color ?? "");
      setPlate(vehicleQuery.data.car?.plate ?? "");
    }
  }, [vehicleQuery.data, editing]);

  if (vehicleQuery.error instanceof ApiError && vehicleQuery.error.status === 403) {
    if (vehicleQuery.error.message === "Account is deleted") {
      return (
        <>
          <PageHeader title="Автомобиль" />
          <p className="FormError" role="alert">
            Профиль удалён — данные автомобиля недоступны.
          </p>
        </>
      );
    }
    return (
      <>
        <PageHeader title="Автомобиль" />
        <p className="FormError" role="alert">
          Действие недоступно: аккаунт заблокирован.
        </p>
      </>
    );
  }

  const startEditing = () => {
    setFormError(null);
    upsert.reset();
    setEditing(true);
  };

  const cancelEditing = () => {
    setFormError(null);
    upsert.reset();
    setEditing(false);
  };

  const save = () => {
    if (isSubmittingRef.current) return;
    const error = validateVehicleForm(model, color, plate);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    isSubmittingRef.current = true;
    upsert.mutate(normalizeVehicleForm(model, color, plate), {
      onSuccess: () => setEditing(false),
      onSettled: () => {
        isSubmittingRef.current = false;
      },
    });
  };

  return (
    <>
      <PageHeader title="Автомобиль" action={{ label: "Профиль", to: "/profile" }} />
      <QueryState
        loading={vehicleQuery.isLoading}
        error={vehicleQuery.error}
        empty={!vehicleQuery.data}
        emptyText="Не удалось загрузить автомобиль."
        onRetry={() => void vehicleQuery.refetch()}
      >
        {vehicleQuery.data && (
          <Section>
            <List>
              {editing ? (
                <>
                  <label className="FormField" htmlFor="vehicle-model">
                    Модель
                    <Input
                      id="vehicle-model"
                      value={model}
                      maxLength={VEHICLE_LIMITS.model}
                      placeholder="Skoda Octavia"
                      onChange={(event) => {
                        setModel(event.target.value.slice(0, VEHICLE_LIMITS.model));
                        if (formError) setFormError(null);
                      }}
                    />
                  </label>
                  <label className="FormField" htmlFor="vehicle-color">
                    Цвет
                    <Input
                      id="vehicle-color"
                      value={color}
                      maxLength={VEHICLE_LIMITS.color}
                      placeholder="белый"
                      onChange={(event) => {
                        setColor(event.target.value.slice(0, VEHICLE_LIMITS.color));
                        if (formError) setFormError(null);
                      }}
                    />
                  </label>
                  <label className="FormField" htmlFor="vehicle-plate">
                    Номер (необязательно)
                    <Input
                      id="vehicle-plate"
                      value={plate}
                      maxLength={VEHICLE_LIMITS.plate}
                      placeholder="Например: 583"
                      onChange={(event) => {
                        setPlate(
                          event.target.value.toUpperCase().slice(0, VEHICLE_LIMITS.plate),
                        );
                        if (formError) setFormError(null);
                      }}
                    />
                  </label>
                  <p className="ProfileHead__meta">
                    Номер — примета для узнавания, видна только вам. Чтобы убрать номер,
                    очистите поле и сохраните.
                  </p>
                  {(formError || upsert.error) && (
                    <p className="FormError" role="alert">
                      {formError ?? vehicleServerErrorMessage(upsert.error)}
                    </p>
                  )}
                  <Button stretched loading={upsert.isPending} onClick={save}>
                    Сохранить автомобиль
                  </Button>
                  <Button
                    mode="outline"
                    stretched
                    disabled={upsert.isPending}
                    onClick={cancelEditing}
                  >
                    Отмена
                  </Button>
                </>
              ) : vehicle ? (
                <>
                  <div className="ProfileHead">
                    <p className="ProfileHead__name">{vehicle.model}</p>
                    <p className="ProfileHead__meta">
                      {vehicle.plate ? `${vehicle.color} · ${vehicle.plate}` : vehicle.color}
                    </p>
                    <p className="ProfileHead__meta">
                      Модель и цвет видят другие пользователи, номер — только вы.
                    </p>
                  </div>
                  <Button mode="outline" stretched onClick={startEditing}>
                    Изменить автомобиль
                  </Button>
                  <ConfirmAction
                    label="Удалить автомобиль"
                    confirmLabel="Да, удалить"
                    description="Автомобиль будет удалён из профиля. Без него нельзя создавать новые поездки. При активных поездках удаление заблокировано."
                    pending={remove.isPending}
                    onConfirm={() => remove.mutate(undefined)}
                  />
                  {remove.isError && (
                    <p className="FormError" role="alert">
                      {vehicleRemoveErrorMessage(remove.error)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="ProfileHead">
                    <p className="ProfileHead__name">Автомобиль не добавлен</p>
                    <p className="ProfileHead__meta">
                      Чтобы публиковать поездки, добавьте автомобиль.
                    </p>
                  </div>
                  <Button stretched onClick={startEditing}>
                    Добавить автомобиль
                  </Button>
                </>
              )}
            </List>
          </Section>
        )}
      </QueryState>
    </>
  );
}
