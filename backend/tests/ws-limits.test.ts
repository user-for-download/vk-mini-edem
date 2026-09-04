import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WSContext } from "hono/ws";

// Logger замокан: лимит-тесты плодят warn/info, в выводе suite им не место.
vi.mock("../src/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  MAX_CONNECTIONS_PER_IP,
  WS_AUTH_ATTEMPTS_MAX,
  WS_MESSAGE_RATE_MAX,
  __resetWsLimitsForTests,
  wsManager,
} from "../src/services/wsManager.js";
import {
  wsAuthThrottleHits,
  wsConnectionLimitHits,
  wsMessageRateHits,
} from "../src/metrics.js";

/**
 * Лимиты WS (high-fixes-04): per-IP cap concurrent-соединений,
 * per-connection message rate cap, per-IP auth-handshake throttle.
 * Каждый лимит проверяем независимо: IP-cap — без единого сообщения,
 * message-cap — одним соединением с чистого IP, throttle — burst'ом
 * auth-попыток. Транспорт не поднимаем — фейковые WSContext.
 */
function makeFakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WSContext<WebSocket>;
}

describe("WS connection and handshake limits", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    wsManager.closeAll(1000, "test cleanup");
    __resetWsLimitsForTests();
    vi.useRealTimers();
  });

  it("rejects the (MAX+1)th concurrent connection from the same IP with 1013", () => {
    // Arrange — MAX соединений с одного IP, ни одного сообщения.
    for (let i = 0; i < MAX_CONNECTIONS_PER_IP; i++) {
      wsManager.register(makeFakeWs(), "10.0.4.1");
    }
    const beforeHits = wsConnectionLimitHits.get();

    // Act — N+1-е соединение с того же IP.
    const overflow = makeFakeWs();
    wsManager.register(overflow, "10.0.4.1");

    // Assert — отклонено policy-кодом, в статистике его нет.
    expect(overflow.close).toHaveBeenCalledWith(
      1013,
      "Too many connections from this IP"
    );
    expect(wsConnectionLimitHits.get()).toBe(beforeHits + 1);
    expect(wsManager.getStats().totalConnections).toBe(MAX_CONNECTIONS_PER_IP);

    // Act — другой IP тем же лимитом не задет.
    const otherIp = makeFakeWs();
    wsManager.register(otherIp, "10.0.4.2");

    // Assert
    expect(otherIp.close).not.toHaveBeenCalled();
    expect(wsManager.getStats().totalConnections).toBe(
      MAX_CONNECTIONS_PER_IP + 1
    );
  });

  it("throttles messages beyond the per-connection rate cap, per connection", () => {
    // Arrange — одно соединение с чистого IP (per-IP cap не задет).
    const connId = wsManager.register(makeFakeWs(), "10.0.4.3");
    expect(wsManager.authenticate(connId, "user-msg-rate")).toBe(true);
    const beforeHits = wsMessageRateHits.get();

    // Act — MAX сообщений в окне проходят, N+1-е режется.
    for (let i = 0; i < WS_MESSAGE_RATE_MAX; i++) {
      expect(wsManager.recordMessage(connId)).toBe(true);
    }

    // Assert
    expect(wsManager.recordMessage(connId)).toBe(false);
    expect(wsMessageRateHits.get()).toBe(beforeHits + 1);

    // Act — соседнее соединение своим окном не задето...
    const neighbour = wsManager.register(makeFakeWs(), "10.0.4.3");

    // Assert — ...и окно обновляется со временем.
    expect(wsManager.recordMessage(neighbour)).toBe(true);
    vi.advanceTimersByTime(10_001);
    expect(wsManager.recordMessage(connId)).toBe(true);
  });

  it("throttles burst auth attempts from one IP, other IPs unaffected", () => {
    // Arrange
    const connId = wsManager.register(makeFakeWs(), "10.0.4.4");
    const beforeHits = wsAuthThrottleHits.get();

    // Act — burst: MAX попыток проходят, N+1-я throttled.
    for (let i = 0; i < WS_AUTH_ATTEMPTS_MAX; i++) {
      expect(wsManager.recordAuthAttempt(connId)).toBe(true);
    }

    // Assert
    expect(wsManager.recordAuthAttempt(connId)).toBe(false);
    expect(wsAuthThrottleHits.get()).toBe(beforeHits + 1);

    // Act — другой IP тем же окном не задет.
    const otherConn = wsManager.register(makeFakeWs(), "10.0.4.5");

    // Assert
    expect(wsManager.recordAuthAttempt(otherConn)).toBe(true);
  });

  it("auth throttle window survives reconnect (close does not reset it)", () => {
    // Arrange — IP исчерпал окно, соединение закрылось.
    const first = wsManager.register(makeFakeWs(), "10.0.4.6");
    for (let i = 0; i < WS_AUTH_ATTEMPTS_MAX; i++) {
      wsManager.recordAuthAttempt(first);
    }
    wsManager.close(first);

    // Act — новое соединение с того же IP сразу throttled.
    const reconnected = wsManager.register(makeFakeWs(), "10.0.4.6");

    // Assert — переподключение окно не сбрасывает.
    expect(wsManager.recordAuthAttempt(reconnected)).toBe(false);
  });
});
