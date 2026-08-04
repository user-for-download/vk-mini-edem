import { Hono } from "hono";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { serializeUser } from "../serializers/index.js";
import { publicReadLimiter } from "../middleware/rateLimit.js";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  about: z.string().max(500).nullable().optional(),
});

const carFormSchema = z.object({
  model: z.string().min(1).max(50),
  color: z.string().min(1).max(30),
  plate: z.string().min(1).max(15),
});

const updateNotificationSettingsSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
});

export const usersRouter = new Hono<AuthEnv>();

/**
 * Текущий пользователь.
 */
usersRouter.get("/me", requireUser, async (c) => {
  const user = c.get("user");

  return c.json(serializeUser(user));
});

usersRouter.patch("/me/notification-settings", requireUser, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateNotificationSettingsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ message: "Invalid payload" }, 400);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { notificationsEnabled: parseResult.data.notificationsEnabled ?? user.notificationsEnabled },
    include: { car: true },
  });

  return c.json(serializeUser(updated));
});

usersRouter.post("/me/request-verification", requireUser, async (c) => {
  const user = c.get("user");

  if (user.verificationStatus === "pending") {
    return c.json({ message: "Verification already requested" }, 400);
  }
  if (user.verificationStatus === "approved") {
    return c.json({ message: "User already verified" }, 400);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { verificationStatus: "pending" },
    include: { car: true },
  });

  return c.json(serializeUser(updated));
});

/**
 * Редактирование профиля текущего пользователя.
 */
usersRouter.patch("/me", requireUser, async (c) => {
  const user = c.get("user");

  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateProfileSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400
    );
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      name: parseResult.data.name ?? user.name,
      about:
        parseResult.data.about === undefined
          ? user.about
          : parseResult.data.about,
    },
    include: {
      car: true,
    },
  });

  return c.json(serializeUser(updated));
});

/**
 * Создать или обновить машину текущего пользователя.
 */
usersRouter.post("/me/car", requireUser, async (c) => {
  const user = c.get("user");

  const body = await c.req.json().catch(() => ({}));
  const parseResult = carFormSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400
    );
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      car: {
        upsert: {
          create: parseResult.data,
          update: parseResult.data,
        },
      },
    },
    include: {
      car: true,
    },
  });

  return c.json(serializeUser(updated));
});

/**
 * Алиас для обновления машины.
 */
usersRouter.patch("/me/car", requireUser, async (c) => {
  const user = c.get("user");

  const body = await c.req.json().catch(() => ({}));
  const parseResult = carFormSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400
    );
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      car: {
        upsert: {
          create: parseResult.data,
          update: parseResult.data,
        },
      },
    },
    include: {
      car: true,
    },
  });

  return c.json(serializeUser(updated));
});

/**
 * Публичный профиль пользователя.
 */
usersRouter.get("/:id", publicReadLimiter, async (c) => {
  const id = c.req.param("id");

  const user = await db.user.findUnique({
    where: { id },
    include: {
      car: true,
    },
  });

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json(serializeUser(user));
});
