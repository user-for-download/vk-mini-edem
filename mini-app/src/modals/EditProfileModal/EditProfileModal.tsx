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
  ModalPageProps,
  PanelHeaderButton,
  Separator,
  Textarea,
  Box,
} from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import { usersApi } from "@/api/users.api";
import { useSnackbarStore } from "@/store/useSnackbarStore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthStore } from "@/store/useAuthStore";

export interface EditProfileModalProps extends ModalPageProps {
  id: string;
  onClose: () => void;
}

export const EditProfileModal: FC<EditProfileModalProps> = ({
  id,
  onClose,
  ...restProps
}) => {
  const currentUser = useCurrentUser();

  const [name, setName] = useState(currentUser?.name ?? "");
  const [about, setAbout] = useState(currentUser?.about ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedAbout = about.trim();

    if (trimmedName.length < 2) {
      setError("Имя должно содержать минимум 2 символа");
      return;
    }

    if (trimmedAbout.length > 500) {
      setError("Поле «О себе» не может быть длиннее 500 символов");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updatedUser = await usersApi.updateProfile({
        name: trimmedName,
        about: trimmedAbout || undefined,
      });

      useAuthStore.setState({ user: updatedUser });

      enqueueSnackbar({
        type: "success",
        title: "Профиль обновлен",
        subtitle: "Изменения успешно сохранены",
        dedupeKey: "profile_update_success",
      });

      onClose();
    } catch (submitError) {
      enqueueSnackbar({
        type: "error",
        title: "Не удалось обновить профиль",
        subtitle:
          submitError instanceof Error ? submitError.message : undefined,
        dedupeKey: "profile_update_error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPage
      id={id}
      onClose={onClose}
      settlingHeight={100}
      header={
        <ModalPageHeader
          after={
            <PanelHeaderButton onClick={onClose} aria-label="Закрыть">
              <Icon24Cancel />
            </PanelHeaderButton>
          }
        >
          Редактирование профиля
        </ModalPageHeader>
      }
      {...restProps}
    >
      <Group header={<Header size="s">Основная информация</Header>}>
        <FormItem top="Имя">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);

              if (error) {
                setError(null);
              }
            }}
          />
        </FormItem>

        <FormItem top="О себе">
          <Textarea
            placeholder="Например: за рулём 7 лет, люблю музыку 80-х"
            value={about}
            onChange={(e) => {
              setAbout(e.target.value);

              if (error) {
                setError(null);
              }
            }}
            maxLength={500}
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
        <Separator style={{ marginBottom: 12 }} />

        <Button
          size="l"
          stretched
          mode="primary"
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Сохранить изменения
        </Button>
      </Box>
    </ModalPage>
  );
};
