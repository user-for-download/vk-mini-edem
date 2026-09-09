// backend/src/auth/telegramProfile.ts
// Извлечение отображаемого профиля (имя/фото) при входе через Telegram.
//
// Источник один — user-объект из ПОДПИСАННОЙ initData (после успешной
// верификации в telegramSign.ts). В отличие от VK (где имя/фото приходят
// неподписанным телом запроса), здесь данные подписаны Telegram.
//
// Тем не менее применяем ту же санитизацию, что и в vkProfile.ts
// (defense in depth): имя чистится от HTML и нормализуется, аватар
// принимается только по https с allowlist-хостов Telegram CDN —
// пользовательский контент не должен попадать в БД «как есть».
import { sanitizeValue } from "../middleware/sanitize.js";
import type { TelegramInitUser } from "./telegramSign.js";

export interface TelegramProfile {
  /** «Имя Фамилия», либо null если данных нет/они пустые. */
  name: string | null;
  /** HTTPS-URL фото с Telegram CDN, либо null. */
  avatar: string | null;
}

const NAME_PART_MAX = 50;
const NAME_MAX = 100;

/**
 * Хосты Telegram CDN, с которых разрешено принимать аватар.
 * photo_url приходит в формате https://t.me/i/userpic/...
 */
const ALLOWED_AVATAR_HOSTS = ["t.me", "telegram.org"];

function isAllowedAvatarHost(hostname: string): boolean {
  return ALLOWED_AVATAR_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

/**
 * Валидирует URL аватара: только https и только Telegram CDN.
 * Всё остальное (http, чужие домены, не-URL) → null.
 * Аналог sanitizeAvatarUrl из vkProfile.ts.
 */
export function sanitizeTelegramAvatarUrl(
  raw: string | null | undefined,
): string | null {
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

/**
 * Собирает display-профиль из подписанного user-объекта initData.
 * name — «Имя Фамилия»; при отсутствии обоих полей — username
 * (у TG-юзеров first_name есть почти всегда, но ТЗ требует fallback).
 */
export function resolveTelegramProfile(
  user: TelegramInitUser | undefined,
): TelegramProfile {
  if (!user) return { name: null, avatar: null };

  const firstName = cleanNamePart(user.firstName ?? null);
  const lastName = cleanNamePart(user.lastName ?? null);
  let name = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!name && user.username) {
    // username валиден только ^[A-Za-z0-9_]{5,32}$ по правилам Telegram,
    // но не доверяем входу на слово — чистим тем же sanitize.
    name = cleanNamePart(user.username);
  }

  return {
    name: name ? name.slice(0, NAME_MAX) : null,
    avatar: sanitizeTelegramAvatarUrl(user.photoUrl),
  };
}
