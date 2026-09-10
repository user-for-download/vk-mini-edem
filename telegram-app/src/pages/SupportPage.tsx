import { useRef, useState } from "react";
import { Button, List, Placeholder, Section } from "@telegram-apps/telegram-ui";
import {
  FEEDBACK_SUBJECT_MAX_LENGTH,
  FEEDBACK_TEXT_MAX_LENGTH,
  type UserFeedbackDto,
} from "@edem/contracts";
import { PageHeader } from "@/components/PageHeader";
import { MutationError } from "@/components/MutationError";
import { QueryState } from "@/components/QueryState";
import { AppealForm } from "@/components/AppealForm";
import { ApiError } from "@/api/client";
import {
  useCreateFeedbackMutation,
  useMyFeedbacksQuery,
} from "@/queries/useSupportQuery";
import {
  feedbackErrorMessage,
  normalizeSupportForm,
  validateSupportForm,
} from "@/pages/supportValidation";

/**
 * FAQ поддержки (порт SupportPanel из mini-app): формулировки сохранены,
 * пункт про подтверждение личности адаптирован — вместо данных профиля
 * ВКонтакте используется профиль Telegram.
 */
export const SUPPORT_FAQ: ReadonlyArray<{
  id: string;
  question: string;
  answer: string;
}> = [
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
      "Мы используем данные профиля Telegram и дополнительные проверки для водителей. Подтвержденный профиль повышает доверие к пользователю.",
  },
];

function FeedbackCard({
  feedback,
  opened,
  onToggle,
}: {
  feedback: UserFeedbackDto;
  opened: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="ReviewCard">
      <button
        type="button"
        className="FaqItem__question"
        aria-expanded={opened}
        onClick={onToggle}
      >
        {feedback.subject}
        {feedback.reply && (
          <span className="ReviewCard__badge">
            {" "}
            · Есть ответ
          </span>
        )}
      </button>
      <p className="ReviewCard__route">
        {new Date(feedback.createdAt).toLocaleDateString("ru-RU")}
      </p>
      {opened && (
        <>
          <p className="ReviewCard__text">{feedback.text}</p>
          {feedback.reply ? (
            <>
              <p className="ReviewCard__head">Ответ поддержки</p>
              <p className="ReviewCard__text">{feedback.reply}</p>
            </>
          ) : (
            <p className="ReviewCard__route">
              Поддержка ещё не ответила. Мы свяжемся с вами здесь — список
              обновится автоматически.
            </p>
          )}
        </>
      )}
    </article>
  );
}

/**
 * Помощь и поддержка Telegram-приложения (порт VK SupportPanel):
 * - реальный FAQ;
 * - форма обратной связи (POST /feedback, лимиты 100/2000 из контракта);
 * - «Мои обращения» со статусом ответа (GET /feedback);
 * - обжалование блокировки — рабочая форма через публичный
 *   POST /feedback/appeal с raw initData (TG-ветка backend, без токена).
 */
export function SupportPage() {
  const [openedFaqId, setOpenedFaqId] = useState<string | null>(null);
  const [openedFeedbackId, setOpenedFeedbackId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Защита от двойного сабмита: ref синхронен (в отличие от state),
  // второй клик до ре-рендера не отправит второй запрос (паттерн VK).
  const submitGuard = useRef(false);

  const myFeedbacks = useMyFeedbacksQuery();
  const create = useCreateFeedbackMutation();

  const submit = () => {
    if (create.isPending || submitGuard.current) return;
    const validationError = validateSupportForm(subject, text);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setSuccess(false);
    submitGuard.current = true;
    create.mutate(normalizeSupportForm(subject, text), {
      onSettled: () => {
        submitGuard.current = false;
      },
      onSuccess: () => {
        setSubject("");
        setText("");
        setSuccess(true);
      },
      onError: (error) => setFormError(feedbackErrorMessage(error)),
    });
  };

  const canSubmit =
    subject.trim().length > 0 && text.trim().length > 0 && !create.isPending;

  // Бан mid-session: requireUser отвечает 403 — терминальный экран плюс
  // рабочая форма обжалования (публичный appeal с initData, без токена).
  if (myFeedbacks.error instanceof ApiError && myFeedbacks.error.status === 403) {
    return (
      <>
        <PageHeader title="Поддержка" />
        <Placeholder
          header="Аккаунт заблокирован"
          description="Доступ к обращениям закрыт, но вы можете обжаловать блокировку ниже — обращение уйдёт в поддержку без входа в аккаунт."
        />
        <Section>
          <List>
            <p className="ReviewCard__head">Обжалование блокировки</p>
            <AppealForm />
          </List>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Поддержка" />

      <Section>
        <p className="ReviewCard__head">Частые вопросы</p>
        <List>
          {SUPPORT_FAQ.map((item) => {
            const isOpen = openedFaqId === item.id;
            return (
              <div key={item.id} className="FaqItem">
                <button
                  type="button"
                  className="FaqItem__question"
                  aria-expanded={isOpen}
                  onClick={() => setOpenedFaqId(isOpen ? null : item.id)}
                >
                  {item.question}
                </button>
                {isOpen && <p className="FaqItem__answer">{item.answer}</p>}
              </div>
            );
          })}
        </List>
      </Section>

      <Section>
        <p className="ReviewCard__head">Мои обращения</p>
        <QueryState
          loading={myFeedbacks.isLoading}
          error={myFeedbacks.error}
          empty={false}
          emptyText=""
          onRetry={() => void myFeedbacks.refetch()}
        >
          {!myFeedbacks.data || myFeedbacks.data.length === 0 ? (
            <>
              <p className="ReviewEmpty__title">У вас пока нет обращений</p>
              <p className="ReviewEmpty__subtitle">
                Здесь появятся ваши обращения и ответы поддержки
              </p>
            </>
          ) : (
            <List>
              {myFeedbacks.data.map((feedback) => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  opened={openedFeedbackId === feedback.id}
                  onToggle={() =>
                    setOpenedFeedbackId(
                      openedFeedbackId === feedback.id ? null : feedback.id,
                    )
                  }
                />
              ))}
            </List>
          )}
        </QueryState>
      </Section>

      <Section>
        <List>
          <p className="ReviewCard__head">Связаться с нами</p>
          <MutationError error={create.error} />
          <label className="FormField" htmlFor="support-subject">
            Тема
            <input
              id="support-subject"
              className="TextInput"
              placeholder="Например: не приходит уведомление"
              value={subject}
              maxLength={FEEDBACK_SUBJECT_MAX_LENGTH}
              onChange={(event) => {
                setSubject(event.target.value);
                if (formError) setFormError(null);
                if (success) setSuccess(false);
              }}
            />
          </label>
          <label className="FormField" htmlFor="support-text">
            Сообщение
            <textarea
              id="support-text"
              className="ProfileTextarea"
              rows={4}
              maxLength={FEEDBACK_TEXT_MAX_LENGTH}
              placeholder="Расскажите подробнее, что произошло"
              value={text}
              aria-invalid={Boolean(formError)}
              onChange={(event) => {
                setText(event.target.value);
                if (formError) setFormError(null);
                if (success) setSuccess(false);
              }}
            />
          </label>
          {text.length > 0 && (
            <p className="ReviewCounter" aria-live="polite">
              {text.length}/{FEEDBACK_TEXT_MAX_LENGTH}
            </p>
          )}
          {formError && (
            <p className="FormError" role="alert">
              {formError}
            </p>
          )}
          {success && (
            <p className="ReviewSuccess" role="status">
              Обращение отправлено — мы ответим вам как можно скорее
            </p>
          )}
          <div className="ButtonRow">
            <Button
              stretched
              loading={create.isPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              Отправить
            </Button>
          </div>
        </List>
      </Section>

      <Section>
        <List>
          <p className="ReviewCard__head">Обжалование блокировки</p>
          <AppealForm />
        </List>
      </Section>
    </>
  );
}
