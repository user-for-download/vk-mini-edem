import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, ApiError } from "../client";

/**
 * Юнит-тесты refresh-синхронизации ApiClient: single-flight, события
 * onRefreshStart/onRefreshEnd, isRefreshing(), onTokenUpdate.
 *
 * fetch мокаем controlled-promise'ами (без реальных таймеров), чтобы
 * тесты не зависели от fake timers и не «зависали» на setTimeout.
 */
describe("ApiClient refresh synchronization", () => {
  let client: ApiClient;

  const validUser = {
    id: "user-1",
    name: "Test User",
    avatar: "https://example.com/avatar.png",
    rating: 5,
    reviewsCount: 0,
    tripsCount: 0,
  };

  const validRefreshResponse = {
    accessToken: "new-access",
    refreshToken: "new-refresh",
    expiresIn: 900,
    user: validUser,
  };

  beforeEach(() => {
    client = new ApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchResolved(payload: Record<string, unknown>): void {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);
  }

  it("emits refreshStart when tryRefresh is called", async () => {
    const listener = vi.fn();
    client.onRefreshStart(listener);
    mockFetchResolved(validRefreshResponse);

    client.setRefreshToken("old-refresh");

    const promise = client.tryRefresh();

    // Инициатор уведомляется синхронно — до завершения запроса.
    expect(listener).toHaveBeenCalledTimes(1);

    await promise;
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reports isRefreshing() correctly during refresh", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.spyOn(global, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    client.setRefreshToken("token");

    expect(client.isRefreshing()).toBe(false);

    const promise = client.tryRefresh();
    expect(client.isRefreshing()).toBe(true);

    resolveFetch({
      ok: true,
      json: async () => validRefreshResponse,
    } as Response);

    await promise;
    expect(client.isRefreshing()).toBe(false);
  });

  it("shares the same promise for concurrent tryRefresh calls (single-flight)", async () => {
    let fetchCount = 0;
    vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          fetchCount++;
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => validRefreshResponse,
            } as Response);
          }, 10);
        })
    );

    client.setRefreshToken("token");

    const [r1, r2, r3] = await Promise.all([
      client.tryRefresh(),
      client.tryRefresh(),
      client.tryRefresh(),
    ]);

    expect(r1).toBe("success");
    expect(r2).toBe("success");
    expect(r3).toBe("success");
    expect(fetchCount).toBe(1);
  });

  it("emits refreshEnd only once with success=true", async () => {
    const listener = vi.fn();
    client.onRefreshEnd(listener);
    mockFetchResolved(validRefreshResponse);

    client.setRefreshToken("old");

    await Promise.all([client.tryRefresh(), client.tryRefresh()]);

    // refreshEnd — один раз (только инициатор), со значением success.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("success");
  });

  it("emits a permanent rejection and expires the session on 401", async () => {
    const listener = vi.fn();
    const expiredListener = vi.fn();
    client.onRefreshEnd(listener);
    client.onSessionExpired(expiredListener);
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 401 } as Response);

    client.setRefreshToken("dead");

    const result = await client.tryRefresh();

    expect(result).toBe("permanent-rejection");
    expect(listener).toHaveBeenCalledWith("permanent-rejection");
    expect(expiredListener).toHaveBeenCalledTimes(1);
  });

  it("keeps the session recoverable on network failure", async () => {
    const expiredListener = vi.fn();
    client.onSessionExpired(expiredListener);
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Network error"));

    client.setRefreshToken("valid-token");

    await expect(client.tryRefresh()).resolves.toBe("transient-failure");
    expect(expiredListener).not.toHaveBeenCalled();
  });

  it("treats server and rate-limit failures as transient", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response);

    client.setRefreshToken("valid-token");

    await expect(client.tryRefresh()).resolves.toBe("transient-failure");
    await expect(client.tryRefresh()).resolves.toBe("transient-failure");
  });

  it("rejects malformed successful refresh responses without mutating tokens", async () => {
    const tokenListener = vi.fn();
    client.onTokenUpdate(tokenListener);
    mockFetchResolved({ accessToken: "new-access", refreshToken: "new-refresh" });

    client.setToken("old-access");
    client.setRefreshToken("old-refresh");

    await expect(client.tryRefresh()).resolves.toBe("transient-failure");
    expect(client.getToken()).toBe("old-access");
    expect(tokenListener).not.toHaveBeenCalled();
  });

  it("calls onTokenUpdate with new tokens after successful refresh", async () => {
    const listener = vi.fn();
    client.onTokenUpdate(listener);
    mockFetchResolved({
      ...validRefreshResponse,
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });

    client.setRefreshToken("old");
    await client.tryRefresh();

    expect(listener).toHaveBeenCalledWith({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresIn: 900,
    });
  });

  it("isolates throwing listeners (one listener error does not break others)", async () => {
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const normal = vi.fn();
    client.onRefreshStart(throwing);
    client.onRefreshStart(normal);
    mockFetchResolved(validRefreshResponse);

    client.setRefreshToken("old");

    await client.tryRefresh();

    expect(throwing).toHaveBeenCalled();
    expect(normal).toHaveBeenCalled();
  });

  it("unsubscribes listeners", async () => {
    const listener = vi.fn();
    const unsubscribe = client.onRefreshStart(listener);
    unsubscribe();
    mockFetchResolved(validRefreshResponse);

    client.setRefreshToken("old");
    await client.tryRefresh();

    expect(listener).not.toHaveBeenCalled();
  });

  it("propagates caller cancellation without converting it to a timeout", async () => {
    vi.spyOn(global, "fetch").mockImplementation((_, init) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    const controller = new AbortController();

    const request = client.request("/trips", { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});

/**
 * Поведение ApiError по полю banReason: 403-ответы с телом
 * `{ code: "FORBIDDEN", banReason }` должны сохранять причину в инстансе,
 * любые другие ответы — оставлять поле undefined. Стор useAuthStore
 * опирается на это, чтобы отличать бан от обычной ошибки.
 */
describe("ApiError banReason plumbing", () => {
  it("конструктор ApiError сохраняет переданный banReason", () => {
    // Arrange / Act
    const error = new ApiError("Account is banned", "FORBIDDEN", 403, undefined, "spam");

    // Assert
    expect(error.banReason).toBe("spam");
    expect(error.status).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("конструктор ApiError без banReason оставляет поле undefined", () => {
    // Arrange / Act
    const error = new ApiError("Server error", "INTERNAL", 500);

    // Assert
    expect(error.banReason).toBeUndefined();
  });
});

/**
 * request(): 403 с кодом FORBIDDEN и banReason в теле -> ApiError с
 * этими полями; 500 -> ApiError без banReason. Это контракт между apiClient
 * и useAuthStore: стор ловит ApiError и смотрит на .status/.code/.banReason.
 */
describe("ApiClient.request banReason plumbing", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("на 403 + {code: 'FORBIDDEN', banReason: 'spam'} бросает ApiError с banReason и status=403", async () => {
    // Arrange
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: "FORBIDDEN", message: "Account is banned", banReason: "spam" }),
    } as Response);

    // Act / Assert
    await expect(client.request("/auth/vk")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      code: "FORBIDDEN",
      banReason: "spam",
    });
  });

  it("на 403 без поля banReason бросает ApiError с banReason === null", async () => {
    // Arrange
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: "FORBIDDEN", message: "Account is banned" }),
    } as Response);

    // Act / Assert
    await expect(client.request("/auth/vk")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      code: "FORBIDDEN",
      banReason: null,
    });
  });

  it("на 500 бросает ApiError с banReason: null (нет поля в теле — не бан)", async () => {
    // Arrange
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: "INTERNAL_ERROR", message: "boom" }),
    } as Response);

    // Act
    const error = await client.request("/trips").catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      banReason: null,
    });
  });
});

/**
 * Подписка onBanned срабатывает при refresh-403 с телом
 * `{ code: "FORBIDDEN", banReason }`. Стор useAuthStore слушает это событие,
 * чтобы сразу выставить status="banned" без ожидания повторного bootstrap.
 * Стиль зеркалит уже существующий onSessionExpired-тест.
 */
describe("ApiClient onBanned event", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listener вызывается с banReason, когда /auth/refresh отвечает 403 + FORBIDDEN + banReason", async () => {
    // Arrange
    const bannedListener = vi.fn();
    client.onBanned(bannedListener);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: "FORBIDDEN", message: "Account is banned", banReason: "spam" }),
    } as Response);

    client.setRefreshToken("token");

    // Act
    const result = await client.tryRefresh();

    // Assert
    expect(result).toBe("permanent-rejection");
    expect(bannedListener).toHaveBeenCalledTimes(1);
    expect(bannedListener).toHaveBeenCalledWith("spam");
  });

  it("listener вызывается с null, когда banReason в теле отсутствует (старый бан)", async () => {
    // Arrange
    const bannedListener = vi.fn();
    client.onBanned(bannedListener);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: "FORBIDDEN", message: "Account is banned" }),
    } as Response);

    client.setRefreshToken("token");

    // Act
    const result = await client.tryRefresh();

    // Assert
    expect(result).toBe("permanent-rejection");
    expect(bannedListener).toHaveBeenCalledTimes(1);
    expect(bannedListener).toHaveBeenCalledWith(null);
  });

  it("listener не вызывается на 401 — это обычный session-expired, не бан", async () => {
    // Arrange
    const bannedListener = vi.fn();
    client.onBanned(bannedListener);
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    client.setRefreshToken("dead");

    // Act
    const result = await client.tryRefresh();

    // Assert
    expect(result).toBe("permanent-rejection");
    expect(bannedListener).not.toHaveBeenCalled();
  });
});
