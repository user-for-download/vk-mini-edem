// backend/src/auth/index.ts
import { Hono } from "hono";
import { authRequestSchema, refreshRequestSchema } from "@edem/contracts";
import { z } from "zod";
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
        errors: z.formatError(parseResult.error),
      },
      400
    );
  }

  const { searchParams } = parseResult.data;

  // Единственный поддерживаемый формат — полный searchParams из launch-параметров VK.
  // Реконструкция query по отдельным полям (vkUserId/sign/ts) невозможна корректно:
  // подпись VK считается по всем launch-параметрам (vk_app_id, vk_platform и др.),
  // которых в payload нет — такой fallback всегда давал бы 401.
  const queryToVerify = searchParams;

  if (!queryToVerify) {
    return c.json({ message: "Invalid auth payload" }, 400);
  }

  const { isValid, vkUserId } = verifyVkLaunchSignature(queryToVerify);

  if (!isValid || !vkUserId) {
    return c.json({ message: "Invalid or expired signature" }, 401);
  }

  const isProductionVkAuth = !env.ALLOW_DEV_AUTH || !queryToVerify.includes("sign=dev-sign");

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
        isVerified: isProductionVkAuth,
        verificationStatus: isProductionVkAuth ? "approved" : "none",
        verifiedAt: isProductionVkAuth ? new Date() : null,
      },
      include: { car: true },
    });
  } else if (isProductionVkAuth) {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationStatus: "approved",
        verifiedAt: user.verifiedAt ?? new Date(),
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

    // DEV mock refresh: записи в БД нет (jti "dev-jti"), ротация невозможна.
    // Возвращаем свежий mock-токен, чтобы dev-сессия не умирала по истечении access-токена.
    if (env.ALLOW_DEV_AUTH && parseResult.data.refreshToken.startsWith("mock-refresh-token-")) {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { car: true },
      });

      if (!user) {
        return c.json({ message: "User not found" }, 401);
      }

      const accessToken = await signAccessToken(user.id);

      return c.json({
        accessToken,
        refreshToken: `mock-refresh-token-${userId}`,
        expiresIn: env.JWT_ACCESS_TTL_SECONDS,
        user: serializeUser(user),
      });
    }

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
