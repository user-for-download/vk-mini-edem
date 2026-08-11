import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WSContext } from "hono/ws";
import { wsManager, startWsReaper, stopWsReaper } from "../src/services/wsManager.js";
import { wsConnectionLimitHits } from "../src/metrics.js";
import { app } from "../src/app.js";

/**
 * Юнит-тесты WebSocketManager: лимит соединений на пользователя,
 * auth timeout, reaper мёртвых соединений. WS-транспорт не поднимаем —
 * передаём фейковые WSContext-объекты (нужны только send/close).
 */
function makeFakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WSContext<WebSocket>;
}

describe("WebSocketManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopWsReaper();
    wsManager.closeAll(1000, "test cleanup");
    vi.useRealTimers();
  });

  it("rejects the 6th connection for the same user with 1013", () => {
    for (let i = 0; i < 5; i++) {
      const connId = wsManager.register(makeFakeWs());
      expect(wsManager.authenticate(connId, "user-1")).toBe(true);
    }

    const beforeHits = wsConnectionLimitHits.get();

    // 6-я вкладка/клиент того же пользователя.
    const sixth = wsManager.register(makeFakeWs());
    const accepted = wsManager.authenticate(sixth, "user-1");

    expect(accepted).toBe(false);
    expect(wsConnectionLimitHits.get()).toBe(beforeHits + 1);

    // close(connId, 1013, ...) внутри authenticate убрал соединение:
    // 6-го в статистике нет, 5 «живых» остались.
    expect(wsManager.getStats().totalConnections).toBe(5);
    expect(wsManager.getStats().authenticatedUsers).toBe(1);

    // Закрытие 6-го соединения не тронуло 5 «живых» — событие доставляется
    // во все 5 соединений пользователя.
    const sent = wsManager.sendToUser("user-1", {
      type: "notification:new",
      payload: { id: "refresh" },
    });
    expect(sent).toBe(5);
  });

  it("re-authentication by the same user is idempotent and does not hit the limit", () => {
    const connId = wsManager.register(makeFakeWs());

    expect(wsManager.authenticate(connId, "user-2")).toBe(true);
    expect(wsManager.authenticate(connId, "user-2")).toBe(true);

    expect(wsManager.getStats().totalConnections).toBe(1);
    expect(wsManager.getStats().authenticatedUsers).toBe(1);
  });

  it("closes an unauthenticated connection after the auth timeout (4401)", () => {
    const ws = makeFakeWs();
    const connId = wsManager.register(ws);

    vi.advanceTimersByTime(5_000);

    expect(ws.close).toHaveBeenCalledWith(4401, "Authentication timeout");
    expect(wsManager.getStats().totalConnections).toBe(0);
  });

  it("reaper closes connections with no pong in time (1001)", () => {
    const ws = makeFakeWs();
    const connId = wsManager.register(ws);
    expect(wsManager.authenticate(connId, "user-3")).toBe(true);

    startWsReaper();
    // Ping уходит на 30s/60s/90s, pong не приходит → после 60s соединение
    // считается мёртвым; первый reaper, который увидит просрочку, — на 90s.
    vi.advanceTimersByTime(91_000);

    expect(ws.close).toHaveBeenCalledWith(1001, "Pong timeout");
    expect(wsManager.getStats().totalConnections).toBe(0);
  });

  it("startWsReaper/stopWsReaper are idempotent", () => {
    expect(() => {
      startWsReaper();
      startWsReaper();
      stopWsReaper();
      stopWsReaper();
    }).not.toThrow();
  });
});

describe("GET /metrics", () => {
  it("exposes Prometheus-format metrics", async () => {
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toContain("# TYPE ws_connection_limit_hits_total counter");
    expect(body).toContain("# TYPE ws_connections gauge");
    expect(body).toContain("# TYPE http_requests_total counter");
    expect(body).toContain("ws_connection_limit_hits_total ");
  });
});
