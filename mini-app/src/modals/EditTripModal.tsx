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
import type { UpdateTripDto, TripTag } from "@edem/contracts";
import type { Trip } from "@/types";
import { TRIP_TAGS } from "@/consts/tags";
import { TagsScroll } from "@/components/TagsScroll";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useUpdateTripMutation } from "@/queries/useTripsQuery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { clearDraft, readDraft, writeDraft } from "@/helpers/draftStorage";
import { formatMoscowDateTime, moscowWallClockToIso } from "@/helpers/moscowTime";
import {
  type TripFormValues,
  type TripFormErrors,
  validateTripForm,
  isFormValid,
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
    draftKey ? readDraft<{ values: TripFormValues; selectedTags: TripTag[] }>(draftKey) : null
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
    return {
      fromCity: trip.fromCity,
      fromAddress: trip.fromAddress,
      toCity: trip.toCity,
      toAddress: trip.toAddress,
      date,
      time,
      durationMinutes: trip.durationMinutes.toString(),
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
  const persistDraftRef = useRef(true);

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

  useEffect(() => {
    if (draftKey && persistDraftRef.current) writeDraft(draftKey, { values, selectedTags });
  }, [draftKey, selectedTags, values]);

  const handleChange = useCallback(
    (field: keyof TripFormValues, value: string | number) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };

        if (touched[field]) {
          setErrors(validateTripForm(next));
        }

        return next;
      });
    },
    [touched]
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
      fromCity: values.fromCity.trim(),
      fromAddress: values.fromAddress.trim(),
      toCity: values.toCity.trim(),
      toAddress: values.toAddress.trim(),
      departureAt,
      durationMinutes: Number(values.durationMinutes),
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
          <FormItem
            top="Откуда"
            status={showError("fromCity") ? "error" : "default"}
            bottom={
              showError("fromCity") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("fromCity")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="Город, район или метро"
              value={values.fromCity}
              onChange={(e) => handleChange("fromCity", e.target.value)}
              onBlur={() => handleBlur("fromCity")}
              aria-invalid={!!showError("fromCity")}
            />
          </FormItem>

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

          <FormItem
            top="Куда"
            status={showError("toCity") ? "error" : "default"}
            bottom={
              showError("toCity") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("toCity")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="Город, район или метро"
              value={values.toCity}
              onChange={(e) => handleChange("toCity", e.target.value)}
              onBlur={() => handleBlur("toCity")}
              aria-invalid={!!showError("toCity")}
            />
          </FormItem>

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
              disablePast
              size="m"
              placeholder="Выберите дату и время"
              aria-invalid={!!(showError("date") || showError("time"))}
            />
          </FormItem>

          <FormItem
            top="Время в пути, минут"
            status={showError("durationMinutes") ? "error" : "default"}
            bottom={
              showError("durationMinutes") ? (
                <Caption
                  level="1"
                  role="alert"
                  style={{ color: "var(--vkui--color_text_negative)" }}
                >
                  {showError("durationMinutes")}
                </Caption>
              ) : undefined
            }
          >
            <Input
              placeholder="Например: 470"
              inputMode="numeric"
              value={values.durationMinutes}
              onChange={(e) => handleChange("durationMinutes", e.target.value)}
              onBlur={() => handleBlur("durationMinutes")}
              aria-invalid={!!showError("durationMinutes")}
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
            onChange={(next) => setSelectedTags(next as TripTag[])}
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
