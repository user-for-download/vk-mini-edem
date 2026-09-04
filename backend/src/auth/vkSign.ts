import { createHash, createHmac } from "node:crypto";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { captureWarning } from "../utils/sentry.js";
import { tokensEqual } from "../utils/timingSafeEqual.js";

const MAX_SIGN_AGE_MS = 5 * 60 * 1000;
// Будущие vk_ts отклоняются: допускается только небольшое расхождение часов
// (OWASP/skill: ≤30с skew, не Math.abs-окно — оно принимало timestamps из будущего).
const FUTURE_SKEW_MS = 30 * 1000;
// Порог, после которого расхождение часов клиента/сервера логируется
// (до молчаливого отклонения по MAX_SIGN_AGE_MS).
const DRIFT_WARN_THRESHOLD_MS = 60 * 1000;

export interface VkAuthResult {
  isValid: boolean;
  vkUserId?: number;
}

// Точное значение dev-подписи. Сравнение — строгое (===) по распарсенному
// параметру sign: includes() по сырой строке позволял обход через подстроку
// в значении другого параметра ("sign=dev-sign-evil", "note=..sign=dev-sign..").
const DEV_SIGN = "dev-sign";

// Replay-кэш: пара (vk_ts, vk_sign) одноразовая. Ключ — vk_ts + sha256(sign),
// сырые подписи в памяти не хранятся. Запись живёт, пока подпись может быть
// валидной (vk_ts + MAX_SIGN_AGE_MS); просрочка чистится лениво при каждом вызове.
// Кэш только для пути реальной подписи: dev-bypass (без vk_ts/проверки свежести)
// сюда не попадает. Функция синхронна (await нет) — check-and-set атомарен.
const REPLAY_TTL_MS = MAX_SIGN_AGE_MS;
const MAX_REPLAY_ENTRIES = 5000;
const seenSignatures = new Map<string, number>();

function replayKey(vkTs: string, sign: string): string {
  const signHash = createHash("sha256").update(sign, "utf8").digest("hex");
  return `${vkTs}:${signHash}`;
}

function pruneReplayCache(nowMs: number): void {
  for (const [key, expiresAt] of seenSignatures) {
    if (expiresAt <= nowMs) {
      seenSignatures.delete(key);
    }
  }
  while (seenSignatures.size > MAX_REPLAY_ENTRIES) {
    const oldest = seenSignatures.keys().next();
    if (oldest.done) {
      break;
    }
    seenSignatures.delete(oldest.value);
  }
}

/**
 * Test-only: очищает replay-кэш (изоляция юнит-тестов друг от друга).
 */
export function clearVkSignReplayCache(): void {
  seenSignatures.clear();
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

  // Dev-bypass для локальной разработки: только точное совпадение sign
  // и только вне production (ALLOW_DEV_AUTH в проде всегда false — пояс,
  // !isProduction — подтяжки). Отсутствующий/невалидный vk_user_id
  // отклоняется, а не подменяется дефолтом: иначе любой мог бы занять
  // фиксированный dev-аккаунт (спуфинг user-id).
  const signParam = params.get("sign");
  if (env.ALLOW_DEV_AUTH && !env.isProduction && signParam === DEV_SIGN) {
    logger.warn({ env: env.NODE_ENV }, "[Auth] DEV launch params bypass accepted");
    const rawId = params.get("vk_user_id");
    const vkUserId = rawId === null ? Number.NaN : Number(rawId);
    if (!Number.isFinite(vkUserId) || vkUserId <= 0) {
      return { isValid: false };
    }
    return { isValid: true, vkUserId };
  }

  const sign = signParam;
  const vkTsStr = params.get("vk_ts");
  const vkUserIdStr = params.get("vk_user_id");

  if (!sign || !vkTsStr || !vkUserIdStr) {
    return { isValid: false };
  }

  const vkUserId = Number(vkUserIdStr);
  if (!Number.isFinite(vkUserId) || vkUserId <= 0) {
    return { isValid: false };
  }

  // Проверка свежести vk_ts (в секундах): прошлое — не старше MAX_SIGN_AGE_MS,
  // будущее — не дальше FUTURE_SKEW_MS (допуск на расхождение часов).
  const nowMs = Date.now();
  const vkTsMs = Number(vkTsStr) * 1000;
  if (!Number.isFinite(vkTsMs)) {
    return { isValid: false };
  }
  const ageMs = nowMs - vkTsMs;
  if (ageMs > MAX_SIGN_AGE_MS || ageMs < -FUTURE_SKEW_MS) {
    return { isValid: false };
  }
  const driftMs = Math.abs(ageMs);
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

  // Replay-защита: успешно проверенная пара (vk_ts, sign) принимается один раз.
  // Проверка до HMAC: в кэше лежат только валидные пары, невалидные сюда
  // не попадают — оракула валидности нет, заодно экономим HMAC на реплеях.
  pruneReplayCache(nowMs);
  const seenKey = replayKey(vkTsStr, sign);
  if (seenSignatures.has(seenKey)) {
    return { isValid: false };
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

  // Constant-time сравнение без length-oracle: обе стороны хешируются
  // (tokensEqual), длина ожидаемой подписи по времени не утечёт.
  if (!tokensEqual(sign, expected)) {
    return { isValid: false };
  }

  seenSignatures.set(seenKey, vkTsMs + REPLAY_TTL_MS);
  return { isValid: true, vkUserId };
}

