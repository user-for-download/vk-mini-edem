import { Hono } from "hono";
import { authRequestSchema, refreshRequestSchema } from "@edem/contracts";
import { db } from "../db.js";

export const authRouter = new Hono();

authRouter.post("/vk", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = authRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ message: "Invalid request payload", errors: parseResult.error.format() }, 400);
  }

  const { vkUserId } = parseResult.data;

  let user = await db.user.findFirst({
    where: { vkUserId },
    include: { car: true },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        vkUserId,
        name: `Пользователь VK ${vkUserId}`,
        avatar: `https://i.pravatar.cc/200?u=${vkUserId}`,
        rating: 5.0,
        reviewsCount: 0,
        tripsCount: 0,
        isVerified: true,
      },
      include: { car: true },
    });
  }

  return c.json({
    accessToken: `mock-access-token-${user.id}`,
    refreshToken: `mock-refresh-token-${user.id}`,
    expiresIn: 3600,
    user: {
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
      about: user.about || undefined,
    },
  });
});

authRouter.post("/refresh", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = refreshRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ message: "Invalid token" }, 400);
  }

  const userId = parseResult.data.refreshToken.replace("mock-refresh-token-", "");
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { car: true },
  });

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json({
    accessToken: `mock-access-token-${user.id}`,
    refreshToken: parseResult.data.refreshToken,
    expiresIn: 3600,
    user: {
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
      about: user.about || undefined,
    },
  });
});
