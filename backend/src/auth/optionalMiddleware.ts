import type { Context, Next } from "hono";
import { db } from "../db.js";
import { verifyAccessToken } from "./tokens.js";
import type { AuthUser } from "./middleware.js";

export type OptionalAuthEnv = {
  Variables: {
    user?: AuthUser;
  };
};

/**
 * Опциональная авторизация.
 * Если токен валиден и пользователь не забанен — устанавливает c.set("user", ...).
 * Иначе пропускает как гостя (user остаётся undefined): забаненный
 * пользователь трактуется как неаутентифицированный.
 */
export async function optionalAuth(
  c: Context<OptionalAuthEnv>,
  next: Next
) {
  const header =
    c.req.header("Authorization") || c.req.header("authorization");

  if (header) {
    const parts = header.trim().split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      try {
        const userId = await verifyAccessToken(parts[1]);
        const user = await db.user.findUnique({
          where: { id: userId },
          include: { car: true },
        });
        // Забаненный пользователь неотличим от гостя: user не прикрепляем.
        if (user && !user.bannedAt && !user.deletedAt) {
          c.set("user", user);
        }
      } catch {
        // Невалидный токен → гость
      }
    }
  }

  return next();
}
