// backend/src/auth/index.ts
import { Hono } from "hono";
import { Prisma } from "../generated/prisma/client.js";
import { authRequestSchema, refreshRequestSchema } from "@edem/contracts";
import { z } from "zod";
import { db } from "../db.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { ERROR_CODES } from "../errors.js";
import { DEFAULT_AVATAR_URL } from "../constants.js";
import { serializeUser } from "../serializers/index.js";

import { verifyVkLaunchSignature } from "./vkSign.js";
import { resolveVkProfile } from "./vkProfile.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeAllActiveTokens,
  RefreshTokenRevokedError,
  hashToken,
  MOCK_REFRESH_TOKEN_PREFIX,
} from "./tokens.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

export const authRouter = new Hono();

const vkAuthLimiter = createRateLimiter({
  windowMs: env.VK_AUTH_RATE_WINDOW_MS,
  max: env.VK_AUTH_RATE_MAX,
  keyPrefix: "auth-vk",
});

const refreshLimiter = createRateLimiter({
  windowMs: env.REFRESH_RATE_WINDOW_MS,
  max: env.REFRESH_RATE_MAX,
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

  // Отображаемые профильные данные: фронтенд достаёт имя/фото через
  // VKWebAppGetUserInfo и присылает в теле запроса; launch-параметры VK —
  // fallback. Данные не подписаны VK → только display (аватар — лишь с VK CDN),
  // идентификация по подписанному vk_user_id.
  const { name: vkName, avatar: vkAvatar } = resolveVkProfile(
    {
      firstName: parseResult.data.firstName,
      lastName: parseResult.data.lastName,
      photo: parseResult.data.photo,
    },
    queryToVerify
  );
  const placeholderName = `Пользователь VK ${vkUserId}`;

  // The unique VK ID is the synchronization point for concurrent launches.
  //
  // ВАЖНО: Prisma генерирует upsert как SELECT по vkUserId, затем INSERT
  // (а не INSERT ... ON CONFLICT DO UPDATE). При ПУСТОМ update (аватар не
  // пришёл из VK CDN) у INSERT нет ни ON CONFLICT, ни DO UPDATE: два
  // конкурентных запуска одновременно видят «пользователя нет» и оба делают
  // INSERT — один коммитится, второй получает P2002 (unique violation).
  // Ретраем один раз: при повторе SELECT увидит созданную строку и upsert
  // пойдёт по update-ветке. Данные не нарушаются (дублей не возникает),
  // ретрай нужен, чтобы второй клиент не получил 500.
  const upsertUser = () =>
    db.user.upsert({
      where: { vkUserId },
      create: {
        vkUserId,
        name: vkName ?? placeholderName,
        avatar: vkAvatar ?? DEFAULT_AVATAR_URL,
        rating: 5.0,
        reviewsCount: 0,
        tripsCount: 0,
        // VK-authed = verified. Аутентификация через подписанные параметры
        // запуска VK — это и есть верификация; отдельной модерации не требуется.
        isVerified: true,
        verifiedAt: new Date(),
      },
      update: {
        // Аватар не редактируется через API — при каждом входе синхронизируем
        // с актуальным фото из VK.
        ...(vkAvatar ? { avatar: vkAvatar } : {}),
      },
      include: { car: true },
    });

  let user;
  try {
    user = await upsertUser();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Гонка конкурентных запусков: другой запрос успел создать пользователя.
      user = await upsertUser();
    } else {
      throw error;
    }
  }

  // Существующих пользователей с placeholder-именем («Пользователь VK …»)
  // дописываем реальным VK-именем; вручную отредактированное имя
  // (PATCH /users/me) не перезаписываем.
  const finalUser =
    vkName && user.name === placeholderName
      ? await db.user.update({
          where: { id: user.id },
          data: { name: vkName },
          include: { car: true },
        })
      : user;

  // Проверка бана ДО выпуска токенов: единая точка отказа и для реальной
  // VK-авторизации, и для dev-auth (ALLOW_DEV_AUTH) — обе ветки сходятся
  // здесь после upsert. Забаненный пользователь не должен попадать
  // в приложение; существующие refresh-токены отзываем, чтобы бан нельзя
  // было обойти через другую активную сессию.
  if (finalUser.bannedAt) {
    const revokedCount = await revokeAllActiveTokens(finalUser.id);
    logger.warn(
      { userId: finalUser.id, revokedCount },
      "[Auth] VK login rejected — user is banned"
    );
    return c.json(
      {
        code: ERROR_CODES.FORBIDDEN,
        message: "Account is banned",
        banReason: finalUser.banReason ?? null,
      },
      403
    );
  }

  if (finalUser.deletedAt) {
    return c.json({ code: ERROR_CODES.FORBIDDEN, message: "Account is deleted" }, 403);
  }

  const accessToken = await signAccessToken(finalUser.id);
  const refreshToken = await signRefreshToken(finalUser.id); // Создаёт запись в БД

  return c.json({
    accessToken,
    refreshToken,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    user: serializeUser(finalUser),
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
    // Возвращаем свежий mock-токен с НОВЫМ exp (TTL DEV_MOCK_TOKEN_TTL_SECONDS),
    // чтобы dev-сессия не умирала по истечении access-токена.
    if (env.ALLOW_DEV_AUTH && parseResult.data.refreshToken.startsWith(MOCK_REFRESH_TOKEN_PREFIX)) {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { car: true },
      });

      if (!user) {
        return c.json({ message: "User not found" }, 401);
      }

      // Единообразно с основной веткой: забаненному пользователю токены
      // не выдаём. Записи refresh-токена в БД нет (jti "dev-jti") —
      // отзываем только реальные токены, если они есть.
       if (user.deletedAt) {
         await revokeAllActiveTokens(user.id);
         return c.json({ code: ERROR_CODES.FORBIDDEN, message: "Account is deleted" }, 403);
       }

       if (user.bannedAt) {
        await revokeAllActiveTokens(user.id);
        return c.json(
          {
            code: ERROR_CODES.FORBIDDEN,
            message: "Account is banned",
            banReason: user.banReason ?? null,
          },
          403
        );
      }

      const accessToken = await signAccessToken(user.id);
      // Новый exp: mock refresh-токен несёт TTL (security-audit: mocks
      // с коротким TTL), бесконечно живой refresh больше не выдаётся.
      const refreshExp = Math.floor(Date.now() / 1000) + env.DEV_MOCK_TOKEN_TTL_SECONDS;

      return c.json({
        accessToken,
        refreshToken: `${MOCK_REFRESH_TOKEN_PREFIX}${userId}-${refreshExp}`,
        expiresIn: env.JWT_ACCESS_TTL_SECONDS,
        user: serializeUser(user),
      });
    }

    // Проверка бана ДО ротации и выпуска токенов: забаненный пользователь
    // не должен получать новые токены. Все активные refresh-токены
    // отзываем, чтобы бан нельзя было обойти через другую сессию.
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { car: true },
    });

    if (!user) {
      return c.json({ message: "User not found" }, 401);
    }

     if (user.deletedAt) {
       await revokeAllActiveTokens(user.id);
       return c.json({ code: ERROR_CODES.FORBIDDEN, message: "Account is deleted" }, 403);
     }

     if (user.bannedAt) {
      const revokedCount = await revokeAllActiveTokens(user.id);
      logger.warn(
        { userId: user.id, revokedCount },
        "[Auth] Refresh rejected — user is banned"
      );
      return c.json(
        {
          code: ERROR_CODES.FORBIDDEN,
          message: "Account is banned",
          banReason: user.banReason ?? null,
        },
        403
      );
    }

    const newJti = await rotateRefreshToken(jti, userId); // Атомарно: отзыв старого + создание нового

    const accessToken = await signAccessToken(user.id);
    // Подписываем JWT с newJti без дублирования записи в БД
    const refreshToken = await signRefreshToken(user.id, newJti);

    return c.json({
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      user: serializeUser(user),
    });
  } catch (error) {
    // Reuse detection: предъявление уже отозванного (ротированного) токена —
    // признак кражи. Отзываем ВСЕ активные токены пользователя, чтобы
    // украденная цепочка не могла быть использована (OAuth 2.0 BCP).
    if (error instanceof RefreshTokenRevokedError) {
      // Отзыв в отдельном try/catch: сбой БД при отзыве не должен менять
      // ответ (всегда 401) и терять security-событие в логах.
      try {
        const revokedCount = await revokeAllActiveTokens(error.userId);
        logger.warn(
          { userId: error.userId, revokedCount },
          "[Auth] Refresh token reuse detected — all active tokens revoked"
        );
      } catch (revokeError) {
        logger.error(
          { userId: error.userId, err: revokeError },
          "[Auth] Refresh token reuse detected — failed to revoke active tokens"
        );
      }
    }
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
