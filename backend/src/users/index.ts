import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { completeOnboardingBodySchema } from "@edem/contracts";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { serializeUser } from "../serializers/index.js";
import { publicReadLimiter, mutationLimiter, profileUpdateLimiter } from "../middleware/rateLimit.js";
import { getSanitizedBody } from "../middleware/sanitize.js";
import { wsManager } from "../ws/manager.js";
import { revokeAllActiveTokens } from "../auth/tokens.js";
import { ERROR_CODES } from "../errors.js";
import { DEFAULT_AVATAR_URL } from "../constants.js";

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

usersRouter.delete("/me", requireUser, mutationLimiter, async (c) => {
  const user = c.get("user");
  const now = new Date();
  const activeTrip = await db.trip.findFirst({ where: { driverId: user.id, status: "active" }, select: { id: true } });
  const activeBooking = await db.booking.findFirst({ where: { passengerId: user.id, status: { in: ["pending", "confirmed"] }, trip: { status: "active", departureAt: { gt: now } } }, select: { id: true } });
  if (activeTrip || activeBooking) return c.json({ code: "ACCOUNT_HAS_ACTIVE_OBLIGATIONS", message: "Resolve active trips and bookings first" }, 409);

  await db.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.feedback.deleteMany({ where: { userId: user.id } });
    await tx.rideRequest.updateMany({ where: { userId: user.id, status: { in: ["active", "paused"] } }, data: { status: "cancelled" } });
    await tx.car.deleteMany({ where: { userId: user.id } });
    // Keep the signed VK identity as a tombstone: clearing it would allow the
    // next VK login to create a second account for the same person.
    await tx.user.update({ where: { id: user.id }, data: { deletedAt: now, name: "Удалённый пользователь", avatar: DEFAULT_AVATAR_URL, about: null, rating: 5, reviewsCount: 0, tripsCount: 0, onboardingVersion: null } });
  }, { isolationLevel: "Serializable" });
  wsManager.closeUserConnections(user.id, 4403, "Account deleted");
  await revokeAllActiveTokens(user.id);
  return c.json({ success: true });
});

/**
 * Текущий пользователь.
 */
usersRouter.get("/me", requireUser, async (c) => {
  const user = c.get("user");

  return c.json(serializeUser(user));
});

usersRouter.patch("/me/notification-settings", requireUser, async (c) => {
  const user = c.get("user");
  const body = await getSanitizedBody(c);
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

/**
 * Завершение онбординга: сохраняем версию показанных слайдов.
 * При обновлении набора слайдов клиент повышает версию и проходит
 * онбординг заново; админка может сбросить флаг в null
 * (PATCH /admin/users/:id/onboarding-reset) для повторного показа.
 */
usersRouter.post("/me/onboarding", requireUser, mutationLimiter, async (c) => {
  const user = c.get("user");
  const body = await getSanitizedBody(c);
  const parseResult = completeOnboardingBodySchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ message: "Invalid payload" }, 400);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { onboardingVersion: parseResult.data.version },
    include: { car: true },
  });

  return c.json(serializeUser(updated));
});

/**
 * Редактирование профиля текущего пользователя.
 */
usersRouter.patch("/me", requireUser, profileUpdateLimiter, async (c) => {
  const user = c.get("user");

  const body = await getSanitizedBody(c);
  const parseResult = updateProfileSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: z.formatError(parseResult.error) },
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

async function upsertCar(c: Context<AuthEnv>) {
  const user = c.get("user");

  const body = await getSanitizedBody(c);
  const parseResult = carFormSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: z.formatError(parseResult.error) },
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
}

/**
 * Создать или обновить машину текущего пользователя.
 */
usersRouter.post("/me/car", requireUser, profileUpdateLimiter, upsertCar);

/**
 * Алиас для обновления машины.
 */
usersRouter.patch("/me/car", requireUser, profileUpdateLimiter, upsertCar);

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

  return c.json(serializeUser(user, { includePlate: false }));
});
