import { useRef, useState } from "react";
import { Button, List, Placeholder, Section } from "@telegram-apps/telegram-ui";
import { REPORT_CATEGORIES, type Report } from "@edem/contracts";
import { REPORT_DESCRIPTION_MAX_LENGTH } from "@edem/contracts";
import { PageHeader } from "@/components/PageHeader";
import { MutationError } from "@/components/MutationError";
import { QueryState } from "@/components/QueryState";
import { ApiError } from "@/api/client";
import {
  useCreateReportMutation,
  useMyReportsQuery,
} from "@/queries/useReportQuery";
import {
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_TYPE_LABELS,
  hasExistingReport,
  isReportCategory,
  isReportTargetType,
  reportErrorMessage,
  validateReportForm,
  type ReportTargetType,
} from "@/pages/reportValidation";

function formatDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ReportCard({ report }: { report: Report }) {
  return (
    <article className="ReviewCard">
      <p className="ReviewCard__head">
        {REPORT_CATEGORY_LABELS[report.category]} · {REPORT_TARGET_TYPE_LABELS[report.targetType]}
        <span className="ReviewCard__badge" data-status={report.status}>
          {" "}
          · {REPORT_STATUS_LABELS[report.status]}
        </span>
      </p>
      <p className="ReviewCard__route">{formatDate(report.createdAt)}</p>
      <p className="ReviewCard__text">{report.description}</p>
    </article>
  );
}

/**
 * Жалобы Telegram-приложения (порт VK ReportModal как отдельный раздел +
 * список своих жалоб):
 * - создание: тип объекта + идентификатор + категория + описание (≤ 2000);
 * - клиентский хинт лимита «1 жалоба навсегда» (hasExistingReport),
 *   сервер — источник правды (409);
 * - список своих жалоб со статусами модерации.
 */
export function ReportsPage() {
  const [targetType, setTargetType] = useState<ReportTargetType>("trip");
  const [targetId, setTargetId] = useState("");
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]>("safety");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Защита от двойного сабмита: ref синхронен (в отличие от state),
  // второй клик до ре-рендера не отправит второй запрос (паттерн VK).
  const submitGuard = useRef(false);

  const myReports = useMyReportsQuery();
  const create = useCreateReportMutation();

  const alreadyReported = hasExistingReport(
    myReports.data ?? [],
    targetType,
    targetId,
  );

  const submit = () => {
    if (create.isPending || submitGuard.current) return;
    const validationError = validateReportForm(targetId, description);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (alreadyReported) {
      setFormError("Жалоба уже отправлена: повторная жалоба на этот объект недоступна.");
      return;
    }
    setFormError(null);
    setSuccess(false);
    submitGuard.current = true;
    create.mutate(
      {
        targetType,
        targetId: targetId.trim(),
        category,
        description: description.trim(),
      },
      {
        onSettled: () => {
          submitGuard.current = false;
        },
        onSuccess: () => {
          setTargetId("");
          setDescription("");
          setSuccess(true);
        },
        onError: (error) => setFormError(reportErrorMessage(error)),
      },
    );
  };

  const canSubmit =
    targetId.trim().length > 0 &&
    description.trim().length > 0 &&
    !alreadyReported &&
    !create.isPending;

  // Бан mid-session: requireUser отвечает 403 — терминальный экран вместо
  // общей ошибки (паттерн ProfilePage; глобальные случаи закрывает AuthGate).
  if (myReports.error instanceof ApiError && myReports.error.status === 403) {
    return (
      <>
        <PageHeader title="Жалобы" />
        <Placeholder
          header="Аккаунт заблокирован"
          description="Действие недоступно: аккаунт заблокирован."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Жалобы" />

      <Section>
        <List>
          <p className="ReviewCard__head">Сообщите о проблеме</p>
          <MutationError error={create.error} />
          <label className="FormField" htmlFor="report-target-type">
            Что случилось
            <select
              id="report-target-type"
              className="ReviewSelect"
              value={targetType}
              onChange={(event) => {
                const next = event.target.value;
                if (!isReportTargetType(next)) return;
                setTargetType(next);
                if (formError) setFormError(null);
              }}
            >
              {(Object.keys(REPORT_TARGET_TYPE_LABELS) as ReportTargetType[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {REPORT_TARGET_TYPE_LABELS[value]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="FormField" htmlFor="report-target-id">
            Идентификатор объекта
            <input
              id="report-target-id"
              className="TextInput"
              placeholder="Например: идентификатор поездки из её страницы"
              value={targetId}
              onChange={(event) => {
                setTargetId(event.target.value);
                if (formError) setFormError(null);
                if (success) setSuccess(false);
              }}
            />
          </label>
          <label className="FormField" htmlFor="report-category">
            Причина
            <select
              id="report-category"
              className="ReviewSelect"
              value={category}
              onChange={(event) => {
                const next = event.target.value;
                if (!isReportCategory(next)) return;
                setCategory(next);
              }}
            >
              {REPORT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {REPORT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="FormField" htmlFor="report-description">
            Описание
            <textarea
              id="report-description"
              className="ProfileTextarea"
              rows={4}
              maxLength={REPORT_DESCRIPTION_MAX_LENGTH}
              placeholder="Опишите, что произошло"
              value={description}
              aria-invalid={Boolean(formError)}
              onChange={(event) => {
                setDescription(event.target.value);
                if (formError) setFormError(null);
                if (success) setSuccess(false);
              }}
            />
          </label>
          {description.length > 0 && (
            <p className="ReviewCounter" aria-live="polite">
              {description.length}/{REPORT_DESCRIPTION_MAX_LENGTH}
            </p>
          )}
          {alreadyReported && (
            <p className="ReviewCounter" aria-live="polite">
              Вы уже отправляли жалобу на этот объект. Повторная отправка недоступна.
            </p>
          )}
          {formError && (
            <p className="FormError" role="alert">
              {formError}
            </p>
          )}
          {success && (
            <p className="ReviewSuccess" role="status">
              Жалоба отправлена
            </p>
          )}
          <div className="ButtonRow">
            <Button
              stretched
              loading={create.isPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              {alreadyReported ? "Жалоба уже отправлена" : "Отправить жалобу"}
            </Button>
          </div>
        </List>
      </Section>

      <Section>
        <p className="ReviewCard__head">Мои жалобы</p>
        <QueryState
          loading={myReports.isLoading}
          error={myReports.error}
          empty={false}
          emptyText=""
          onRetry={() => void myReports.refetch()}
        >
          {!myReports.data || myReports.data.length === 0 ? (
            <>
              <p className="ReviewEmpty__title">Вы пока не отправляли жалоб</p>
              <p className="ReviewEmpty__subtitle">
                Жалобы на поездки доступны пассажирам с бронью. На свою поездку
                жаловаться нельзя.
              </p>
            </>
          ) : (
            <List>
              {myReports.data.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </List>
          )}
        </QueryState>
      </Section>
    </>
  );
}
