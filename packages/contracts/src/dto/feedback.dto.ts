import { z } from "zod";

// ─── CreateFeedbackDto ──────────────────────────────────────────────────────
/**
 * Обращение в поддержку из мини-аппа (Профиль → Помощь и поддержка).
 * Лимиты синхронизированы с UI: тема до 100 символов, текст до 2000.
 */
export const FEEDBACK_SUBJECT_MAX_LENGTH = 100;
export const FEEDBACK_TEXT_MAX_LENGTH = 2000;
// Launch-параметры VK (searchParams строка) для апелляции забаненного
// пользователя: лимит с запасом покрывает полную строку query.
export const FEEDBACK_APPEAL_SEARCH_PARAMS_MAX_LENGTH = 4096;

export const createFeedbackDtoSchema = z.object({
  // .trim() — проверка (check) в zod 4: выполняется до min/max, поэтому
  // строки только из пробелов отклоняются, а лимиты применяются к обрезанному
  // значению (backend сохраняет trimmed-значения).
  subject: z.string().trim().min(1).max(FEEDBACK_SUBJECT_MAX_LENGTH),
  text: z.string().trim().min(1).max(FEEDBACK_TEXT_MAX_LENGTH),
});

export type CreateFeedbackDto = z.infer<typeof createFeedbackDtoSchema>;

// ─── FeedbackAppealDto ──────────────────────────────────────────────────────
/**
 * Апелляция забаненного пользователя (публичный эндпоинт, без токена).
 * Личность подтверждается VK-подписью launch-параметров (searchParams),
 * поэтому вместо userId передаётся исходная строка query. Лимиты subject/text
 * идентичны createFeedbackDtoSchema.
 */
export const feedbackAppealDtoSchema = z.object({
  searchParams: z
    .string()
    .trim()
    .min(1)
    .max(FEEDBACK_APPEAL_SEARCH_PARAMS_MAX_LENGTH),
  subject: z.string().trim().min(1).max(FEEDBACK_SUBJECT_MAX_LENGTH),
  text: z.string().trim().min(1).max(FEEDBACK_TEXT_MAX_LENGTH),
});

export type FeedbackAppealDto = z.infer<typeof feedbackAppealDtoSchema>;

// ─── CreateFeedbackResponse ─────────────────────────────────────────────────
export const createFeedbackResponseSchema = z
  .object({
    id: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type CreateFeedbackResponse = z.infer<typeof createFeedbackResponseSchema>;

// ─── AdminFeedbackReplyBody ─────────────────────────────────────────────────
/**
 * Тело POST/PUT /admin/feedback/:id/reply. Текст ответа (≤ 2000, тот же лимит
 * что и у самого обращения). Trim до min-length — пробельные строки отвергаются.
 */
export const feedbackReplyBodySchema = z
  .object({
    reply: z.string().trim().min(1).max(FEEDBACK_TEXT_MAX_LENGTH),
  })
  .strict();

export type FeedbackReplyBody = z.infer<typeof feedbackReplyBodySchema>;

// ─── UserFeedbackDto ────────────────────────────────────────────────────────
/**
 * DTO одного обращения в поддержку для пользователя (мини-апп, раздел
 * «Помощь и поддержка» → «Мои обращения»). Содержит сам текст обращения
 * и, если есть, ответ админа. `reply === null` — ещё не отвечено.
 */
export const userFeedbackDtoSchema = z
  .object({
    id: z.string(),
    subject: z.string(),
    text: z.string(),
    reply: z.string().nullable(),
    repliedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type UserFeedbackDto = z.infer<typeof userFeedbackDtoSchema>;
