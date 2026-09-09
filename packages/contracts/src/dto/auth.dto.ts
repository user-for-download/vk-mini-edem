import { z } from "zod";
import { userSchema } from "../schemas/user.schema.js";

// ─── Auth ───────────────────────────────────────────────────────────────────

// Единственный поддерживаемый формат авторизации — полный searchParams из
// launch-параметров VK. Отдельные поля (vkUserId/sign/ts) намеренно НЕ входят
// в контракт: подпись VK считается по всем launch-параметрам, которых в payload
// нет, поэтому реконструкция по отдельным полям невозможна (backend отвечает 400/401).
//
// firstName/lastName/photo — отображаемые профильные данные из VKWebAppGetUserInfo
// (VK Bridge на клиенте). Они НЕ подписаны VK и не влияют на идентификацию и
// isVerified — backend использует их только для заполнения имени/аватара профиля
// (аватар принимается только с VK CDN).
export const authRequestSchema = z.object({
  searchParams: z.string().min(1).max(4096),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  photo: z.string().max(512).optional(),
});

export type AuthRequest = z.infer<typeof authRequestSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  user: userSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

// ─── Telegram ───────────────────────────────────────────────────────────────
/**
 * Telegram Mini Apps auth: клиент присылает RAW initData (query-params
 * строка) РОВНО как её отдал Telegram — ключи/порядок не пересортированы,
 * иначе серверная валидация HMAC не сойдётся. Подпись Telegram покрывает
 * ВСЮ строку (user/auth_date/hash), отдельные поля в контракт не входят —
 * реконструкция по частям невозможна (зеркально политике VK searchParams).
 * Длина: реальная initData ~1-2 КБ; cap 4096 как у VK searchParams.
 */
export const telegramAuthRequestSchema = z.object({
  initData: z.string().min(1).max(4096),
});

export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>;

// ─── Banned Error (403) ────────────────────────────────────────────────────
/**
 * Тело 403-ответа при попытке действия забаненным пользователем.
 * `code` намеренно строковый литерал `"FORBIDDEN"` — точное совпадение
 * со `backend/src/errors.ts::ERROR_CODES.FORBIDDEN`. Не используем enum,
 * чтобы контракт не зависел от серверной реализации.
 * `banReason` — null для старых банов без причины (см. ТЗ: «Причина не указана»).
 */
export const bannedErrorSchema = z
  .object({
    code: z.literal("FORBIDDEN"),
    message: z.string(),
    banReason: z.string().nullable(),
  })
  .strict();

export type BannedError = z.infer<typeof bannedErrorSchema>;
