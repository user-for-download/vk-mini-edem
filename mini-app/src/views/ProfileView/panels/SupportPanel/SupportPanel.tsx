import { type FC, useState } from "react";
import {
  Box,
  Button,
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  SimpleCell,
  Spacing,
  Text,
} from "@vkontakte/vkui";
import { bridge } from "@/helpers/bridge";
import { AppPanelHeader } from "@/components/AppPanelHeader";

export interface SupportPanelProps {
  id: string;
  onBack: () => void;
}

/**
 * Ссылки сервиса поддержки.
 */
const SUPPORT_CHAT_URL = "https://vk.com/im?sel=-100000000";
const REPORT_PROBLEM_URL = "https://vk.com/im?sel=-100000000";

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

function openExternalUrl(url: string) {
  try {
    if (bridge.isWebView()) {
      void (bridge.send as any)("VKWebAppOpenUrl", { url });
      return;
    }
  } catch {
    // ignore
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Помощь и поддержка:
 * - реальный FAQ;
 * - переход в чат поддержки;
 * - сообщение о проблеме.
 */
export const SupportPanel: FC<SupportPanelProps> = ({ id, onBack }) => {
  const [openedFaqId, setOpenedFaqId] = useState<string | null>(null);

  const toggleFaq = (faqId: string) => {
    setOpenedFaqId((prev) => (prev === faqId ? null : faqId));
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
                <Box padding="system" style={{ paddingTop: 0 }}>
                  <Text
                    style={{
                      color: "var(--vkui--color_text_secondary)",
                    }}
                  >
                    {item.answer}
                  </Text>
                </Box>
              )}
            </div>
          );
        })}
      </Group>

      <Spacing size={12} />

      <Group header={<Header size="s">Связаться с нами</Header>}>
        <Box padding="system">
          <Button
            size="m"
            mode="primary"
            stretched
            onClick={() => openExternalUrl(SUPPORT_CHAT_URL)}
          >
            Написать в чат поддержки
          </Button>

          <Spacing size={12} />

          <Button
            size="m"
            mode="secondary"
            stretched
            onClick={() => openExternalUrl(REPORT_PROBLEM_URL)}
          >
            Сообщить о проблеме с поездкой
          </Button>
        </Box>
      </Group>
    </Panel>
  );
};
