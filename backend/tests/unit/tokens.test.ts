// backend/tests/unit/tokens.test.ts
// Юнит-тесты dev mock-токенов (high-fixes-01): явный allowlist, TTL,
// expiresAt. Покрытие: allowlist-miss, expired TTL, TTL-exceeded,
// невалидный формат, валидные access/refresh пути, регрессия реального JWT.
//
// Logger замокан (репо-паттерн из tests/unit/wsManager.test.ts): ни один
// тест не пишет в stdout. БД не используется: mock-ветка stateless,
// реальный JWT проверяется локально (jose).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

vi.mock("../../src/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { env } = await import("../../src/env.js");
const {
  parseDevMockToken,
  assertDevMockTokenFresh,
  verifyAccessTokenClaims,
  verifyRefreshToken,
  signAccessToken,
  MOCK_ACCESS_TOKEN_PREFIX,
  MOCK_REFRESH_TOKEN_PREFIX,
} = await import("../../src/auth/tokens.js");

// Фиксированное «сейчас»: 2026-09-04T12:00:00Z.
const BASE = new Date("2026-09-04T12:00:00Z");
const BASE_SEC = Math.floor(BASE.getTime() / 1000);

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const TTL_MS = env.DEV_MOCK_TOKEN_TTL_SECONDS * 1000;

describe("parseDevMockToken", () => {
  it("parses a valid access token (uuid userId, numeric exp)", () => {
    const token = `mock-access-token-${USER_A}-${BASE_SEC + 60}`;
    expect(parseDevMockToken(token, MOCK_ACCESS_TOKEN_PREFIX)).toEqual({
      userId: USER_A,
      exp: BASE_SEC + 60,
    });
  });

  it("parses a valid refresh token", () => {
    const token = `mock-refresh-token-${USER_B}-${BASE_SEC + 120}`;
    expect(parseDevMockToken(token, MOCK_REFRESH_TOKEN_PREFIX)).toEqual({
      userId: USER_B,
      exp: BASE_SEC + 120,
    });
  });

  it.each([
    // legacy-формат без exp (старые тестовые токены) — невалиден
    `mock-access-token-${USER_A}`,
    // exp не число
    "mock-access-token-user-a-xyz",
    // exp пустой / дефис в конце
    "mock-access-token-user-a-",
    // userId пустой
    "mock-access-token--1234567890",
    // только префикс
    "mock-access-token-",
    // exp = 0
    "mock-access-token-user-a-0",
  ])("returns null for malformed token %s", (token) => {
    expect(parseDevMockToken(token, MOCK_ACCESS_TOKEN_PREFIX)).toBeNull();
  });

  it("returns null for a refresh token parsed with the access prefix", () => {
    const token = `mock-refresh-token-${USER_A}-${BASE_SEC + 60}`;
    expect(parseDevMockToken(token, MOCK_ACCESS_TOKEN_PREFIX)).toBeNull();
  });

  it("returns null for a non-mock token", () => {
    expect(parseDevMockToken("eyJhbGciOiJIUzI1NiJ9.x.y", MOCK_ACCESS_TOKEN_PREFIX)).toBeNull();
  });
});

describe("assertDevMockTokenFresh", () => {
  it("accepts a fresh token within the TTL", () => {
    expect(() =>
      assertDevMockTokenFresh({ userId: USER_A, exp: BASE_SEC + 60 }, BASE.getTime(), TTL_MS)
    ).not.toThrow();
  });

  it("accepts a token at the TTL boundary (skew allowed)", () => {
    const exp = BASE_SEC + Math.floor(TTL_MS / 1000);
    expect(() =>
      assertDevMockTokenFresh({ userId: USER_A, exp }, BASE.getTime(), TTL_MS)
    ).not.toThrow();
  });

  it("rejects an expired token", () => {
    expect(() =>
      assertDevMockTokenFresh({ userId: USER_A, exp: BASE_SEC - 1 }, BASE.getTime(), TTL_MS)
    ).toThrow("Mock token expired");
    // Граница: exp == now — уже истёк.
    expect(() =>
      assertDevMockTokenFresh({ userId: USER_A, exp: BASE_SEC }, BASE.getTime(), TTL_MS)
    ).toThrow("Mock token expired");
  });

  it("rejects a forged token with exp far beyond the TTL", () => {
    const exp = BASE_SEC + Math.floor(TTL_MS / 1000) + 3600;
    expect(() =>
      assertDevMockTokenFresh({ userId: USER_A, exp }, BASE.getTime(), TTL_MS)
    ).toThrow("Mock token TTL exceeded");
  });
});

describe("verifyAccessTokenClaims — dev mock access token", () => {
  let originalAllowlist: string | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    originalAllowlist = process.env.DEV_AUTH_USER_ALLOWLIST;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalAllowlist === undefined) {
      delete process.env.DEV_AUTH_USER_ALLOWLIST;
    } else {
      process.env.DEV_AUTH_USER_ALLOWLIST = originalAllowlist;
    }
  });

  it("accepts an allowlisted user with a fresh token and returns expiresAt", async () => {
    // Arrange
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-access-token-${USER_A}-${BASE_SEC + 600}`;

    // Act
    const claims = await verifyAccessTokenClaims(token);

    // Assert — expiresAt обязателен (WS-сессия знает, когда закрываться)
    expect(claims.userId).toBe(USER_A);
    expect(claims.expiresAt).toBe((BASE_SEC + 600) * 1000);
  });

  it("rejects a token for a user NOT in the allowlist", async () => {
    // Arrange — allowlist содержит только USER_A
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-access-token-${USER_B}-${BASE_SEC + 600}`;

    // Act / Assert
    await expect(verifyAccessTokenClaims(token)).rejects.toThrow(
      "Mock token user not in allowlist"
    );
  });

  it("rejects when the allowlist is empty (no users configured)", async () => {
    // Arrange
    delete process.env.DEV_AUTH_USER_ALLOWLIST;
    const token = `mock-access-token-${USER_A}-${BASE_SEC + 600}`;

    await expect(verifyAccessTokenClaims(token)).rejects.toThrow(
      "Mock token user not in allowlist"
    );
  });

  it("trims and honors multiple comma-separated allowlist entries", async () => {
    // Arrange
    process.env.DEV_AUTH_USER_ALLOWLIST = ` ${USER_B} , ${USER_A} `;
    const token = `mock-access-token-${USER_B}-${BASE_SEC + 600}`;

    // Act
    const claims = await verifyAccessTokenClaims(token);

    // Assert
    expect(claims.userId).toBe(USER_B);
  });

  it("rejects an expired mock token", async () => {
    // Arrange
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-access-token-${USER_A}-${BASE_SEC - 10}`;

    // Act / Assert
    await expect(verifyAccessTokenClaims(token)).rejects.toThrow("Mock token expired");
  });

  it("rejects a forged mock token with exp far beyond the TTL", async () => {
    // Arrange — exp через 24ч при TTL 15мин
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-access-token-${USER_A}-${BASE_SEC + 24 * 3600}`;

    // Act / Assert
    await expect(verifyAccessTokenClaims(token)).rejects.toThrow("Mock token TTL exceeded");
  });

  it("rejects a legacy-format mock token (no exp segment)", async () => {
    // Arrange — старый формат `mock-access-token-<userId>` больше невалиден.
    // userId НЕ в allowlist: доказывает, что сработала именно ФОРМАТ-проверка
    // (она идёт первой — до allowlist), а не совпадение по allowlist.
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-access-token-${USER_B}`;

    // Act / Assert
    await expect(verifyAccessTokenClaims(token)).rejects.toThrow(
      "Invalid mock token format"
    );
  });

  it("TTL is driven by DEV_MOCK_TOKEN_TTL_SECONDS (env), not hardcoded", async () => {
    // Arrange — TTL = 60s: токен на 120s теперь должен отклоняться
    const originalTtl = env.DEV_MOCK_TOKEN_TTL_SECONDS;
    env.DEV_MOCK_TOKEN_TTL_SECONDS = 60;
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-access-token-${USER_A}-${BASE_SEC + 120}`;

    // Act / Assert
    await expect(verifyAccessTokenClaims(token)).rejects.toThrow("Mock token TTL exceeded");

    // Control: при штатном TTL (900s) тот же токен проходит
    env.DEV_MOCK_TOKEN_TTL_SECONDS = originalTtl;
    const claims = await verifyAccessTokenClaims(token);
    expect(claims.userId).toBe(USER_A);
  });
});

describe("verifyRefreshToken — dev mock refresh token", () => {
  let originalAllowlist: string | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    originalAllowlist = process.env.DEV_AUTH_USER_ALLOWLIST;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalAllowlist === undefined) {
      delete process.env.DEV_AUTH_USER_ALLOWLIST;
    } else {
      process.env.DEV_AUTH_USER_ALLOWLIST = originalAllowlist;
    }
  });

  it("accepts an allowlisted fresh mock refresh token (jti dev-jti)", async () => {
    // Arrange
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-refresh-token-${USER_A}-${BASE_SEC + 600}`;

    // Act
    const result = await verifyRefreshToken(token);

    // Assert
    expect(result).toEqual({ userId: USER_A, jti: "dev-jti" });
  });

  it("rejects an expired mock refresh token", async () => {
    // Arrange
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-refresh-token-${USER_A}-${BASE_SEC - 1}`;

    // Act / Assert
    await expect(verifyRefreshToken(token)).rejects.toThrow("Mock token expired");
  });

  it("rejects a mock refresh token for a user not in the allowlist", async () => {
    // Arrange
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-refresh-token-${USER_B}-${BASE_SEC + 600}`;

    // Act / Assert
    await expect(verifyRefreshToken(token)).rejects.toThrow(
      "Mock token user not in allowlist"
    );
  });

  it("rejects a legacy-format mock refresh token (no exp segment)", async () => {
    // Arrange — userId НЕ в allowlist: срабатывает формат-проверка первой
    process.env.DEV_AUTH_USER_ALLOWLIST = USER_A;
    const token = `mock-refresh-token-${USER_B}`;

    // Act / Assert
    await expect(verifyRefreshToken(token)).rejects.toThrow(
      "Invalid mock token format"
    );
  });
});

describe("real JWT path is unaffected (regression)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("signs and verifies an access token with correct userId and exp", async () => {
    // Act
    const token = await signAccessToken(USER_A);
    const claims = await verifyAccessTokenClaims(token);

    // Assert
    expect(claims.userId).toBe(USER_A);
    expect(claims.expiresAt).toBe((BASE_SEC + env.JWT_ACCESS_TTL_SECONDS) * 1000);
  });

  it("rejects a JWT of the wrong type (admin-access as access)", async () => {
    // Arrange — честно подписанный JWT, но type=admin-access
    const token = await new SignJWT({ type: "admin-access" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_A)
      .setIssuedAt(BASE_SEC)
      .setExpirationTime(BASE_SEC + 900)
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    // Act / Assert
    await expect(verifyAccessTokenClaims(token)).rejects.toThrow("Invalid token type");
  });
});
