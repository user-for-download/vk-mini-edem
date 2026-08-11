import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { captureWarning } from "../utils/sentry.js";

const MAX_SIGN_AGE_MS = 5 * 60 * 1000;
// Порог, после которого расхождение часов клиента/сервера логируется
// (до молчаливого отклонения по MAX_SIGN_AGE_MS).
const DRIFT_WARN_THRESHOLD_MS = 60 * 1000;

export interface VkAuthResult {
  isValid: boolean;
  vkUserId?: number;
}

/**
 * Проверка подписи VK Mini Apps launch params.
 *
 * Алгоритм VK:
 * 1. Из URLSearchParams берутся только параметры с префиксом vk_* (кроме sign и vk_sign).
 * 2. Параметры сортируются по алфавиту по ключу.
 * 3. Формируется каноническая строка k1=v1&k2=v2...
 * 4. Считается HMAC-SHA256(canonical, VK_APP_SECRET) -> base64url.
 * 5. Сравнивается с переданным параметром sign.
 */
export function verifyVkLaunchSignature(rawSearchParams: string): VkAuthResult {
  const params = new URLSearchParams(rawSearchParams);

  // Dev-bypass для локальной разработки
  if (env.ALLOW_DEV_AUTH && rawSearchParams.includes("sign=dev-sign")) {
    logger.warn({ env: env.NODE_ENV }, "[Auth] DEV launch params bypass accepted");
    const rawId = params.get("vk_user_id");
    const vkUserId = rawId ? Number(rawId) : 100001;
    return { isValid: true, vkUserId: Number.isFinite(vkUserId) && vkUserId > 0 ? vkUserId : 100001 };
  }

  const sign = params.get("sign");
  const vkTsStr = params.get("vk_ts");
  const vkUserIdStr = params.get("vk_user_id");

  if (!sign || !vkTsStr || !vkUserIdStr) {
    return { isValid: false };
  }

  const vkUserId = Number(vkUserIdStr);
  if (!Number.isFinite(vkUserId) || vkUserId <= 0) {
    return { isValid: false };
  }

  // Проверка свежести vk_ts (в секундах)
  const vkTsMs = Number(vkTsStr) * 1000;
  const driftMs = Number.isNaN(vkTsMs) ? Number.NaN : Math.abs(Date.now() - vkTsMs);
  if (Number.isNaN(driftMs) || driftMs > MAX_SIGN_AGE_MS) {
    return { isValid: false };
  }
  // Расхождение часов больше 1 минуты — сигнал для диагностики
  // (подпись ещё валидна, но у клиента, вероятно, сбиты часы).
  if (driftMs > DRIFT_WARN_THRESHOLD_MS) {
    logger.warn(
      { vkUserId, driftMs, maxAgeMs: MAX_SIGN_AGE_MS },
      "vk_sign_clock_drift"
    );
    captureWarning("vk_sign_clock_drift", {
      extra: { vkUserId, driftMs, maxAgeMs: MAX_SIGN_AGE_MS },
      tags: { auth: "vk_sign" },
    });
  }

  // Сбор только vk_* параметров (исключая подпись и любые сторонние параметры вроде driverId/tripId)
  const entries: [string, string][] = [];
  params.forEach((value, key) => {
    if (key.startsWith("vk_") && key !== "vk_sign" && key !== "sign") {
      entries.push([key, value]);
    }
  });

  // Строгое посимвольное сравнение.
  // ВАЖНО: по документации VK значения должны быть URL-кодированы
  // (запятые → %2C, пробелы → %20 и т.д.), иначе подпись не совпадёт.
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonical = entries
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const expected = createHmac("sha256", env.VK_APP_SECRET)
    .update(canonical)
    .digest("base64url");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(sign);

  if (expectedBuffer.byteLength !== receivedBuffer.byteLength) {
    return { isValid: false };
  }

  try {
    const isValid = timingSafeEqual(expectedBuffer, receivedBuffer);
    return { isValid, vkUserId };
  } catch {
    return { isValid: false };
  }
}

