// backend/tests/unit/vkSign.test.ts
// Юнит-тесты VK launch signature verification (subtask 08, phase-4-observability).
// Покрытие: HMAC happy path, drift warn (1..5 мин), silent reject (>5 мин),
// неверная подпись, отсутствующие параметры, невалидный vk_user_id,
// dev-bypass (ALLOW_DEV_AUTH + sign=dev-sign).
//
// env/logger/sentry замоканы — никаких сетевых вызовов и Sentry-инициализаций.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifyVkLaunchSignature } from "../../src/auth/vkSign.js";
import { logger } from "../../src/logger.js";

const envMocks = vi.hoisted(() => ({
  SENTRY_DSN: "",
  NODE_ENV: "test",
  isProduction: false,
  ALLOW_DEV_AUTH: false,
  VK_APP_SECRET: "test-secret-key",
  PORT: 3000,
  DATABASE_URL: "",
  JWT_SECRET: "",
  CORS_ORIGINS: "",
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2592000,
  VK_AUTH_RATE_WINDOW_MS: 300000,
  VK_AUTH_RATE_MAX: 5,
  REFRESH_RATE_WINDOW_MS: 600000,
  REFRESH_RATE_MAX: 10,
}));

const { captureWarningMock, captureExceptionMock, initSentryMock } = vi.hoisted(() => ({
  captureWarningMock: vi.fn(),
  captureExceptionMock: vi.fn(),
  initSentryMock: vi.fn(),
}));

vi.mock("../../src/env.js", () => ({ env: envMocks }));
vi.mock("../../src/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../src/utils/sentry.js", () => ({
  captureWarning: captureWarningMock,
  captureException: captureExceptionMock,
  initSentry: initSentryMock,
}));

const warnMock = vi.mocked(logger.warn);

const VK_APP_ID = "100";
const VK_PLATFORM = "web";
const VK_USER_ID = "12345";

/** vk_ts (секунды), отстающий от текущего времени на driftMs. */
function staleTs(driftMs: number): number {
  return Math.floor((Date.now() - driftMs) / 1000);
}

/** Канонический набор vk_* параметров launch params (только vk_*, без sign). */
function vkEntries(vkTsSec: number): [string, string][] {
  return [
    ["vk_app_id", VK_APP_ID],
    ["vk_platform", VK_PLATFORM],
    ["vk_ts", String(vkTsSec)],
    ["vk_user_id", VK_USER_ID],
  ];
}

/** Реальная VK-подпись: HMAC-SHA256(секрет, canonical) -> base64url. */
function signWith(secret: string, vkTsSec: number): string {
  const canonical = vkEntries(vkTsSec)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return createHmac("sha256", secret).update(canonical).digest("base64url");
}

interface BuildLaunchParamsOptions {
  vkTsSec?: number;
  /** "auto" (по умолчанию) — настоящая подпись секретом envMocks.VK_APP_SECRET. */
  sign?: string | "auto";
  /** Дополнительные (не vk_*) параметры — не входят в canonical. */
  extra?: Record<string, string>;
}

/** Собирает rawSearchParams вида vk_app_id=100&...&sign=<sign>. */
function buildLaunchParams(opts: BuildLaunchParamsOptions = {}): string {
  const vkTsSec = opts.vkTsSec ?? Math.floor(Date.now() / 1000);
  const signValue =
    opts.sign === "auto" || opts.sign === undefined
      ? signWith(envMocks.VK_APP_SECRET, vkTsSec)
      : opts.sign;

  const base = vkEntries(vkTsSec).map(([k, v]) => `${k}=${v}`).join("&");
  const extraPart = opts.extra
    ? Object.entries(opts.extra)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("&")
    : "";

  return extraPart ? `${base}&${extraPart}&sign=${signValue}` : `${base}&sign=${signValue}`;
}

describe("verifyVkLaunchSignature", () => {
  afterEach(() => {
    vi.clearAllMocks();
    envMocks.ALLOW_DEV_AUTH = false;
  });

  it("accepts a fresh valid signature and returns the vkUserId", () => {
    // Arrange — свежая подпись (дрейф ~10с), плюс посторонний не-vk параметр,
    // который не должен влиять на canonical-строку.
    const raw = buildLaunchParams({
      vkTsSec: staleTs(10_000),
      extra: { driverId: "trip-42" },
    });

    // Act
    const result = verifyVkLaunchSignature(raw);

    // Assert
    expect(result).toEqual({ isValid: true, vkUserId: 12345 });
    expect(warnMock).not.toHaveBeenCalledWith(expect.anything(), "vk_sign_clock_drift");
    expect(captureWarningMock).not.toHaveBeenCalled();
  });

  it("accepts a 2-minute-old signature but warns about clock drift (1..5 min window)", () => {
    // Arrange — дрейф 120s: > DRIFT_WARN_THRESHOLD_MS (60s), но <= MAX_SIGN_AGE_MS (300s).
    const driftMs = 120_000;
    const raw = buildLaunchParams({ vkTsSec: staleTs(driftMs) });

    // Act
    const result = verifyVkLaunchSignature(raw);

    // Assert — подпись всё ещё валидна.
    expect(result).toEqual({ isValid: true, vkUserId: 12345 });
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vkUserId: 12345,
        driftMs: expect.any(Number),
        maxAgeMs: 300_000,
      }),
      "vk_sign_clock_drift"
    );
    // Дрейф считается от vk_ts, округлённого вниз до секунды: [120s, 121s).
    const driftCtx = warnMock.mock.calls.find(
      ([, msg]) => msg === "vk_sign_clock_drift"
    )?.[0] as { driftMs: number };
    expect(driftCtx.driftMs).toBeGreaterThanOrEqual(120_000);
    expect(driftCtx.driftMs).toBeLessThan(121_000);
    expect(captureWarningMock).toHaveBeenCalledWith("vk_sign_clock_drift", {
      extra: expect.objectContaining({
        vkUserId: 12345,
        driftMs: expect.any(Number),
        maxAgeMs: 300_000,
      }),
      tags: { auth: "vk_sign" },
    });
  });

  it("silently rejects a signature older than 5 minutes (no captureWarning)", () => {
    // Arrange — дрейф 10 мин > MAX_SIGN_AGE_MS: молчаливый отказ без диагностики.
    const raw = buildLaunchParams({ vkTsSec: staleTs(10 * 60_000) });

    // Act
    const result = verifyVkLaunchSignature(raw);

    // Assert
    expect(result).toEqual({ isValid: false });
    expect(captureWarningMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalledWith(expect.anything(), "vk_sign_clock_drift");
  });

  it("rejects a signature with a wrong sign value", () => {
    // Arrange — (a) подпись от «чужого» секрета: та же длина, другое содержимое
    // → ветка timingSafeEqual=false; (b) короткая подпись → ветка byteLength-гарда.
    const vkTsSec = staleTs(10_000);
    const sameLengthRaw = buildLaunchParams({
      vkTsSec,
      sign: signWith("wrong-secret", vkTsSec),
    });
    const shortRaw = buildLaunchParams({ vkTsSec, sign: "deadbeef" });

    // Act
    const sameLengthResult = verifyVkLaunchSignature(sameLengthRaw);
    const shortResult = verifyVkLaunchSignature(shortRaw);

    // Assert — обе ветки дают isValid: false (в ветке timingSafeEqual
    // источник возвращает и vkUserId, поэтому проверяем только isValid).
    expect(sameLengthResult).toMatchObject({ isValid: false });
    expect(shortResult).toEqual({ isValid: false });
  });

  it("rejects launch params with missing sign or missing vk_ts", () => {
    // Arrange — оба варианта: нет sign и нет vk_ts.
    const rawNoSign = "vk_app_id=100&vk_platform=web&vk_ts=1234567890&vk_user_id=12345";
    const rawNoTs = "vk_app_id=100&vk_platform=web&vk_user_id=12345&sign=whatever";

    // Act
    const noSignResult = verifyVkLaunchSignature(rawNoSign);
    const noTsResult = verifyVkLaunchSignature(rawNoTs);

    // Assert
    expect(noSignResult).toEqual({ isValid: false });
    expect(noTsResult).toEqual({ isValid: false });
  });

  it("rejects non-numeric or non-positive vk_user_id", () => {
    // Arrange — проверка vk_user_id происходит до проверки подписи,
    // поэтому sign может быть любым.
    const rawNonNumeric = `vk_app_id=100&vk_platform=web&vk_ts=${staleTs(10_000)}&vk_user_id=abc&sign=whatever`;
    const rawZero = `vk_app_id=100&vk_platform=web&vk_ts=${staleTs(10_000)}&vk_user_id=0&sign=whatever`;

    // Act
    const nonNumericResult = verifyVkLaunchSignature(rawNonNumeric);
    const zeroResult = verifyVkLaunchSignature(rawZero);

    // Assert
    expect(nonNumericResult).toEqual({ isValid: false });
    expect(zeroResult).toEqual({ isValid: false });
  });

  it("dev-bypass: ALLOW_DEV_AUTH=true with sign=dev-sign is accepted without captureWarning", () => {
    // Arrange
    envMocks.ALLOW_DEV_AUTH = true;
    const raw = buildLaunchParams({ vkTsSec: staleTs(10_000), sign: "dev-sign" });

    // Act
    const result = verifyVkLaunchSignature(raw);

    // Assert — bypass пропускает с vkUserId из параметров, диагностика не нужна.
    expect(result).toEqual({ isValid: true, vkUserId: 12345 });
    expect(captureWarningMock).not.toHaveBeenCalled();
  });

  it("dev-bypass is NOT applied when ALLOW_DEV_AUTH=false", () => {
    // Arrange — dev-sign без разрешения: идём по обычному пути HMAC-проверки.
    envMocks.ALLOW_DEV_AUTH = false;
    const raw = buildLaunchParams({ vkTsSec: staleTs(10_000), sign: "dev-sign" });

    // Act
    const result = verifyVkLaunchSignature(raw);

    // Assert — "dev-sign" не является валидной HMAC-подписью.
    expect(result).toEqual({ isValid: false });
  });
});
