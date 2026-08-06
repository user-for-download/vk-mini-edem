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
  Textarea,
  Box,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import { usersApi } from "@/api/users.api";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthStore } from "@/store/useAuthStore";

export type EditProfileModalProps = CustomModalProps<OpenModalPageProps, object>;

export const EditProfileModal: FC<EditProfileModalProps> = ({ modalProps, close }) => {
  const currentUser = useCurrentUser();

  const [name, setName] = useState(currentUser?.name ?? "");
  const [about, setAbout] = useState(currentUser?.about ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { enqueue: enqueueSnackbar } = useSnackbar();

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

      close();
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
          Редактирование профиля
        </ModalPageHeader>
      }
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
        <Separator />

        <Spacing size={12} />

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
