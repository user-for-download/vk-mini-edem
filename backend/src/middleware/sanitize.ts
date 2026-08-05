// backend/src/middleware/sanitize.ts
import type { Context } from "hono";
import DOMPurify from "isomorphic-dompurify";

const SANITIZE_OPTIONS = { ALLOWED_TAGS: [], ALLOWED_ATTR: [] };

/**
 * Рекурсивно очищает все строки в произвольной структуре данных
 * от HTML/JS (XSS). Разрешённых тегов и атрибутов нет — текст
 * остаётся чистым.
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return DOMPurify.sanitize(value, SANITIZE_OPTIONS);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      obj[key] = sanitizeValue((value as Record<string, unknown>)[key]);
    }
    return obj;
  }
  return value;
}

/**
 * Читает JSON-тело запроса и возвращает очищенную от HTML копию.
 * Используется в мутациях вместо прямого `c.req.json()`.
 */
export async function getSanitizedBody(c: Context): Promise<Record<string, unknown>> {
  const raw = await c.req.json().catch(() => ({}));
  return sanitizeValue(raw) as Record<string, unknown>;
}
