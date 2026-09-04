// backend/src/auth/vkProfile.ts
// Извлечение отображаемого профиля (имя/фото) при входе через VK.
//
// Источники (по приоритету):
// 1. Поля firstName/lastName/photo в теле /auth/vk — фронтенд достаёт их
//    через VK Bridge VKWebAppGetUserInfo (photo_200).
// 2. Launch-параметры VK (first_name/last_name/photo) — fallback; на практике
//    VK их туда обычно не кладёт, но стоимость поддержки нулевая.
//
// ВАЖНО: ни один из источников не подписан VK (подпись покрывает только
// vk_* параметры), поэтому данные используются ТОЛЬКО как отображаемые:
// имя пользователь и так может редактировать через PATCH /users/me, аватар
// принимается только с VK CDN (https + allowlist хостов). Идентификация —
// только по подписанному vk_user_id.
import { sanitizeValue } from "../middleware/sanitize.js";

export interface VkProfile {
  /** «Имя Фамилия», либо null если данных нет/они пустые. */
  name: string | null;
  /** HTTPS-URL фото с VK CDN, либо null. */
  avatar: string | null;
}

/** Поля профильных данных из тела запроса (VKWebAppGetUserInfo на клиенте). */
export interface VkProfileFields {
  firstName?: unknown;
  lastName?: unknown;
  photo?: unknown;
}

const NAME_PART_MAX = 50;
const NAME_MAX = 100;

/** Хосты VK CDN, с которых разрешено принимать аватар. */
const ALLOWED_AVATAR_HOSTS = [
  "userapi.com",
  "vk.com",
  "vk.ru",
  "mvk.com",
  "vk-cdn.ru",
];

function isAllowedAvatarHost(hostname: string): boolean {
  return ALLOWED_AVATAR_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
}

/**
 * Валидирует URL аватара: только https и только VK CDN.
 * Всё остальное (http, чужие домены, не-URL) → null.
 */
export function sanitizeAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (!isAllowedAvatarHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Чистит часть имени (first_name / last_name): HTML вырезается sanitize'ом,
 * повторяющиеся пробелы схлопываются, длина ограничивается.
 */
function cleanNamePart(value: string | null): string {
  if (!value) return "";
  const sanitized = sanitizeValue(value);
  if (typeof sanitized !== "string") return "";
  return sanitized.replace(/\s+/g, " ").trim().slice(0, NAME_PART_MAX);
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Собирает профиль из двух источников: поля тела запроса (приоритет) и
 * launch-параметры VK (fallback по каждому полю отдельно).
 */
export function resolveVkProfile(
  fields: VkProfileFields,
  rawSearchParams: string
): VkProfile {
  const params = new URLSearchParams(rawSearchParams);

  const firstName = cleanNamePart(
    pickString(fields.firstName) ?? params.get("first_name")
  );
  const lastName = cleanNamePart(
    pickString(fields.lastName) ?? params.get("last_name")
  );
  const name = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
    .slice(0, NAME_MAX);

  const avatar =
    sanitizeAvatarUrl(pickString(fields.photo)) ??
    sanitizeAvatarUrl(params.get("photo"));

  return { name: name || null, avatar };
}
