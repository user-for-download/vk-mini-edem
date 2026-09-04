// backend/src/admin/guard.ts
// Доступ к админ-API: JWT из httpOnly cookie edem_admin_jwt.
// JWT выдаётся на POST /api/v1/admin/auth/login после проверки ADMIN_TOKEN.
import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { env } from "../env.js";
import { ERROR_CODES } from "../errors.js";
import { verifyAdminAccessToken } from "../auth/tokens.js";

export const ADMIN_COOKIE_NAME = "edem_admin_jwt";

/**
 * Guard для /api/v1/admin.
 *
 * Закрыто по умолчанию: если ADMIN_TOKEN не задан (пустая строка),
 * ВСЕ запросы отклоняются с 403 в любой среде (включая development) —
 * логин в таком состоянии тоже невозможен.
 *
 * Отсутствие/невалидность cookie — 401 Unauthorized (нет сессии).
 */
export const adminGuard: MiddlewareHandler = async (c, next) => {
  if (!env.ADMIN_TOKEN) {
    return c.json(
      { code: ERROR_CODES.FORBIDDEN, message: "Admin access disabled" },
      403
    );
  }

  const token = getCookie(c, ADMIN_COOKIE_NAME);
  if (!token) {
    return c.json(
      { code: ERROR_CODES.UNAUTHORIZED, message: "Admin session required" },
      401
    );
  }

  try {
    await verifyAdminAccessToken(token);
  } catch {
    return c.json(
      { code: ERROR_CODES.UNAUTHORIZED, message: "Invalid or expired admin session" },
      401
    );
  }

  await next();
};
