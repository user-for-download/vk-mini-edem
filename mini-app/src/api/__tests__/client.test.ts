import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "../client";

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
});
