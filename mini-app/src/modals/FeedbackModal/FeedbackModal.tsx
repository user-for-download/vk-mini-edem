// mini-app/src/modals/FeedbackModal/FeedbackModal.tsx
import { type FC, useState, useRef } from "react";
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
import {
  FEEDBACK_SUBJECT_MAX_LENGTH,
  FEEDBACK_TEXT_MAX_LENGTH,
} from "@edem/contracts";
import { useSnackbar } from "@/providers/SnackbarProvider";
import {
  useCreateFeedbackMutation,
  useInvalidateMyFeedbacks,
} from "@/queries/useFeedbackQuery";

export interface FeedbackModalAdditionalProps {
  /**
   * Предзаполненная тема обращения (например, «Обжалование блокировки»
   * с экрана бана). Не задана — поле пустое, как раньше.
   */
  initialSubject?: string;
}

export type FeedbackModalProps = CustomModalProps<
  OpenModalPageProps,
  FeedbackModalAdditionalProps
>;

/**
 * Обратная связь: тема + текст обращения в поддержку.
 * Оформление — как у EditProfileModal (ModalPage, шапка, sticky-кнопка).
 * Лимиты синхронизированы с контрактом (FEEDBACK_*_MAX_LENGTH).
 */
export const FeedbackModal: FC<FeedbackModalProps> = ({
  modalProps,
  close,
  initialSubject,
}) => {
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Защита от двойного сабмита: ref синхронен (в отличие от state),
  // поэтому второй клик до ре-рендера не отправит второй запрос.
  const isSubmittingRef = useRef(false);

  const { enqueue: enqueueSnackbar } = useSnackbar();
  const createFeedback = useCreateFeedbackMutation();
  const invalidateMyFeedbacks = useInvalidateMyFeedbacks();

  const handleSubmit = () => {
    if (isSubmittingRef.current) return;

    const trimmedSubject = subject.trim();
    const trimmedText = text.trim();

    if (!trimmedSubject) {
      setError("Укажите тему обращения");
      return;
    }

    if (!trimmedText) {
      setError("Опишите проблему или вопрос");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    createFeedback.mutate(
      { subject: trimmedSubject, text: trimmedText },
      {
        onSettled: () => {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        },
        onSuccess: () => {
          enqueueSnackbar({
            type: "success",
            title: "Обращение отправлено",
            subtitle: "Мы ответим вам как можно скорее",
            dedupeKey: "create_feedback_success",
          });
          invalidateMyFeedbacks();

          close();
        },
        onError: (submitError) => {
          enqueueSnackbar({
            type: "error",
            title: "Не удалось отправить обращение",
            subtitle:
              submitError instanceof Error ? submitError.message : undefined,
            dedupeKey: "create_feedback_error",
          });
        },
      },
    );
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
          Обратная связь
        </ModalPageHeader>
      }
    >
      <Group header={<Header size="s">Обращение в поддержку</Header>}>
        <FormItem top="Тема">
          <Input
            placeholder="Например: не приходит уведомление"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);

              if (error) {
                setError(null);
              }
            }}
            maxLength={FEEDBACK_SUBJECT_MAX_LENGTH}
          />
        </FormItem>

        <FormItem top="Сообщение">
          <Textarea
            placeholder="Расскажите подробнее, что произошло"
            value={text}
            onChange={(e) => {
              setText(e.target.value);

              if (error) {
                setError(null);
              }
            }}
            maxLength={FEEDBACK_TEXT_MAX_LENGTH}
          />
        </FormItem>

        {text.length > 0 && (
          <Box padding="system" paddingBlockStart={0}>
            <Caption
              level="1"
              style={{
                textAlign: "right",
                color:
                  text.length > FEEDBACK_TEXT_MAX_LENGTH - 100
                    ? "var(--vkui--color_text_negative)"
                    : "var(--vkui--color_text_secondary)",
              }}
              aria-live="polite"
            >
              {text.length}/{FEEDBACK_TEXT_MAX_LENGTH}
            </Caption>
          </Box>
        )}

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
          Отправить
        </Button>
      </Box>
    </ModalPage>
  );
};
