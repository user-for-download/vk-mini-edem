// backend/src/auth/tokens.ts
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { env } from "../env.js";
import { logger } from "../logger.js";

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
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

export async function signRefreshToken(userId: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + env.JWT_REFRESH_TTL_SECONDS;

  return new SignJWT({
    type: "refresh",
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(getJwtSecret());
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

export async function verifyRefreshToken(token: string): Promise<string> {
  if (env.ALLOW_DEV_AUTH && token.startsWith("mock-refresh-token-")) {
    logger.warn(
      "[Auth] DEV mock refresh token accepted. NODE_ENV:",
      env.NODE_ENV
    );
    return token.replace("mock-refresh-token-", "");
  }

  const { payload } = await jwtVerify(token, getJwtSecret());

  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  if (typeof payload.sub !== "string") {
    throw new Error("Invalid token subject");
  }

  return payload.sub;
}
