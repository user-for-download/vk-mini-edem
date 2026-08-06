// backend/src/auth/index.ts
import { Hono } from "hono";
import { authRequestSchema, refreshRequestSchema } from "@edem/contracts";
import { db } from "../db.js";
import { env } from "../env.js";
import { DEFAULT_AVATAR_URL } from "../constants.js";
import { serializeUser } from "../serializers/index.js";

import { verifyVkLaunchSignature } from "./vkSign.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  hashToken,
} from "./tokens.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

export const authRouter = new Hono();

const vkAuthLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  keyPrefix: "auth-vk",
});

const refreshLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-refresh",
});

authRouter.post("/vk", vkAuthLimiter, async (c) => {
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

  const { searchParams, vkUserId: reqVkUserId, sign: reqSign, ts: reqTs } = parseResult.data;

  let queryToVerify = searchParams;
  if (!queryToVerify && reqVkUserId && reqSign) {
    const tsSec = Math.floor((reqTs || Date.now()) / 1000);
    queryToVerify = `vk_user_id=${reqVkUserId}&vk_app_id=0&vk_platform=desktop_web&vk_ts=${tsSec}&sign=${encodeURIComponent(reqSign)}`;
  }

  if (!queryToVerify) {
    return c.json({ message: "Invalid auth payload" }, 400);
  }

  const { isValid, vkUserId } = verifyVkLaunchSignature(queryToVerify);

  if (!isValid || !vkUserId) {
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
        avatar: DEFAULT_AVATAR_URL,
        rating: 5.0,
        reviewsCount: 0,
        tripsCount: 0,
        isVerified: false,
      },
      include: { car: true },
    });
  }

  const accessToken = await signAccessToken(user.id);
  const refreshToken = await signRefreshToken(user.id); // Создаёт запись в БД

  return c.json({
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    user: serializeUser(user),
  });
});

authRouter.post("/refresh", refreshLimiter, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = refreshRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ message: "Invalid refresh token" }, 400);
  }

  try {
    const { userId, jti } = await verifyRefreshToken(
      parseResult.data.refreshToken
    );
    const newJti = await rotateRefreshToken(jti, userId); // Атомарно: отзыв старого + создание нового

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { car: true },
    });

    if (!user) {
      return c.json({ message: "User not found" }, 401);
    }

    const accessToken = await signAccessToken(user.id);
    // Подписываем JWT с newJti без дублирования записи в БД
    const refreshToken = await signRefreshToken(user.id, newJti);

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

authRouter.post("/logout", refreshLimiter, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = refreshRequestSchema.safeParse(body);

  if (parseResult.success) {
    try {
      const { jti } = await verifyRefreshToken(parseResult.data.refreshToken);
      await db.refreshToken.update({
        where: { tokenHash: hashToken(jti) },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Игнорируем — логаут всегда успешен для клиента
    }
  }
  return c.json({ success: true });
});