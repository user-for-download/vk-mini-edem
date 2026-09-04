import { afterEach, describe, expect, it, vi } from "vitest";

// ADMIN_TOKEN и лимиты логина читаются из env при старте/импорте.
// Задаём до импорта app; лимит завышаем, чтобы тест не упёрся в 429.
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-123";
  process.env.ADMIN_LOGIN_RATE_WINDOW_MS = "300000";
  process.env.ADMIN_LOGIN_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");

/**
 * Регрессия: «причина бана» в admin-слое.
 *
 * До расширения PATCH /admin/users/:id/ban принимал пустое тело и сохранял
 * только bannedAt. Теперь:
 *  1) Тело обязательно: { reason: string.trim().min(1).max(500) }.
 *     .strict() — лишние поля отвергаются (например bannedAt с клиента:
 *     время проставляет только сервер).
 *  2) PATCH /admin/users/:id/unban чистит и bannedAt, и banReason.
 *  3) Сериализатор админ-DTO отдаёт banReason (наследуется в GET /admin/users
 *     и в самом ответе PATCH /ban).
 *
 * Паттерны репо (см. admin-moderation.test.ts): app.request(), логин через
 * POST /admin/auth/login с cookie edem_admin_jwt, уникальные vkUserId.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
const ADMIN_TOKEN = "test-admin-token-123";

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

const createdUserIds: string[] = [];
// vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
// Диапазон 9_400_000+ не пересекается с другими интеграционными тестами.
let vkSeq = 9_400_000;

async function createUser(name: string): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `${name}-${vkSeq + 1}`,
      vkUserId: ++vkSeq,
      avatar: "https://i.pravatar.cc/200?img=11",
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

function adminRequest(
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown
) {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (cookie) headers.Cookie = `edem_admin_jwt=${cookie}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.refreshToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("PATCH /admin/users/:id/ban — auth guard", () => {
  it("without admin cookie → 401 UNAUTHORIZED (sanity)", async () => {
    // Arrange
    const userId = await createUser("BanGuard");
    const cookie = await loginAndGetCookie();

    // Act — без cookie (третий аргумент = null).
    const res = await adminRequest("PATCH", `/api/v1/admin/users/${userId}/ban`, null, {
      reason: "Спам",
    });

    // Assert — guard срабатывает до валидации тела, потому 401, а не 400.
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");

    // Cookie остаётся валидной — sanity на инвариантность состояния.
    const sanity = await adminRequest(
      "GET",
      "/api/v1/admin/dashboard",
      cookie
    );
    expect(sanity.status).toBe(200);
  });
});

describe("PATCH /admin/users/:id/ban — body validation", () => {
  it("without body → 400 VALIDATION_FAILED", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanNoBody");

    // Act — JSON-заголовок есть, но body отсутствует: getSanitizedBody
    // ловит ошибку парсинга и подставляет {} → reason обязателен → 400.
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie
    );

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("with empty object → 400 (missing reason)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanEmptyObj");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      {}
    );

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("with empty reason string → 400", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanEmptyReason");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "" }
    );

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("with whitespace-only reason → 400 (trim before min-length)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanWhitespaceReason");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "   \t\n  " }
    );

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("with reason longer than 500 chars → 400", async () => {
    // Arrange — 501 символ на 1 больше верхней границы.
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanLongReason");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "a".repeat(501) }
    );

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("with extra field (strict schema) → 400", async () => {
    // Arrange — клиент не должен проставлять bannedAt сам: время ставит сервер.
    // .strict() в banUserBodySchema отвергает любые лишние ключи.
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanExtraField");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      {
        reason: "Спам",
        extra: "x",
      }
    );

    // Assert
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });
});

describe("PATCH /admin/users/:id/ban — happy path", () => {
  it("with valid reason → 200, bannedAt + banReason persisted, banReason trimmed", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanHappy");

    // Act — оборачиваем в пробелы, чтобы trim() в Zod отработал.
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "  Спам в чатах  " }
    );

    // Assert — ответ 200, оба поля установлены, причина — trimmed.
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      bannedAt: string | null;
      banReason: string | null;
    };
    expect(body.id).toBe(userId);
    expect(body.banReason).toBe("Спам в чатах");
    expect(body.bannedAt).not.toBeNull();
    expect(new Date(body.bannedAt!).getTime()).not.toBeNaN();

    // В БД причина сохранена уже после trim.
    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.banReason).toBe("Спам в чатах");
    expect(dbUser?.bannedAt).not.toBeNull();
  });

  it("second ban overwrites reason (idempotent re-ban)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("BanRepeat");
    const firstRes = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "Спам" }
    );
    expect(firstRes.status).toBe(200);

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "Обман пользователей" }
    );

    // Assert — причина перезаписана. Сравнение bannedAt с предыдущим
    // значением намеренно опущено: разрешение часов недетерминировано
    // (Date.now() может вернуть одно и то же значение для двух соседних
    // вызовов). Покрытие того, что bannedAt вообще устанавливается,
    // уже сделано в предыдущем тесте.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { banReason: string; bannedAt: string };
    expect(body.banReason).toBe("Обман пользователей");
    expect(body.bannedAt).not.toBeNull();

    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.banReason).toBe("Обман пользователей");
  });

  it("returns 404 for missing user", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();

    // Act
    const res = await adminRequest(
      "PATCH",
      "/api/v1/admin/users/00000000-0000-0000-0000-000000000000/ban",
      cookie,
      { reason: "Спам" }
    );

    // Assert
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /admin/users/:id/unban — clears both fields", () => {
  it("after ban → unban returns 200, bannedAt and banReason both null", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("UnbanAfterBan");
    const banRes = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "Спам" }
    );
    expect(banRes.status).toBe(200);

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/unban`,
      cookie
    );

    // Assert — оба поля очищены и в ответе, и в БД.
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      bannedAt: string | null;
      banReason: string | null;
    };
    expect(body.id).toBe(userId);
    expect(body.bannedAt).toBeNull();
    expect(body.banReason).toBeNull();

    const dbUser = await db.user.findUnique({ where: { id: userId } });
    expect(dbUser?.bannedAt).toBeNull();
    expect(dbUser?.banReason).toBeNull();
  });

  it("unban on never-banned user is a no-op (200, both fields null)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("UnbanFresh");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/unban`,
      cookie
    );

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      bannedAt: string | null;
      banReason: string | null;
    };
    expect(body.bannedAt).toBeNull();
    expect(body.banReason).toBeNull();
  });

  it("unban returns 404 for missing user", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();

    // Act
    const res = await adminRequest(
      "PATCH",
      "/api/v1/admin/users/00000000-0000-0000-0000-000000000000/unban",
      cookie
    );

    // Assert
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("admin user list — banReason surfaced in serialized payload", () => {
  it("GET /admin/users returns banReason after ban (active ban with reason)", async () => {
    // Arrange — баним одного пользователя, второго оставляем активным,
    // чтобы убедиться, что banReason в payload относится именно к забаненному.
    const cookie = await loginAndGetCookie();
    const bannedId = await createUser("ListBanned");
    const activeId = await createUser("ListActive");
    const banRes = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${bannedId}/ban`,
      cookie,
      { reason: "Нарушение правил" }
    );
    expect(banRes.status).toBe(200);

    // Act — ищем конкретного пользователя, чтобы не зависеть от
    // пагинации и состава списка.
    const res = await adminRequest(
      "GET",
      `/api/v1/admin/users?q=ListBanned`,
      cookie
    );

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        id: string;
        banReason: string | null;
        bannedAt: string | null;
      }>;
    };
    const bannedItem = body.items.find((item) => item.id === bannedId);
    expect(bannedItem).toBeDefined();
    expect(bannedItem?.banReason).toBe("Нарушение правил");
    expect(bannedItem?.bannedAt).not.toBeNull();

    // Активный пользователь — null.
    const activeRes = await adminRequest(
      "GET",
      `/api/v1/admin/users?q=ListActive`,
      cookie
    );
    const activeBody = (await activeRes.json()) as {
      items: Array<{ id: string; banReason: string | null; bannedAt: string | null }>;
    };
    const activeItem = activeBody.items.find((item) => item.id === activeId);
    expect(activeItem).toBeDefined();
    expect(activeItem?.banReason).toBeNull();
    expect(activeItem?.bannedAt).toBeNull();
  });

  it("after unban, GET /admin/users returns banReason: null (sanity)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const userId = await createUser("ListUnbanned");
    await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/ban`,
      cookie,
      { reason: "Спам" }
    );
    const unbanRes = await adminRequest(
      "PATCH",
      `/api/v1/admin/users/${userId}/unban`,
      cookie
    );
    expect(unbanRes.status).toBe(200);

    // Act
    const res = await adminRequest(
      "GET",
      `/api/v1/admin/users?q=ListUnbanned`,
      cookie
    );

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; banReason: string | null; bannedAt: string | null }>;
    };
    const item = body.items.find((u) => u.id === userId);
    expect(item).toBeDefined();
    expect(item?.banReason).toBeNull();
    expect(item?.bannedAt).toBeNull();
  });
});
