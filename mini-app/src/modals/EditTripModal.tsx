// mini-app/src/modals/EditTripModal/EditTripModal.tsx
import { type FC, useState, useCallback, useEffect, useRef } from "react";
import {
  Button,
  Box,
  DateInput,
  Flex,
  FormItem,
  FormLayoutGroup,
  Group,
  Header,
  Input,
  ModalPage,
  ModalPageHeader,
  PanelHeaderButton,
  Separator,
  Spacing,
  Textarea,
  Caption,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import { MAX_SEATS } from "@edem/contracts";
import type { CityDto, UpdateTripDto, TripTag } from "@edem/contracts";
import type { Trip } from "@/types";
import { TRIP_TAGS } from "@/consts/tags";
import { TagsScroll } from "@/components/TagsScroll";
import { CityPickerField } from "@/components/CityPickerField/CityPickerField";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useCancelTripMutation, useUpdateTripMutation } from "@/queries/useTripsQuery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { clearDraft, readDraft, writeDraft } from "@/helpers/draftStorage";
import { formatMoscowDateTime, moscowWallClockToIso } from "@/helpers/moscowTime";
import {
  type TripFormValues,
  type TripFormErrors,
  type TripFormDraft,
  validateTripForm,
  isFormValid,
  isTripFormDraft,
} from "./CreateTripModal/validation";

export type EditTripModalProps = CustomModalProps<OpenModalPageProps, { trip: Trip }>;

export const EditTripModal: FC<EditTripModalProps> = ({
  modalProps,
  close,
  trip,
}) => {
  const currentUser = useCurrentUser();
  const draftKey = currentUser ? `edit-trip:${currentUser.id}:${trip.id}` : null;
  const [initialDraft] = useState(() =>
    draftKey ? readDraft<TripFormDraft>(draftKey, isTripFormDraft) : null
  );
  // Время в пути храним в минутах (trip.durationMinutes); водителю показываем
  // целые часы. Конвертация часы→минуты при сохранении применяется, только если
  // поле реально меняли (durationChanged), иначе исходные минуты сохраняются
  // без потерь (90 мин не превращаются в 120 мин).
  const initialDurationHours = Math.round(trip.durationMinutes / 60).toString();
  const [durationChanged, setDurationChanged] = useState(
    // Восстановленный черновик с другим значением поля — его уже меняли ранее.
    () => initialDraft !== null && initialDraft.values.durationHours !== initialDurationHours
  );
  const [values, setValues] = useState<TripFormValues>(() => {
    if (initialDraft) return initialDraft.values;
    // Извлекаем дату и время в ЛОКАЛЬНОМ времени пользователя.
    // Смешение toISOString() (UTC) и toLocaleTimeString() (local) сдвигало
    // дату на день назад при сохранении (например, 01:00 МСК = 22:00 UTC предыдущего дня).
    let date = "";
    let time = "";
    if (trip.departureAt) {
      try {
        const formatted = formatMoscowDateTime(trip.departureAt);
        date = formatted?.date ?? "";
        time = formatted?.time ?? "";
      } catch {
        // fallback
      }
    }
    // fromCityId/toCityId отдаются бэкендом начиная с версии «справочник
    // городов». Для старых поездок id может быть null — тогда пользователь
    // увидит пустое поле и должен выбрать город заново.
    const fromCity: CityDto | null = trip.fromCityId
      ? { id: trip.fromCityId, name: trip.fromCity }
      : null;
    const toCity: CityDto | null = trip.toCityId
      ? { id: trip.toCityId, name: trip.toCity }
      : null;
    return {
      fromCity,
      fromAddress: trip.fromAddress ?? "",
      toCity,
      toAddress: trip.toAddress ?? "",
      date,
      time,
      // Целые часы — только для отображения; см. initialDurationHours выше.
      durationHours: initialDurationHours,
      distanceKm: trip.distanceKm.toString(),
      price: trip.price.toString(),
      seats: trip.seatsTotal,
      comment: trip.comment ?? "",
    };
  });
  const [errors, setErrors] = useState<TripFormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof TripFormValues, boolean>>
  >({});
  const [selectedTags, setSelectedTags] = useState<TripTag[]>(
    initialDraft?.selectedTags ?? (trip.tags as TripTag[])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const persistDraftRef = useRef(true);
  // Черновик пишем только после первого изменения пользователя: запись при
  // монтировании загрязняла localStorage неизменёнными данными поездки.
  const [hasChanges, setHasChanges] = useState(false);

  // Единый объект даты+времени для DateInput; инициализируется из trip.departureAt
  // в ЛОКАЛЬНОМ времени (см. комментарий выше про сдвиг суток из-за UTC).
  const [departureDateTime, setDepartureDateTime] = useState<Date | null>(() => {
    if (values.date && values.time) {
      const dt = new Date(`${values.date}T${values.time}`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  });

  const { enqueue: enqueueSnackbar } = useSnackbar();
  const updateTrip = useUpdateTripMutation();
  const cancelTrip = useCancelTripMutation();

  // Удалить можно только active-поездку без активных броней:
  // если уже есть pending/confirmed бронь, отмена возможна только через
  // /cancel (и она сама уведомит пассажиров), а «просто удалить» — обман.
  const canDelete =
    trip.status === "active" &&
    (trip.pendingRequestsCount ?? 0) === 0 &&
    (trip.confirmedBookingsCount ?? 0) === 0;

  const handleDelete = useCallback(() => {
    if (!canDelete) return;
    setIsCancelling(true);
    cancelTrip.mutate(trip.id, {
      onSettled: () => {
        setIsCancelling(false);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Поездка удалена",
          subtitle: "Маршрут больше не виден пассажирам",
          dedupeKey: `delete_trip_${trip.id}`,
        });
        persistDraftRef.current = false;
        if (draftKey) clearDraft(draftKey);
        close();
      },
      onError: (error) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось удалить поездку",
          subtitle: error instanceof Error ? error.message : undefined,
          dedupeKey: `delete_trip_error_${trip.id}`,
        });
      },
    });
  }, [canDelete, cancelTrip, trip.id, enqueueSnackbar, close, draftKey]);

  useEffect(() => {
    if (draftKey && hasChanges && persistDraftRef.current) {
      writeDraft(draftKey, { values, selectedTags });
    }
  }, [draftKey, hasChanges, selectedTags, values]);

  const handleChange = useCallback(
    (field: keyof TripFormValues, value: string | number) => {
      // Вычисляем next вне setState-апдейтера: вызов setErrors внутри
      // апдейтера — антипаттерн (StrictMode вызывает апдейтеры дважды).
      const next = { ...values, [field]: value };
      setValues(next);
      setHasChanges(true);

      if (field === "durationHours") {
        setDurationChanged(true);
      }

      if (touched[field]) {
        setErrors(validateTripForm(next));
      }
    },
    [touched, values]
  );

  const handleBlur = useCallback(
    (field: keyof TripFormValues) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      setErrors(validateTripForm(values));
    },
    [values]
  );

  const handleDateTimeChange = useCallback((date: Date | null) => {
    setDepartureDateTime(date);
    setHasChanges(true);

    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");

      setValues((prev) => ({
        ...prev,
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`,
      }));
    } else {
      setValues((prev) => ({ ...prev, date: "", time: "" }));
    }
  }, []);

  const handlePublish = useCallback(() => {
    const allTouched: Partial<Record<keyof TripFormValues, boolean>> = {};

    (Object.keys(values) as (keyof TripFormValues)[]).forEach((key) => {
      allTouched[key] = true;
    });

    setTouched(allTouched);

    const formErrors = validateTripForm(values);
    setErrors(formErrors);

    if (!isFormValid(formErrors)) {
      enqueueSnackbar({
        type: "error",
        title: "Проверьте форму",
        subtitle: "Некоторые поля заполнены некорректно",
        dedupeKey: "trip_form_validation",
      });
      return;
    }

    const departureAt = moscowWallClockToIso(values.date, values.time);
    if (!departureAt) {
      setErrors((prev) => ({
        ...prev,
        date: "Некорректная дата или время",
      }));
      return;
    }

    const payload: UpdateTripDto = {
      // Маршрут (fromCity/fromCityId/toCity/toCityId) ЗАБЛОКИРОВАН на
      // сервере: updateTripDtoSchema .strict() отвергает эти поля.
      // UI не позволяет их менять, но на всякий случай не отправляем.
      fromAddress: values.fromAddress.trim(),
      toAddress: values.toAddress.trim(),
      departureAt,
      // Часы→минуты конвертируем, только если поле меняли: иначе сохраняем
      // исходное значение с точностью до минут.
      durationMinutes: durationChanged
        ? Number(values.durationHours) * 60
        : trip.durationMinutes,
      distanceKm: Number(values.distanceKm.replace(",", ".")),
      price: Number(values.price.replace(/\s/g, "")),
      seatsTotal: values.seats,
      tags: selectedTags,
      comment: values.comment.trim() ? values.comment.trim() : undefined,
    };

    setIsSubmitting(true);

    updateTrip.mutate({ id: trip.id, data: payload }, {
      onSettled: () => {
        setIsSubmitting(false);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Изменения сохранены",
          dedupeKey: "edit_trip_success",
        });

        persistDraftRef.current = false;
        if (draftKey) clearDraft(draftKey);
        close();
      },
      onError: (error) => {
        enqueueSnackbar({
          type: "error",
          title: "Не удалось сохранить",
          subtitle: error instanceof Error ? error.message : undefined,
          dedupeKey: "edit_trip_error",
        });
      },
    });
  }, [
    values,
    selectedTags,
    trip.id,
    trip.durationMinutes,
    durationChanged,
    updateTrip,
    enqueueSnackbar,
    close,
    draftKey,
  ]);

  const showError = (field: keyof TripFormValues): string | undefined =>
    touched[field] ? errors[field] : undefined;

  return (
    <ModalPage
      {...modalProps}
      settlingHeight={100}
      header={
        <ModalPageHeader
          after={
            <PanelHeaderButton onClick={close} aria-label="Закрыть">
              <Icon24Cancel />
            </PanelHeaderButton>
          }
        >
          Редактировать поездку
        </ModalPageHeader>
      }
    >
      <Group header={<Header size="s">Маршрут</Header>}>
        <FormLayoutGroup>
          <CityPickerField
            id="edit-trip-from-city"
            label="Откуда"
            value={values.fromCity}
            onChange={(city: CityDto) => {
              setValues((prev) => {
                const next = { ...prev, fromCity: city };
                if (touched.fromCity) {
                  setErrors(validateTripForm(next));
                }
                return next;
              });
              setTouched((prev) => ({ ...prev, fromCity: true }));
            }}
            disabled
            helperText="Маршрут нельзя изменить после создания. Чтобы сменить, удалите поездку и создайте новую."
            error={showError("fromCity")}
          />

          <FormItem
            top="Адрес отправления"
            status={showError("fromAddress") ? "error" : "default"}
            bottom={
              showError("fromAddress") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("fromAddress")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="Например: м. Тёплый Стан"
              value={values.fromAddress}
              onChange={(e) => handleChange("fromAddress", e.target.value)}
              onBlur={() => handleBlur("fromAddress")}
              aria-invalid={!!showError("fromAddress")}
            />
          </FormItem>

          <CityPickerField
            id="edit-trip-to-city"
            label="Куда"
            value={values.toCity}
            onChange={(city: CityDto) => {
              setValues((prev) => {
                const next = { ...prev, toCity: city };
                if (touched.toCity) {
                  setErrors(validateTripForm(next));
                }
                return next;
              });
              setTouched((prev) => ({ ...prev, toCity: true }));
            }}
            disabled
            helperText="Маршрут нельзя изменить после создания. Чтобы сменить, удалите поездку и создайте новую."
            error={showError("toCity")}
          />

          <FormItem
            top="Адрес назначения"
            status={showError("toAddress") ? "error" : "default"}
            bottom={
              showError("toAddress") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("toAddress")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="Например: м. Московская"
              value={values.toAddress}
              onChange={(e) => handleChange("toAddress", e.target.value)}
              onBlur={() => handleBlur("toAddress")}
              aria-invalid={!!showError("toAddress")}
            />
          </FormItem>
        </FormLayoutGroup>
      </Group>

      <Group header={<Header size="s">Дата и время</Header>}>
        <FormLayoutGroup>
          <FormItem
            top="Дата и время отправления"
            status={showError("date") || showError("time") ? "error" : "default"}
            bottom={
              showError("date") || showError("time") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("date") || showError("time")}
                </Caption>
              ) : undefined
            }
          >
            <DateInput
              value={departureDateTime}
              onChange={handleDateTimeChange}
              enableTime
              size="m"
              placeholder="Выберите дату и время"
              aria-invalid={!!(showError("date") || showError("time"))}
            />
          </FormItem>

          <FormItem
            top="Время в пути, часов"
            status={showError("durationHours") ? "error" : "default"}
            bottom={
              showError("durationHours") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("durationHours")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="Например: 4"
              inputMode="numeric"
              value={values.durationHours}
              onChange={(e) => handleChange("durationHours", e.target.value)}
              onBlur={() => handleBlur("durationHours")}
              aria-invalid={!!showError("durationHours")}
            />
          </FormItem>

          <FormItem
            top="Расстояние, км"
            status={showError("distanceKm") ? "error" : "default"}
            bottom={
              showError("distanceKm") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("distanceKm")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="Например: 705"
              inputMode="decimal"
              value={values.distanceKm}
              onChange={(e) => handleChange("distanceKm", e.target.value)}
              onBlur={() => handleBlur("distanceKm")}
              aria-invalid={!!showError("distanceKm")}
            />
          </FormItem>
        </FormLayoutGroup>
      </Group>

      <Group header={<Header size="s">Место и цена</Header>}>
        <FormLayoutGroup>
          <FormItem
            top="Цена за место, ₽"
            status={showError("price") ? "error" : "default"}
            bottom={
              showError("price") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("price")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="700"
              inputMode="numeric"
              value={values.price}
              onChange={(e) => handleChange("price", e.target.value)}
              onBlur={() => handleBlur("price")}
              aria-invalid={!!showError("price")}
            />
          </FormItem>

          <FormItem
            top="Свободных мест"
            status={showError("seats") ? "error" : "default"}
            bottom={
              showError("seats") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("seats")}
                </Caption>
              ) : (
                <Caption
                  level="1"
                  style={{ color: "var(--vkui--color_text_secondary)" }}
                >
                  {`Не более ${MAX_SEATS} мест: на заднем сидении — только 2 пассажира, для комфорта`}
                </Caption>
              )
            }
          >
            <Flex
              align="center"
              gap={16}
              role="group"
              aria-label="Количество свободных мест"
            >
              <Button
                mode="secondary"
                appearance="neutral"
                onClick={() =>
                  handleChange("seats", Math.max(1, values.seats - 1))
                }
                aria-label="Меньше мест"
                disabled={values.seats <= 1}
              >
                −
              </Button>

              <span
                // eslint-disable-next-line react/forbid-dom-props
                style={{ minWidth: 16, textAlign: "center", fontWeight: 600 }}
                aria-live="polite"
              >
                {values.seats}
              </span>

              <Button
                mode="secondary"
                appearance="neutral"
                onClick={() =>
                  handleChange("seats", Math.min(MAX_SEATS, values.seats + 1))
                }
                aria-label="Больше мест"
                disabled={values.seats >= MAX_SEATS}
              >
                +
              </Button>
            </Flex>
          </FormItem>
        </FormLayoutGroup>
      </Group>

      <Group header={<Header size="s">Особенности поездки</Header>}>
        <Box padding={0}>
          <TagsScroll
            tags={TRIP_TAGS}
            selected={selectedTags}
            onChange={(next) => {
              setSelectedTags(next as TripTag[]);
              setHasChanges(true);
            }}
          />
        </Box>
      </Group>

      <Group header={<Header size="s">Комментарий пассажирам</Header>}>
        <FormItem
          status={showError("comment") ? "error" : "default"}
          bottom={
            showError("comment") ? (
              <Caption
                level="1"
                role="alert"
                style={{ color: "var(--vkui--color_text_negative)" }}
              >
                {showError("comment")}
              </Caption>
            ) : undefined
          }
        >
          <Textarea
            placeholder="Например: одна остановка в пути, багажник свободен"
            value={values.comment}
            onChange={(e) => handleChange("comment", e.target.value)}
            onBlur={() => handleBlur("comment")}
            aria-invalid={!!showError("comment")}
          />
        </FormItem>

        {values.comment.length > 0 && (
          <Box padding="system" paddingBlockStart={0}>
            <Caption
              level="1"
              style={{
                color:
                  values.comment.length > 450
                    ? "var(--vkui--color_text_negative)"
                    : "var(--vkui--color_text_secondary)",
                textAlign: "right",
              }}
              aria-live="polite"
            >
              {values.comment.length}/500
            </Caption>
          </Box>
        )}
      </Group>

      <Group header={<Header size="s">Опасная зона</Header>}>
        <FormItem
          bottom={
            !canDelete ? (
              <Caption
                level="1"
                style={{ color: "var(--vkui--color_text_secondary)" }}
              >
                {(trip.status !== "active")
                  ? "Удалить можно только активную поездку."
                  : "У поездки есть активные брони — отмените или завершите её, чтобы освободить маршрут."}
              </Caption>
            ) : (
              <Caption
                level="1"
                style={{ color: "var(--vkui--color_text_secondary)" }}
              >
                Поездка будет отменена. Пассажиров на ней нет — уведомлений не будет.
              </Caption>
            )
          }
        >
          <Button
            size="l"
            stretched
            mode="secondary"
            appearance="negative"
            onClick={handleDelete}
            disabled={!canDelete || isCancelling}
            loading={isCancelling}
          >
            Удалить поездку
          </Button>
        </FormItem>
      </Group>

      <Box
        padding="system"
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--vkui--color_background_content)",
        }}
      >
        <Separator />

        <Spacing size={12} />

        <Button
          size="l"
          stretched
          mode="primary"
          onClick={handlePublish}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Сохранить изменения
        </Button>
      </Box>
    </ModalPage>
  );
};
