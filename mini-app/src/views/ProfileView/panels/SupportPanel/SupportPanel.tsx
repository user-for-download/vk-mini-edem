import { type FC, useState } from "react";
import {
  Box,
  Button,
  Caption,
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  SimpleCell,
  Spacing,
  Text,
} from "@vkontakte/vkui";
import { openExternalUrl } from "@/helpers/bridge";
import { openFeedbackModal } from "@/helpers/feedbackModal";
import { openFeedbackDetailModal } from "@/helpers/feedbackDetailModal";
import { useModalApi } from "@/providers/ModalProvider";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { apiClient } from "@/api/client";
import { useMyFeedbacksQuery } from "@/queries/useFeedbackQuery";

export interface SupportPanelProps {
  id: string;
  onBack: () => void;
}

/**
 * Ссылки сервиса поддержки.
 * Настраиваются через VITE_SUPPORT_CHAT_URL / VITE_SUPPORT_REPORT_URL.
 * Пока не настроены — кнопки не показываем (мёртвые ссылки хуже отсутствия).
 */
const SUPPORT_CHAT_URL = import.meta.env.VITE_SUPPORT_CHAT_URL ?? "";
const REPORT_PROBLEM_URL = import.meta.env.VITE_SUPPORT_REPORT_URL ?? "";

const FAQ_ITEMS = [
  {
    id: "how-to-book",
    question: "Как забронировать место?",
    answer:
      "Откройте поездку, выберите свободное место, добавьте комментарий водителю и нажмите «Отправить заявку». После этого водитель сможет подтвердить или отклонить заявку.",
  },
  {
    id: "how-to-cancel",
    question: "Как отменить бронь?",
    answer:
      "Откройте раздел «Мои брони», найдите нужную поездку и нажмите «Отменить заявку», если отмена еще доступна для этой поездки.",
  },
  {
    id: "how-to-review",
    question: "Как оставить отзыв?",
    answer:
      "После завершения поездки в истории поездок появится кнопка «Оставить отзыв». Выберите оценку и добавьте комментарий.",
  },
  {
    id: "driver-not-confirmed",
    question: "Что делать, если водитель долго не подтверждает заявку?",
    answer:
      "Заявка может оставаться в статусе ожидания до решения водителя. Если поездка скоро, попробуйте выбрать другой вариант или написать водителю через поддержку.",
  },
  {
    id: "safety",
    question: "Как работает подтверждение личности?",
    answer:
      "Мы используем данные профиля ВКонтакте и дополнительные проверки для водителей. Подтвержденный профиль повышает доверие к пользователю.",
  },
];

/**
 * Помощь и поддержка:
 * - реальный FAQ;
 * - форма обратной связи (модалка, обращения уходят в backend);
 * - переход в чат поддержки / сообщение о проблеме (если заданы env-ссылки).
 */
export const SupportPanel: FC<SupportPanelProps> = ({ id, onBack }) => {
  const [openedFaqId, setOpenedFaqId] = useState<string | null>(null);
  const modalApi = useModalApi();
  const isAuthed = Boolean(apiClient.getToken());
  const myFeedbacksQuery = useMyFeedbacksQuery(isAuthed);

  const toggleFaq = (faqId: string) => {
    setOpenedFaqId((prev) => (prev === faqId ? null : faqId));
  };

  const handleOpenFeedback = () => {
    void openFeedbackModal(modalApi);
  };

  const handleOpenFeedbackDetail = (feedback: import("@edem/contracts").UserFeedbackDto) => {
    void openFeedbackDetailModal(modalApi, feedback);
  };

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Помощь и поддержка
      </AppPanelHeader>

      <Group header={<Header size="s">Частые вопросы</Header>}>
        {FAQ_ITEMS.map((item) => {
          const isOpen = openedFaqId === item.id;

          return (
            <div key={item.id}>
              <SimpleCell
                chevron="always"
                onClick={() => toggleFaq(item.id)}
                subtitle={isOpen ? "Нажмите, чтобы свернуть" : undefined}
              >
                {item.question}
              </SimpleCell>

              {isOpen && (
                <Box padding="system" paddingBlockStart={0}>
                  <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
                    {item.answer}
                  </Text>
                </Box>
              )}
            </div>
          );
        })}
      </Group>

      <Spacing size={12} />

      {isAuthed && (
        <Group header={<Header size="s">Мои обращения</Header>}>
          {myFeedbacksQuery.isPending && (
            <Box padding="system">
              <Text className="SupportPanel__text--secondary">Загрузка...</Text>
            </Box>
          )}

          {myFeedbacksQuery.isError && (
            <Box padding="system">
              <Text className="SupportPanel__text--negative">
                Не удалось загрузить список обращений
              </Text>
            </Box>
          )}

          {myFeedbacksQuery.data &&
            myFeedbacksQuery.data.length === 0 && (
              <SimpleCell
                multiline
                subtitle="Здесь появятся ваши обращения и ответы поддержки"
              >
                У вас пока нет обращений
              </SimpleCell>
            )}

          {myFeedbacksQuery.data?.map((fb) => (
            <SimpleCell
              key={fb.id}
              chevron="always"
              onClick={() => handleOpenFeedbackDetail(fb)}
              subtitle={new Date(fb.createdAt).toLocaleDateString("ru-RU")}
              after={
                fb.reply ? (
                  <Caption
                    level="1"
                    style={{ color: "var(--vkui--color_text_positive)" }}
                  >
                    Есть ответ
                  </Caption>
                ) : undefined
              }
            >
              {fb.subject}
            </SimpleCell>
          ))}
        </Group>
      )}

      <Spacing size={12} />

      <Group header={<Header size="s">Связаться с нами</Header>}>
        <Box padding="system">
          <Button
            size="m"
            mode="primary"
            stretched
            onClick={handleOpenFeedback}
          >
            Обратная связь
          </Button>

          {SUPPORT_CHAT_URL && (
            <>
              <Spacing size={12} />

              <Button
                size="m"
                mode="secondary"
                stretched
                onClick={() => openExternalUrl(SUPPORT_CHAT_URL)}
              >
                Написать в чат поддержки
              </Button>
            </>
          )}

          {REPORT_PROBLEM_URL && (
            <>
              <Spacing size={12} />

              <Button
                size="m"
                mode="secondary"
                stretched
                onClick={() => openExternalUrl(REPORT_PROBLEM_URL)}
              >
                Сообщить о проблеме с поездкой
              </Button>
            </>
          )}
        </Box>
      </Group>
    </Panel>
  );
};
