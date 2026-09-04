import { afterEach, describe, expect, it, vi } from "vitest";

// ADMIN_TOKEN и лимиты (логин админки, мутации) читаются из env при импорте.
// Задаём до импорта app; лимиты завышаем, чтобы тест не упёрся в 429.
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-123";
  process.env.ADMIN_LOGIN_RATE_WINDOW_MS = "300000";
  process.env.ADMIN_LOGIN_RATE_MAX = "1000";
  process.env.MUTATION_RATE_WINDOW_MS = "60000";
  process.env.MUTATION_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { signAccessToken } = await import("../../src/auth/tokens.js");

/**
 * Онбординг-флаг: завершение онбординга пользователем и админ-сброс.
 *
 * 1) POST /users/me/onboarding — сохраняет версию показанных слайдов в
 *    User.onboardingVersion (requireUser + mutationLimiter, тело {version}:
 *    строка 1..50 символов после trim; иначе 400 "Invalid payload").
 *
 * 2) PATCH /admin/users/:id/onboarding-reset — обнуляет флаг (admin guard,
 *    404 для несуществующего пользователя, идемпотентно), чтобы пользователь
 *    снова увидел слайды при следующем запуске.
 *
 * Паттерны репо (см. ban-enforcement.test.ts, admin-moderation.test.ts):
 * app.request(), логин админки через POST /admin/auth/login с cookie
 * edem_admin_jwt, уникальные vkUserId (INT4-счётчик).
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
const ADMIN_TOKEN = "test-admin-token-123";

const createdUserIds: string[] = [];
// vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
// Диапазон не пересекается с другими интеграционными тестами (они идут
// параллельно в одну БД): 9_300_000.
let vkSeq = 9_300_000;

async function createUser(options: { onboardingVersion?: string } = {}): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `OnboardingUser-${vkSeq + 1}`,
      vkUserId: ++vkSeq,
      avatar: "https://i.pravatar.cc/200?img=10",
      ...(options.onboardingVersion !== undefined
        ? { onboardingVersion: options.onboardingVersion }
        : {}),
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

function postOnboarding(token: string | null, body: unknown) {
  return app.request("/api/v1/users/me/onboarding", {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function extractAdminCookie(response: Response): string | null {
  const setCookieHeader = response.headers.get("set-cookie");
  if (!setCookieHeader) return null;
  const match = /edem_admin_jwt=([^;]+)/.exec(setCookieHeader);
  return match ? match[1] : null;
}

async function loginAndGetCookie(): Promise<string> {
  const response = await app.request("/api/v1/admin/auth/login", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ token: ADMIN_TOKEN }),
  });
  const cookie = extractAdminCookie(response);
  if (!cookie) throw new Error("login did not set admin cookie");
  return cookie;
}

function adminRequest(method: string, path: string, cookie: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: { ...JSON_HEADERS, Cookie: `edem_admin_jwt=${cookie}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("POST /users/me/onboarding — completion", () => {
  it("persists a valid version (200, version in response and DB)", async () => {
    // Arrange
    const userId = await createUser();
    const token = await signAccessToken(userId);

    // Act
    const res = await postOnboarding(token, { version: "1" });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; onboardingVersion: string | null };
    expect(body.id).toBe(userId);
    expect(body.onboardingVersion).toBe("1");
    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.onboardingVersion).toBe("1");
  });

  it("accepts a version of exactly 50 characters (boundary)", async () => {
    // Arrange
    const userId = await createUser();
    const token = await signAccessToken(userId);
    const version = "a".repeat(50);

    // Act
    const res = await postOnboarding(token, { version });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { onboardingVersion: string | null };
    expect(body.onboardingVersion).toBe(version);
  });

  it("requires auth: 401 without a token", async () => {
    // Arrange — пользователь есть, но токена нет.
    await createUser();

    // Act
    const res = await postOnboarding(null, { version: "1" });

    // Assert
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("rejects an empty version (400)", async () => {
    // Arrange
    const userId = await createUser();
    const token = await signAccessToken(userId);

    // Act
    const res = await postOnboarding(token, { version: "" });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Invalid payload");
    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.onboardingVersion).toBeNull();
  });

  it("rejects a whitespace-only version (400, trim before min-length)", async () => {
    // Arrange
    const userId = await createUser();
    const token = await signAccessToken(userId);

    // Act
    const res = await postOnboarding(token, { version: "   " });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Invalid payload");
  });

  it("rejects a version longer than 50 characters (400)", async () => {
    // Arrange
    const userId = await createUser();
    const token = await signAccessToken(userId);

    // Act
    const res = await postOnboarding(token, { version: "a".repeat(51) });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Invalid payload");
  });

  it("rejects a missing version (400)", async () => {
    // Arrange
    const userId = await createUser();
    const token = await signAccessToken(userId);

    // Act
    const res = await postOnboarding(token, {});

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Invalid payload");
  });

  it("rejects a non-string version (400)", async () => {
    // Arrange
    const userId = await createUser();
    const token = await signAccessToken(userId);

    // Act
    const res = await postOnboarding(token, { version: 1 });

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Invalid payload");
  });
});

describe("PATCH /admin/users/:id/onboarding-reset — admin reset", () => {
  it("nulls onboardingVersion of a user with a completed onboarding (200 + DB null)", async () => {
    // Arrange — пользователь с пройденным онбордингом (версия задана в БД).
    const cookie = await loginAndGetCookie();
    const userId = await createUser({ onboardingVersion: "1" });

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/onboarding-reset`,
      cookie
    );

    // Assert — флаг обнулён в БД; ответ — обновлённый admin user DTO.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; bannedAt: string | null };
    expect(body.id).toBe(userId);
    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.onboardingVersion).toBeNull();
  });

  it("is idempotent: resetting an already-null flag returns the user (200)", async () => {
    // Arrange — флаг никогда не устанавливался.
    const cookie = await loginAndGetCookie();
    const userId = await createUser();

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/onboarding-reset`,
      cookie
    );

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(userId);
    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.onboardingVersion).toBeNull();
  });

  it("requires an admin session: 401 without the cookie", async () => {
    // Arrange
    const userId = await createUser({ onboardingVersion: "1" });

    // Act
    const res = await app.request(`/api/v1/admin/users/${userId}/onboarding-reset`, {
      method: "PATCH",
      headers: JSON_HEADERS,
    });

    // Assert — флаг не тронут.
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.onboardingVersion).toBe("1");
  });

  it("returns 404 for a missing user", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();

    // Act
    const res = await adminRequest(
      "PATCH",
      "/api/v1/admin/users/00000000-0000-0000-0000-000000000000/onboarding-reset",
      cookie
    );

    // Assert
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});
