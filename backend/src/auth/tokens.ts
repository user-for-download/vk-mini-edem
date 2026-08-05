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

export async function verifyAccessToken(token: string): Promise<string> {
  // Support mock access tokens in test/development if ALLOW_DEV_AUTH is true
  if (env.ALLOW_DEV_AUTH && token.startsWith("mock-access-token-")) {
    logger.warn(
      { env: env.NODE_ENV },
      "[Auth] DEV mock access token accepted"
    );
    return token.replace("mock-access-token-", "");
  }

  const { payload } = await jwtVerify(token, getJwtSecret());

  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }

  if (typeof payload.sub !== "string") {
    throw new Error("Invalid token subject");
  }

  return payload.sub;
}

/**
 * Проверяет refresh-токен: подпись, наличие записи в БД,
 * отсутствие отзыва и срок действия. Возвращает userId и jti.
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

  if (!dbToken || dbToken.revokedAt || dbToken.expiresAt < new Date()) {
    throw new Error("Token revoked or expired");
  }

  return { userId: payload.sub, jti: payload.jti };
}

/**
 * Атомарная ротация refresh-токена:
 * отзывает старый и создаёт новую запись в БД в одной транзакции.
 */
export async function rotateRefreshToken(
  oldJti: string,
  userId: string
): Promise<string> {
  const oldHash = hashToken(oldJti);

  return db.$transaction(async (tx) => {
    const existing = await tx.refreshToken.findUnique({
      where: { tokenHash: oldHash },
    });
    if (!existing || existing.revokedAt) {
      throw new Error("Token already used");
    }

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

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
