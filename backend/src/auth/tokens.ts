// backend/src/auth/tokens.ts
import { SignJWT, jwtVerify } from "jose";
import { randomUUID, createHash } from "node:crypto";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { db } from "../db.js";

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function signAccessToken(userId: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + env.JWT_ACCESS_TTL_SECONDS;

  return new SignJWT({
    type: "access",
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(getJwtSecret());
}

/**
 * Подписывает refresh-токен.
 *
 * Если `existingJti` передан (ротация на /refresh) — запись в БД
 * уже создана внутри `rotateRefreshToken`, дублировать не нужно.
 * Иначе (первичный логин /vk) — сохраняем хеш jti в RefreshToken.
 */
export async function signRefreshToken(
  userId: string,
  existingJti?: string
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + env.JWT_REFRESH_TTL_SECONDS;
  const jti = existingJti ?? randomUUID();

  const token = await new SignJWT({ type: "refresh", jti })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(getJwtSecret());

  if (!existingJti) {
    await db.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(jti),
        expiresAt: new Date(exp * 1000),
      },
    });
  }

  return token;
}

export interface AccessTokenClaims {
  userId: string;
  expiresAt: number | undefined;
}

export async function verifyAccessTokenClaims(token: string): Promise<AccessTokenClaims> {
  // Support mock access tokens in test/development if ALLOW_DEV_AUTH is true
  if (env.ALLOW_DEV_AUTH && token.startsWith("mock-access-token-")) {
    logger.warn(
      { env: env.NODE_ENV },
      "[Auth] DEV mock access token accepted"
    );
    return { userId: token.replace("mock-access-token-", ""), expiresAt: undefined };
  }

  const { payload } = await jwtVerify(token, getJwtSecret());

  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }

  if (typeof payload.sub !== "string") {
    throw new Error("Invalid token subject");
  }

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("Invalid token expiration");
  }

  return { userId: payload.sub, expiresAt: payload.exp * 1000 };
}

export async function verifyAccessToken(token: string): Promise<string> {
  const claims = await verifyAccessTokenClaims(token);
  return claims.userId;
}

// ─── Admin JWT ───────────────────────────────────────────────────────────────
// Отдельный тип токена для админ-панели: sub="admin", type="admin-access".
// В БД не хранится (нет refresh-семьи): доступ равен знанию ADMIN_TOKEN,
// отзыв через ротацию JWT_SECRET / истечение TTL.

export interface AdminTokenClaims {
  expiresAt: number;
}

/**
 * Подписывает JWT админ-панели. Возвращает токен и момент истечения (epoch ms).
 */
export async function signAdminAccessToken(): Promise<{
  token: string;
  expiresAt: number;
}> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + env.ADMIN_JWT_TTL_SECONDS;

  const token = await new SignJWT({ type: "admin-access", jti: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(getJwtSecret());

  return { token, expiresAt: exp * 1000 };
}

/**
 * Проверяет JWT админ-панели: подпись, тип, subject, exp.
 * Бросает ошибку при любой невалидности — вызывающий код трактует как 401.
 */
export async function verifyAdminAccessToken(token: string): Promise<AdminTokenClaims> {
  const { payload } = await jwtVerify(token, getJwtSecret());

  if (payload.type !== "admin-access") {
    throw new Error("Invalid token type");
  }

  if (payload.sub !== "admin") {
    throw new Error("Invalid token subject");
  }

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("Invalid token expiration");
  }

  return { expiresAt: payload.exp * 1000 };
}

/**
 * Ошибка: refresh-токен уже отозван (ротирован или logout).
 *
 * Обработчик сам решает реакцию: /refresh трактует как reuse и отзывает
 * всю семью токенов, /logout — игнорирует (повторный логаут безопасен).
 */
export class RefreshTokenRevokedError extends Error {
  constructor(public readonly userId: string) {
    super("Refresh token revoked");
    this.name = "RefreshTokenRevokedError";
  }
}

/**
 * Отзыв всех активных refresh-токенов пользователя (token family revocation).
 *
 * Вызывается при обнаружении повторного использования уже отозванного токена —
 * это признак кражи: обнуляем всю цепочку, чтобы украденные токены не могли
 * быть использованы.
 */
export async function revokeAllActiveTokens(userId: string): Promise<number> {
  const result = await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * Проверяет refresh-токен: подпись, наличие записи в БД,
 * отсутствие отзыва и срок действия. Возвращает userId и jti.
 *
 * Если токен уже отозван — бросает RefreshTokenRevokedError (с userId),
 * чтобы вызывающий код мог применить политику reuse-детекции.
 */
export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string; jti: string }> {
  if (env.ALLOW_DEV_AUTH && token.startsWith("mock-refresh-token-")) {
    logger.warn(
      { env: env.NODE_ENV },
      "[Auth] DEV mock refresh token accepted"
    );
    return { userId: token.replace("mock-refresh-token-", ""), jti: "dev-jti" };
  }

  const { payload } = await jwtVerify(token, getJwtSecret());

  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  if (typeof payload.sub !== "string") {
    throw new Error("Invalid token subject");
  }

  if (typeof payload.jti !== "string") {
    throw new Error("Invalid token jti");
  }

  const tokenHash = hashToken(payload.jti);
  const dbToken = await db.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!dbToken || dbToken.expiresAt < new Date()) {
    throw new Error("Token revoked or expired");
  }

  if (dbToken.revokedAt) {
    throw new RefreshTokenRevokedError(dbToken.userId);
  }

  return { userId: payload.sub, jti: payload.jti };
}

/**
 * Атомарная ротация refresh-токена:
 * отзывает старый и создаёт новую запись в БД в одной транзакции.
 *
 * Отзыв выполняется одним UPDATE c предикатом `revokedAt IS NULL`. Под Read
 * Committed конкурирующий UPDATE после ожидания блокировки строки перечитывает
 * её свежую версию (EvalPlanQual) и видит `revokedAt` — поэтому из двух
 * параллельных ротаций одного токена ровно одна получит count === 1, а вторая
 * count === 0 и упадёт с "Token already used". Двойная выдача невозможна.
 */
export async function rotateRefreshToken(
  oldJti: string,
  userId: string
): Promise<string> {
  const oldHash = hashToken(oldJti);

  return db.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { tokenHash: oldHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) {
      throw new Error("Token already used");
    }

    const newJti = randomUUID();
    const exp = Math.floor(Date.now() / 1000) + env.JWT_REFRESH_TTL_SECONDS;

    await tx.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(newJti),
        expiresAt: new Date(exp * 1000),
      },
    });

    return newJti;
  });
}
