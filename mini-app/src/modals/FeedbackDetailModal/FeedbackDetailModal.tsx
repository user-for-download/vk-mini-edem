// mini-app/src/modals/FeedbackDetailModal/FeedbackDetailModal.tsx
import { type FC } from "react";
import {
  Box,
  Caption,
  Group,
  Header,
  ModalPage,
  ModalPageHeader,
  PanelHeaderButton,
  Separator,
  Spacing,
  Text,
} from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import type {
  CustomModalProps,
  OpenModalPageProps,
} from "@vkontakte/vkui";
import type { UserFeedbackDto } from "@edem/contracts";

export interface FeedbackDetailModalAdditionalProps {
  feedback: UserFeedbackDto;
}

export type FeedbackDetailModalProps = CustomModalProps<
  OpenModalPageProps,
  FeedbackDetailModalAdditionalProps
>;

/**
 * Read-only просмотр обращения: исходный текст + ответ поддержки (если есть).
 * Открывается из «Помощь и поддержка» → «Мои обращения».
 */
export const FeedbackDetailModal: FC<FeedbackDetailModalProps> = ({
  modalProps,
  close,
  feedback,
}) => {
  const createdAt = new Date(feedback.createdAt).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const repliedAtLabel = feedback.repliedAt
    ? new Date(feedback.repliedAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <ModalPage
      {...modalProps}
      header={
        <ModalPageHeader
          before={
            <PanelHeaderButton
              onClick={close}
              aria-label="Закрыть"
            >
              <Icon24Cancel />
            </PanelHeaderButton>
          }
        >
          {feedback.subject}
        </ModalPageHeader>
      }
    >
      <Group header={<Header size="s">Ваше обращение</Header>}>
        <Box padding="system">
          <Text>{feedback.text}</Text>
          <Spacing size={8} />
          <Caption
            level="1"
            style={{ color: "var(--vkui--color_text_secondary)" }}
          >
            Отправлено: {createdAt}
          </Caption>
        </Box>
      </Group>

      <Spacing size={12} />

      {feedback.reply ? (
        <Group header={<Header size="s">Ответ поддержки</Header>}>
          <Box padding="system">
            <Text>{feedback.reply}</Text>
            {repliedAtLabel && (
              <>
                <Spacing size={8} />
                <Caption
                  level="1"
                  style={{ color: "var(--vkui--color_text_secondary)" }}
                >
                  Ответ дан: {repliedAtLabel}
                </Caption>
              </>
            )}
          </Box>
        </Group>
      ) : (
        <Group header={<Header size="s">Ответ поддержки</Header>}>
          <Box padding="system">
            <Caption
              level="1"
              style={{ color: "var(--vkui--color_text_secondary)" }}
            >
              Поддержка ещё не ответила. Мы свяжемся с вами здесь — список
              обновится автоматически.
            </Caption>
          </Box>
        </Group>
      )}

      <Separator />
      <Spacing size={24} />
    </ModalPage>
  );
};
