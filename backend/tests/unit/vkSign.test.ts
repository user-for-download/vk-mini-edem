// backend/tests/unit/vkSign.test.ts
// Юнит-тесты VK launch signature verification (subtask 08, phase-4-observability;
// high-fixes-02: exact dev-sign, vk_user_id без дефолта, vk_ts future/stale, replay).
// Покрытие: HMAC happy path, drift warn (1..5 мин), silent reject (>5 мин),
// неверная подпись, отсутствующие параметры, невалидный vk_user_id,
// dev-bypass (ALLOW_DEV_AUTH + sign=dev-sign) + high-fixes-02:
// near-miss dev-sign отклоняется (точное совпадение, не подстрока),
// dev-bypass отклоняет отсутствующий/невалидный vk_user_id (без дефолта 100001),
// будущий vk_ts (>30с) и просроченный vk_ts (>5 мин) отклоняются,
// replay: пара (vk_ts, sign) принимается один раз.
//
// env/logger/sentry замоканы — никаких сетевых вызовов и Sentry-инициализаций.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyVkLaunchSignature,
  clearVkSignReplayCache,
} from "../../src/auth/vkSign.js";
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
    clearVkSignReplayCache();
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
    // Arrange — (a) подпись от «чужого» секрета: та же длина, другое содержимое;
    // (b) короткая подпись. Сравнение — tokensEqual (sha256 обеих сторон):
    // обе ветки дают isValid: false без length-oracle.
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

  it("dev-sign near-miss values are rejected even with ALLOW_DEV_AUTH=true (exact match, no substring)", () => {
    // Arrange — bypass только при params.get("sign") === "dev-sign".
    // Раньше includes() по сырой строке принимал подстроки.
    envMocks.ALLOW_DEV_AUTH = true;
    const vkTsSec = staleTs(10_000);
    const withSign = (signValue: string, extra = "") =>
      `vk_app_id=100&vk_platform=web&vk_ts=${vkTsSec}&vk_user_id=12345${extra}&sign=${signValue}`;

    // Act + Assert — near-miss уходят в HMAC-путь и отклоняются.
    for (const nearMiss of [
      "dev-sign-evil",
      "dev-signx",
      "xdev-sign",
      "DEV-SIGN",
      "dev-sign%20",
    ]) {
      expect(
        verifyVkLaunchSignature(withSign(nearMiss)),
        `sign=${nearMiss}`
      ).toEqual({ isValid: false });
    }

    // Подстрока "sign=dev-sign" внутри значения другого параметра —
    // тоже не bypass (регрессия includes(): раньше сырая строка содержала
    // подстроку и bypass срабатывал с произвольным vk_user_id).
    const rawTrap = withSign("invalid", "&note=prefix-sign=dev-sign");
    expect(rawTrap.includes("sign=dev-sign")).toBe(true);
    expect(verifyVkLaunchSignature(rawTrap)).toEqual({ isValid: false });
  });

  it("dev-bypass rejects missing or invalid vk_user_id instead of defaulting (no user-id spoofing)", () => {
    // Arrange — в dev-пути нет дефолта 100001: отсутствующий/невалидный
    // vk_user_id отклоняется, иначе любой занимал бы фиксированный аккаунт.
    envMocks.ALLOW_DEV_AUTH = true;
    const vkTsSec = staleTs(10_000);
    const noId = `vk_app_id=100&vk_platform=web&vk_ts=${vkTsSec}&sign=dev-sign`;
    const badId = `vk_app_id=100&vk_platform=web&vk_ts=${vkTsSec}&vk_user_id=abc&sign=dev-sign`;
    const zeroId = `vk_app_id=100&vk_platform=web&vk_ts=${vkTsSec}&vk_user_id=0&sign=dev-sign`;

    // Act + Assert
    expect(verifyVkLaunchSignature(noId)).toEqual({ isValid: false });
    expect(verifyVkLaunchSignature(badId)).toEqual({ isValid: false });
    expect(verifyVkLaunchSignature(zeroId)).toEqual({ isValid: false });
  });

  it("rejects future vk_ts beyond clock-skew allowance and stale vk_ts beyond the window", () => {
    // Arrange — валидные HMAC-подписи, но vk_ts в будущем (+120с > 30с skew)
    // и в прошлом (−360с > 5 мин окна).
    const futureTsSec = Math.floor((Date.now() + 120_000) / 1000);
    const staleTsSec = Math.floor((Date.now() - 360_000) / 1000);

    // Act
    const futureResult = verifyVkLaunchSignature(
      buildLaunchParams({ vkTsSec: futureTsSec })
    );
    const staleResult = verifyVkLaunchSignature(
      buildLaunchParams({ vkTsSec: staleTsSec })
    );

    // Assert — обе отклонены до проверки HMAC (replay-кэш не засоряется).
    expect(futureResult).toEqual({ isValid: false });
    expect(staleResult).toEqual({ isValid: false });
    expect(captureWarningMock).not.toHaveBeenCalled();
  });

  it("accepts slightly-future vk_ts within clock-skew allowance (10s)", () => {
    // Arrange — небольшое расхождение часов клиента (±30с) не должно
    // ломать вход; валидная HMAC-подпись, vk_ts на 10с в будущем.
    const raw = buildLaunchParams({
      vkTsSec: Math.floor((Date.now() + 10_000) / 1000),
    });

    // Act
    const result = verifyVkLaunchSignature(raw);

    // Assert
    expect(result).toEqual({ isValid: true, vkUserId: 12345 });
    expect(warnMock).not.toHaveBeenCalledWith(expect.anything(), "vk_sign_clock_drift");
  });

  it("replay: identical (vk_ts, sign) pair is accepted once, second use is rejected", () => {
    // Arrange — свежая валидная подпись.
    const raw = buildLaunchParams({ vkTsSec: staleTs(10_000) });

    // Act — первое предъявление валидно, повтор той же пары отклонён.
    const first = verifyVkLaunchSignature(raw);
    const second = verifyVkLaunchSignature(raw);

    // Assert
    expect(first).toEqual({ isValid: true, vkUserId: 12345 });
    expect(second).toEqual({ isValid: false });

    // Свежая подпись (другой vk_ts → другая пара) снова принимается.
    const fresh = buildLaunchParams({ vkTsSec: staleTs(5_000) });
    expect(fresh).not.toBe(raw);
    expect(verifyVkLaunchSignature(fresh)).toEqual({
      isValid: true,
      vkUserId: 12345,
    });
  });

  it("failed HMAC verification does not poison the replay cache", () => {
    // Arrange — один vk_ts: сначала невалидная подпись, затем валидная.
    const vkTsSec = staleTs(10_000);
    const bad = buildLaunchParams({ vkTsSec, sign: "deadbeef" });

    // Act — невалидные попытки отклоняются, но кэш не засоряют...
    expect(verifyVkLaunchSignature(bad)).toEqual({ isValid: false });
    expect(verifyVkLaunchSignature(bad)).toEqual({ isValid: false });

    // ...поэтому валидная подпись с тем же vk_ts (другой sign → другой ключ) принимается.
    const good = buildLaunchParams({ vkTsSec });
    expect(verifyVkLaunchSignature(good)).toEqual({
      isValid: true,
      vkUserId: 12345,
    });
  });
});
