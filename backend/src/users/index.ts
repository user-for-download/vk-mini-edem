import { Hono } from "hono";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";

type UserWithCar = Prisma.UserGetPayload<{
  include: {
    car: true;
  };
}>;

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  about: z.string().max(500).nullable().optional(),
});

const carFormSchema = z.object({
  model: z.string().min(1).max(50),
  color: z.string().min(1).max(30),
  plate: z.string().min(1).max(15),
});

function serializeUser(user: UserWithCar) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    rating: user.rating,
    reviewsCount: user.reviewsCount,
    tripsCount: user.tripsCount,
    isVerified: user.isVerified,
    car: user.car
      ? {
          model: user.car.model,
          color: user.car.color,
          plate: user.car.plate,
        }
      : undefined,
    about: user.about ?? undefined,
    createdAt: user.createdAt.toISOString(),
  };
}

export const usersRouter = new Hono<AuthEnv>();

/**
 * Текущий пользователь.
 */
usersRouter.get("/me", requireUser, async (c) => {
  const user = c.get("user");

  return c.json(serializeUser(user));
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
usersRouter.get("/:id", async (c) => {
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
