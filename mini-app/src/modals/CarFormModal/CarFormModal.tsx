import { type FC, useState } from "react";
import {
  Button,
  Caption,
  FormItem,
  Group,
  Header,
  Input,
  ModalPage,
  ModalPageHeader,
  PanelHeaderButton,
  Separator,
  Spacing,
  Box,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import { usersApi, type CarFormDto } from "@/api/users.api";
import { ApiError } from "@/api/client";
import { getErrorMessage } from "@/helpers/errorMessages";
import { useSnackbarStore } from "@/store/useSnackbarStore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthStore } from "@/store/useAuthStore";

export type CarFormModalProps = CustomModalProps<OpenModalPageProps, object>;

export const CarFormModal: FC<CarFormModalProps> = ({ modalProps, close }) => {
  const currentUser = useCurrentUser();

  const [values, setValues] = useState<CarFormDto>({
    model: currentUser?.car?.model ?? "",
    color: currentUser?.car?.color ?? "",
    plate: currentUser?.car?.plate ?? "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);

  const handleChange = (field: keyof CarFormDto, value: string) => {
    let processedValue = value;

    // Госномер всегда в верхнем регистре
    if (field === "plate") {
      processedValue = value.toUpperCase();
    }

    // Обрезаем по лимитам бэкенда (users/index.ts):
    // model ≤ 50, color ≤ 30, plate ≤ 15 — иначе сырая ошибка валидации с бэкенда.
    if (field === "model") processedValue = processedValue.slice(0, 50);
    if (field === "color") processedValue = processedValue.slice(0, 30);
    if (field === "plate") processedValue = processedValue.slice(0, 15);

    setValues((prev) => ({ ...prev, [field]: processedValue }));

    if (error) {
      setError(null);
    }
  };

  const isFormValid = Boolean(
    values.model.trim() && values.color.trim() && values.plate.trim()
  );

  const handleSubmit = async () => {
    const model = values.model.trim();
    const color = values.color.trim();
    const plate = values.plate.trim();

    if (!model) {
      setError("Укажите модель автомобиля");
      return;
    }

    if (!color) {
      setError("Укажите цвет автомобиля");
      return;
    }

    if (!plate) {
      setError("Укажите номер автомобиля");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updatedUser = await usersApi.updateCar({
        model,
        color,
        plate,
      });

      useAuthStore.setState({ user: updatedUser });

      enqueueSnackbar({
        type: "success",
        title: "Автомобиль сохранен",
        dedupeKey: "car_form_success",
      });

      close();
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(getErrorMessage(submitError.code, submitError.message));
        return;
      }
      enqueueSnackbar({
        type: "error",
        title: "Не удалось сохранить автомобиль",
        subtitle:
          submitError instanceof Error ? submitError.message : undefined,
        dedupeKey: "car_form_error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          Автомобиль
        </ModalPageHeader>
      }
    >
      <Group header={<Header size="s">Данные автомобиля</Header>}>
        <FormItem top="Модель">
          <Input
            placeholder="Skoda Octavia"
            value={values.model}
            onChange={(e) => handleChange("model", e.target.value)}
          />
        </FormItem>

        <FormItem top="Цвет">
          <Input
            placeholder="белый"
            value={values.color}
            onChange={(e) => handleChange("color", e.target.value)}
          />
        </FormItem>

        <FormItem top="Номер">
          <Input
            placeholder="А 217 МК 78"
            value={values.plate}
            onChange={(e) => handleChange("plate", e.target.value)}
          />
        </FormItem>

        {error && (
          <Box padding="system">
            <Caption
              level="1"
              role="alert"
              style={{ color: "var(--vkui--color_text_negative)" }}
            >
              {error}
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
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !isFormValid}
        >
          Сохранить автомобиль
        </Button>
      </Box>
    </ModalPage>
  );
};
