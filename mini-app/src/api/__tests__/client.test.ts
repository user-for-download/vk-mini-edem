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
    mockFetchResolved({ accessToken: "new-access", refreshToken: "new-refresh" });

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
      json: async () => ({ accessToken: "x", refreshToken: "y" }),
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
              json: async () => ({ accessToken: "x", refreshToken: "y" }),
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

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
    expect(fetchCount).toBe(1);
  });

  it("emits refreshEnd only once with success=true", async () => {
    const listener = vi.fn();
    client.onRefreshEnd(listener);
    mockFetchResolved({ accessToken: "a", refreshToken: "b" });

    client.setRefreshToken("old");

    await Promise.all([client.tryRefresh(), client.tryRefresh()]);

    // refreshEnd — один раз (только инициатор), со значением success.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(true);
  });

  it("emits refreshEnd with success=false on failed refresh", async () => {
    const listener = vi.fn();
    client.onRefreshEnd(listener);
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 401 } as Response);

    client.setRefreshToken("dead");

    await client.tryRefresh();

    expect(listener).toHaveBeenCalledWith(false);
  });

  it("calls onTokenUpdate with new tokens after successful refresh", async () => {
    const listener = vi.fn();
    client.onTokenUpdate(listener);
    mockFetchResolved({ accessToken: "new-access-token", refreshToken: "new-refresh-token" });

    client.setRefreshToken("old");
    await client.tryRefresh();

    expect(listener).toHaveBeenCalledWith({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });
  });

  it("isolates throwing listeners (one listener error does not break others)", async () => {
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const normal = vi.fn();
    client.onRefreshStart(throwing);
    client.onRefreshStart(normal);
    mockFetchResolved({ accessToken: "a", refreshToken: "b" });

    client.setRefreshToken("old");

    await client.tryRefresh();

    expect(throwing).toHaveBeenCalled();
    expect(normal).toHaveBeenCalled();
  });

  it("unsubscribes listeners", async () => {
    const listener = vi.fn();
    const unsubscribe = client.onRefreshStart(listener);
    unsubscribe();
    mockFetchResolved({ accessToken: "a", refreshToken: "b" });

    client.setRefreshToken("old");
    await client.tryRefresh();

    expect(listener).not.toHaveBeenCalled();
  });
});
