// mini-app/src/modals/CreateTripModal/CreateTripModal.tsx
import { type FC, useState, useCallback, useEffect, useRef } from "react";
import {
  Button,
  Box,
  ChipsSelect,
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
import type { CityDto, CreateTripDto, TripTag } from "@edem/contracts";
import { ApiError } from "@/api/client";
import { TRIP_TAGS } from "@/consts/tags";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { getErrorMessage, getRateLimitMessage } from "@/helpers/errorMessages";
import { useCreateTripMutation } from "@/queries/useTripsQuery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { clearDraft, readDraft, writeDraft } from "@/helpers/draftStorage";
import { moscowWallClockToIso } from "@/helpers/moscowTime";
import { CityPickerField } from "@/components/CityPickerField/CityPickerField";
import {
  type TripFormValues,
  type TripFormErrors,
  type TripFormDraft,
  initialFormValues,
  validateTripForm,
  isFormValid,
  isTripFormDraft,
} from "./validation";

export type CreateTripModalProps = CustomModalProps<OpenModalPageProps, { onTripCreated: () => void }>;

export const CreateTripModal: FC<CreateTripModalProps> = ({
  modalProps,
  close,
  onTripCreated,
}) => {
  const currentUser = useCurrentUser();
  const draftKey = currentUser ? `create-trip:${currentUser.id}` : null;
  const [initialDraft] = useState(() =>
    draftKey ? readDraft<TripFormDraft>(draftKey, isTripFormDraft) : null
  );
  const [values, setValues] = useState<TripFormValues>(initialDraft?.values ?? initialFormValues);
  const [errors, setErrors] = useState<TripFormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof TripFormValues, boolean>>
  >({});
  const [selectedTags, setSelectedTags] = useState<TripTag[]>(initialDraft?.selectedTags ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const persistDraftRef = useRef(true);

  // Единый объект даты+времени для DateInput; синхронизирован с values.date/time.
  const [departureDateTime, setDepartureDateTime] = useState<Date | null>(() => {
    if (values.date && values.time) {
      const dt = new Date(`${values.date}T${values.time}`);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  });

  const { enqueue: enqueueSnackbar } = useSnackbar();
  const createTrip = useCreateTripMutation();

  useEffect(() => {
    if (draftKey && persistDraftRef.current) writeDraft(draftKey, { values, selectedTags });
  }, [draftKey, selectedTags, values]);

  const handleChange = useCallback(
    (field: keyof TripFormValues, value: string | number) => {
      // Вычисляем next вне setState-апдейтера: вызов setErrors внутри
      // апдейтера — антипаттерн (StrictMode вызывает апдейтеры дважды).
      const next = { ...values, [field]: value };
      setValues(next);

      if (touched[field]) {
        setErrors(validateTripForm(next));
      }
    },
    [touched, values]
  );

  const handleDateTimeChange = useCallback((date: Date | null) => {
    setDepartureDateTime(date);

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

  const handleBlur = useCallback(
    (field: keyof TripFormValues) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      setErrors(validateTripForm(values));
    },
    [values]
  );

  const resetForm = useCallback(() => {
    setValues(initialFormValues);
    setErrors({});
    setTouched({});
    setSelectedTags([]);
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

    const payload: CreateTripDto = {
      fromCity: values.fromCity!.name,
      fromCityId: values.fromCity!.id,
      fromAddress: values.fromAddress.trim(),
      toCity: values.toCity!.name,
      toCityId: values.toCity!.id,
      toAddress: values.toAddress.trim(),
      departureAt,
      durationMinutes: Number(values.durationHours) * 60,
      distanceKm: Number(values.distanceKm.replace(",", ".")),
      price: Number(values.price.replace(/\s/g, "")),
      seatsTotal: values.seats,
      tags: selectedTags,
      comment: values.comment.trim() ? values.comment.trim() : undefined,
    };

    setIsSubmitting(true);

    createTrip.mutate(payload, {
      onSettled: () => {
        setIsSubmitting(false);
      },
      onSuccess: () => {
        enqueueSnackbar({
          type: "success",
          title: "Поездка опубликована",
          subtitle: "Теперь её увидят другие пассажиры",
          dedupeKey: "create_trip_success",
        });

        persistDraftRef.current = false;
        if (draftKey) clearDraft(draftKey);
        resetForm();

        if (onTripCreated) {
          onTripCreated();
        } else {
          close();
        }
      },
      onError: (error) => {
        const message =
          error instanceof ApiError && error.code === "RATE_LIMITED"
            ? getRateLimitMessage(error.retryAfterMs)
            : error instanceof ApiError
              ? getErrorMessage(error.code, error.message)
              : "Не удалось создать поездку";

        enqueueSnackbar({
          type: "error",
          title: message,
          dedupeKey: "create_trip_error",
        });
      },
    });
  }, [
    values,
    selectedTags,
    createTrip,
    enqueueSnackbar,
    close,
    onTripCreated,
    resetForm,
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
          Новая поездка
        </ModalPageHeader>
      }
    >
      <Group header={<Header size="s">Маршрут</Header>}>
        <FormLayoutGroup>
          <CityPickerField
            id="create-trip-from-city"
            label="Откуда"
            value={values.fromCity}
            excludeCityId={values.toCity?.id}
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
            id="create-trip-to-city"
            label="Куда"
            value={values.toCity}
            excludeCityId={values.fromCity?.id}
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
        <FormItem top="Выберите особенности">
          <ChipsSelect
            value={selectedTags.map((tag) => ({ value: tag, label: tag }))}
            onChange={(options) =>
              setSelectedTags(options.map((option) => option.value as TripTag))
            }
            options={TRIP_TAGS.map((tag) => ({ value: tag, label: tag }))}
            placeholder="Можно с животными, багаж..."
            creatable={false}
            allowClearButton
            closeAfterSelect={false}
          />
        </FormItem>
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
          Опубликовать поездку
        </Button>
      </Box>
    </ModalPage>
  );
};
