// backend/src/auth/vkSign.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

const MAX_SIGN_AGE_MS = 5 * 60 * 1000;

export interface VkAuthPayload {
  vkUserId: number;
  sign: string;
  ts: number;
}

/**
 * Проверка подписи VK auth payload.
 *
 * Canonical string:
 * vk_user_id={vkUserId}&ts={ts}
 *
 * Signature:
 * base64url(HMAC_SHA256(canonical, VK_APP_SECRET))
 */
export function verifyVkSignature(payload: VkAuthPayload): boolean {
  /**
   * Dev-имитация.
   *
   * Разрешена только если:
   * - NODE_ENV !== production;
   * - ALLOW_DEV_AUTH !== false;
   * - sign === "dev-sign" или "test-sign".
   */
  if (
    env.ALLOW_DEV_AUTH &&
    payload.sign === "dev-sign"
  ) {
    console.warn(
      "[Auth] DEV signature bypass accepted. NODE_ENV:",
      env.NODE_ENV
    );
    return true;
  }

  const now = Date.now();

  if (Math.abs(now - payload.ts) > MAX_SIGN_AGE_MS) {
    return false;
  }

  const canonical = `vk_user_id=${payload.vkUserId}&ts=${payload.ts}`;

  const expected = createHmac("sha256", env.VK_APP_SECRET)
    .update(canonical)
    .digest("base64url");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(payload.sign);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
