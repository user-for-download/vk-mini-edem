import { afterEach, describe, expect, it, vi } from "vitest";

// Лимитер /auth/refresh создаётся при импорте app со значениями из env.
// Поднимаем лимит до импорта модулей, чтобы тест не упирался в 429.
vi.hoisted(() => {
  process.env.REFRESH_RATE_WINDOW_MS = "900000";
  process.env.REFRESH_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { signAccessToken, signRefreshToken } = await import(
  "../../src/auth/tokens.js"
);
const { createWsHandler } = await import("../../src/ws/index.js");
const { wsManager } = await import("../../src/services/wsManager.js");

/**
 * Регрессия бан-энфорсмента в auth-слое:
 *
 * 1) /auth/refresh: JWT stateless и не знает о бане — до исправления
 *    забаненный пользователь продолжал ротировать refresh-токены. Теперь
 *    bannedAt проверяется ДО выпуска токенов: 403 + отзыв всех активных
 *    refresh-токенов (бан нельзя обойти через другую сессию).
 *
 * 2) WS-аутентификация: до исправления забаненный с валидным access-токеном
 *    аутентифицировался на /api/v1/ws. Теперь пользователь дополнительно
 *    проверяется в БД: bannedAt → закрытие соединения с кодом 4403.
 *
 * Паттерны репо (см. refresh-rotation.test.ts, ws-manager.test.ts):
 * app.request() вместо supertest, фейковые WSContext (send/close — vi.fn()),
 * уникальные vkUserId (INT4-счётчик).
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

const createdUserIds: string[] = [];
// vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
let vkSeq = 9_100_000;

async function createUser(options: { banned?: boolean } = {}): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `BanUser-${vkSeq + 1}`,
      vkUserId: ++vkSeq,
      avatar: "https://i.pravatar.cc/200?img=8",
      ...(options.banned ? { bannedAt: new Date() } : {}),
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function postRefresh(refreshToken: string) {
  return app.request("/api/v1/auth/refresh", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ refreshToken }),
  });
}

async function countActiveTokens(userId: string): Promise<number> {
  return db.refreshToken.count({ where: { userId, revokedAt: null } });
}

afterEach(async () => {
  // WS-соединения из тестов ниже: закрываем, чтобы не оставлять живые
  // таймеры auth/ping в общем wsManager (паттерн ws-manager.test.ts).
  wsManager.closeAll(1000, "test cleanup");

  if (createdUserIds.length > 0) {
    await db.refreshToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("ban enforcement: /auth/refresh", () => {
  it("non-banned user rotates a valid refresh token (200 + new tokens)", async () => {
    // Arrange
    const userId = await createUser();
    const refreshToken = await signRefreshToken(userId);

    // Act
    const res = await postRefresh(refreshToken);

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it("banned user with a valid refresh token gets 403 FORBIDDEN", async () => {
    // Arrange
    const userId = await createUser({ banned: true });
    const refreshToken = await signRefreshToken(userId);

    // Act
    const res = await postRefresh(refreshToken);

    // Assert
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("FORBIDDEN");
  });

  it("banned-user rejection revokes ALL active refresh tokens", async () => {
    // Arrange — две активные сессии (два активных токена).
    const userId = await createUser({ banned: true });
    const firstToken = await signRefreshToken(userId);
    await signRefreshToken(userId);
    expect(await countActiveTokens(userId)).toBe(2);

    // Act
    const res = await postRefresh(firstToken);

    // Assert — токены не выданы, обе сессии отозваны.
    expect(res.status).toBe(403);
    expect(await countActiveTokens(userId)).toBe(0);
  });
});

describe("ban enforcement: WS auth", () => {
  interface FakeWs {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }

  function makeFakeWs(): FakeWs {
    // Транспорт не поднимаем: нужны только send/close (паттерн ws-manager.test.ts).
    return { send: vi.fn(), close: vi.fn() };
  }

  /**
   * createWsHandler(upgradeWebSocket) передаёт в upgradeWebSocket фабрику
   * обработчиков. Подменяем upgradeWebSocket заглушкой и забираем фабрику,
   * чтобы вызвать onOpen/onMessage напрямую без WS-транспорта.
   */
  interface WsHandlers {
    onOpen: (evt: unknown, ws: unknown) => void;
    onMessage: (evt: unknown, ws: unknown) => void | Promise<void>;
  }

  function captureWsHandlers(): WsHandlers {
    let handlers: WsHandlers | null = null;
    createWsHandler((createHandlers: () => WsHandlers) => {
      handlers = createHandlers();
      return (_c: unknown, next: () => Promise<void>) => next();
    });
    if (!handlers) throw new Error("upgradeWebSocket factory was not called");
    return handlers;
  }

  async function authenticateOverWs(token: string): Promise<FakeWs> {
    const handlers = captureWsHandlers();
    const ws = makeFakeWs();
    handlers.onOpen(undefined, ws);
    await handlers.onMessage(
      { data: JSON.stringify({ type: "auth", token }) },
      ws
    );
    return ws;
  }

  it("banned user authenticating over WS gets connection closed with 4403", async () => {
    // Arrange — валидный access-токен (JWT проходит), пользователь забанен.
    const userId = await createUser({ banned: true });
    const accessToken = await signAccessToken(userId);

    // Act
    const ws = await authenticateOverWs(accessToken);

    // Assert — соединение закрыто с 4403, auth:ok не отправлялся.
    expect(ws.close).toHaveBeenCalledWith(4403, "Account is banned");
    expect(ws.send).not.toHaveBeenCalledWith(
      JSON.stringify({ type: "auth:ok" })
    );
  });

  it("non-banned user authenticates successfully (auth:ok)", async () => {
    // Arrange
    const userId = await createUser();
    const accessToken = await signAccessToken(userId);

    // Act
    const ws = await authenticateOverWs(accessToken);

    // Assert
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "auth:ok" }));
    expect(ws.close).not.toHaveBeenCalled();
  });
});
