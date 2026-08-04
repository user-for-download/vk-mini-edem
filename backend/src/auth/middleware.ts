// backend/src/auth/middleware.ts
import type { Context, Next } from "hono";
import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { verifyAccessToken } from "./tokens.js";
import { ERROR_CODES } from "../errors.js";

export type AuthUser = Prisma.UserGetPayload<{
  include: {
    car: true;
  };
}>;

export type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const header =
    c.req.header("Authorization") ||
    c.req.header("authorization");

  if (!header) {
    return c.json({ code: ERROR_CODES.UNAUTHORIZED, message: "Unauthorized" }, 401);
  }

  const parts = header.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return c.json({ code: ERROR_CODES.UNAUTHORIZED, message: "Unauthorized" }, 401);
  }

  const token = parts[1];

  try {
    const userId = await verifyAccessToken(token);

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { car: true },
    });

    if (!user) {
      return c.json({ code: ERROR_CODES.UNAUTHORIZED, message: "Unauthorized" }, 401);
    }

    c.set("user", user);

    return next();
  } catch {
    return c.json({ code: ERROR_CODES.UNAUTHORIZED, message: "Unauthorized" }, 401);
  }
}

export const requireUser = requireAuth;
