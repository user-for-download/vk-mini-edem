// backend/src/auth/index.ts
import { Hono } from "hono";
import { authRequestSchema, refreshRequestSchema } from "@edem/contracts";
import { db } from "../db.js";
import { env } from "../env.js";
import { serializeUser } from "../serializers/index.js";

import { verifyVkSignature } from "./vkSign.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

export const authRouter = new Hono();

const authRateLimiter = createRateLimiter({
  windowMs: env.AUTH_RATE_WINDOW_MS,
  max: env.AUTH_RATE_MAX,
  keyPrefix: "auth",
});

authRouter.post("/vk", authRateLimiter, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = authRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      {
        message: "Invalid request payload",
        errors: parseResult.error.format(),
      },
      400
    );
  }

  const { vkUserId, sign, ts } = parseResult.data;

  const isValidSignature = verifyVkSignature({
    vkUserId,
    sign,
    ts,
  });

  if (!isValidSignature) {
    return c.json({ message: "Invalid or expired signature" }, 401);
  }

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
        isVerified: false,
      },
      include: { car: true },
    });
  }

  const accessToken = await signAccessToken(user.id);
  const refreshToken = await signRefreshToken(user.id);

  return c.json({
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    user: serializeUser(user),
  });
});

authRouter.post("/refresh", authRateLimiter, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = refreshRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ message: "Invalid refresh token" }, 400);
  }

  try {
    const userId = await verifyRefreshToken(parseResult.data.refreshToken);

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { car: true },
    });

    if (!user) {
      return c.json({ message: "User not found" }, 401);
    }

    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    return c.json({
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      user: serializeUser(user),
    });
  } catch {
    return c.json({ message: "Invalid refresh token" }, 401);
  }
});
