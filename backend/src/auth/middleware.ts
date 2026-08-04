import type { Context, Next } from "hono";
import type { Car, User as PrismaUser } from "@prisma/client";
import { db } from "../db.js";

export type AuthUser = PrismaUser & {
  car: Car | null;
};

export type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

const ACCESS_TOKEN_PREFIX = "mock-access-token-";

export async function requireUser(c: Context<AuthEnv>, next: Next) {
  const header =
    c.req.header("Authorization") ||
    c.req.header("authorization");

  if (!header) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const parts = header.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const token = parts[1];

  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) {
    return c.json({ message: "Invalid access token" }, 401);
  }

  const userId = token.slice(ACCESS_TOKEN_PREFIX.length);

  if (!userId) {
    return c.json({ message: "Invalid access token" }, 401);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { car: true },
  });

  if (!user) {
    return c.json({ message: "User not found" }, 401);
  }

  c.set("user", user);

  return next();
}
