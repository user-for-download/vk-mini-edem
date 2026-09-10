import { describe, expect, it } from "vitest";
import { wsServerEventSchema } from "@edem/contracts";
import {
  WS_RECONNECT_BASE_DELAY_MS,
  WS_RECONNECT_MAX_DELAY_MS,
  WS_SEEN_EVENTS_MAX,
  buildWsEventKey,
  classifyWsClose,
  computeReconnectDelay,
  getWsUrl,
  markSeenEvent,
} from "@/api/ws";

/**
 * Транспортная политика Telegram WS-клиента (tg-migration-14, ws.v1):
 * handshake без кредов в URL, bounded backoff 1s→30s + jitter,
 * close-code политика, дедупликация эффектов.
 */
describe("getWsUrl: токен/initData никогда не попадают в URL", () => {
  it("https API origin → wss URL с /ws", () => {
    expect(getWsUrl("https://api.example.com/api/v1")).toBe(
      "wss://api.example.com/api/v1/ws",
    );
  });

  it("http API origin → ws URL (dev-стенд)", () => {
    expect(getWsUrl("http://127.0.0.1:3011/api/v1")).toBe(
      "ws://127.0.0.1:3011/api/v1/ws",
    );
  });

  it("относительный base → хост страницы, схема по протоколу", () => {
    expect(
      getWsUrl("/api/v1", { protocol: "https:", host: "tg.example.com" }),
    ).toBe("wss://tg.example.com/api/v1/ws");
    expect(
      getWsUrl("/api/v1", { protocol: "http:", host: "localhost:3012" }),
    ).toBe("ws://localhost:3012/api/v1/ws");
  });

  it("в URL нет ни токена, ни initData, ни query-параметров вообще", () => {
    for (const url of [
      getWsUrl("https://api.example.com/api/v1"),
      getWsUrl("/api/v1", { protocol: "https:", host: "tg.example.com" }),
    ]) {
      expect(url).not.toContain("?");
      expect(url).not.toContain("token");
      expect(url).not.toContain("initData");
      expect(url).not.toContain("auth_date");
      expect(url).not.toContain("hash");
    }
  });
});

describe("computeReconnectDelay: bounded exponential backoff + jitter", () => {
  it("база 1s на первой попытке, удвоение дальше (без джиттера)", () => {
    const noJitter = () => 0.5; // 0.75 + 0.5*0.5 = 1.0
    expect(computeReconnectDelay(0, noJitter)).toBe(1000);
    expect(computeReconnectDelay(1, noJitter)).toBe(2000);
    expect(computeReconnectDelay(2, noJitter)).toBe(4000);
  });

  it("потолок 30s держится на больших попытках", () => {
    const noJitter = () => 0.5;
    expect(computeReconnectDelay(10, noJitter)).toBe(WS_RECONNECT_MAX_DELAY_MS);
    expect(computeReconnectDelay(100, noJitter)).toBe(WS_RECONNECT_MAX_DELAY_MS);
    expect(WS_RECONNECT_BASE_DELAY_MS).toBe(1000);
    expect(WS_RECONNECT_MAX_DELAY_MS).toBe(30000);
  });

  it("джиттер в диапазоне 0.75..1.25 от базы", () => {
    expect(computeReconnectDelay(1, () => 0)).toBe(1500); // 2000 * 0.75
    expect(computeReconnectDelay(1, () => 1)).toBe(2500); // 2000 * 1.25
  });

  it("отрицательные/дробные попытки нормализуются", () => {
    const noJitter = () => 0.5;
    expect(computeReconnectDelay(-3, noJitter)).toBe(1000);
    expect(computeReconnectDelay(1.9, noJitter)).toBe(2000);
  });
});

describe("classifyWsClose: политика по кодам закрытия (контракт ws.v1)", () => {
  it("4403 — терминальный бан/удаление (без reconnect-loop)", () => {
    expect(classifyWsClose(4403)).toBe("terminal");
  });

  it("1008/4401 — auth-refresh через single-flight HTTP refresh", () => {
    expect(classifyWsClose(1008)).toBe("auth-refresh");
    expect(classifyWsClose(4401)).toBe("auth-refresh");
  });

  it("1000 — штатная остановка, reconnect только по жизненному циклу", () => {
    expect(classifyWsClose(1000)).toBe("stop");
  });

  it("транзиентные коды — reconnect с backoff", () => {
    for (const code of [1001, 1003, 1011, 1013, 1006, 4000]) {
      expect(classifyWsClose(code)).toBe("reconnect");
    }
  });
});

describe("дедупликация эффектов WS-событий", () => {
  it("ключ стабилен для одинаковых type+payload", () => {
    expect(
      buildWsEventKey("booking:new", { bookingId: "b-1", tripId: "t-1" }),
    ).toBe(buildWsEventKey("booking:new", { bookingId: "b-1", tripId: "t-1" }));
    expect(
      buildWsEventKey("booking:new", { bookingId: "b-1", tripId: "t-1" }),
    ).not.toBe(
      buildWsEventKey("booking:new", { bookingId: "b-2", tripId: "t-1" }),
    );
  });

  it("повтор помечается дубликатом, входное множество не мутируется", () => {
    const first = markSeenEvent(new Set(), "booking:new:{\"a\":1}");
    expect(first.duplicate).toBe(false);
    expect(first.seen.size).toBe(1);

    const second = markSeenEvent(first.seen, "booking:new:{\"a\":1}");
    expect(second.duplicate).toBe(true);
    expect(first.seen.size).toBe(1);
  });

  it("переполнение сбрасывает множество (без бесконечного роста памяти)", () => {
    let seen = new Set<string>();
    for (let i = 0; i < WS_SEEN_EVENTS_MAX; i++) {
      seen = markSeenEvent(seen, `event:${i}`).seen;
    }
    expect(seen.size).toBe(WS_SEEN_EVENTS_MAX);
    const overflow = markSeenEvent(seen, "event:overflow");
    expect(overflow.duplicate).toBe(false);
    expect(overflow.seen).toEqual(new Set(["event:overflow"]));
  });
});

describe("ws.v1 wire-контракт: парсер принимает все события, отвергает мусор", () => {
  it("auth:ok и ping без payload", () => {
    expect(wsServerEventSchema.safeParse({ type: "auth:ok" }).success).toBe(true);
    expect(wsServerEventSchema.safeParse({ type: "ping" }).success).toBe(true);
  });

  it("все бизнес-события контракта", () => {
    const events = [
      { type: "booking:new", payload: { bookingId: "b-1", tripId: "t-1" } },
      {
        type: "booking:status_changed",
        payload: { bookingId: "b-1", tripId: "t-1", status: "confirmed" },
      },
      { type: "trip:status_changed", payload: { tripId: "t-1", status: "cancelled" } },
      { type: "trip:details_changed", payload: { tripId: "t-1" } },
      { type: "notification:new", payload: { id: "n-1" } },
    ];
    for (const event of events) {
      expect(wsServerEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it("неизвестный тип и кривой payload — reject (клиент игнорирует)", () => {
    expect(wsServerEventSchema.safeParse({ type: "error", message: "x" }).success).toBe(false);
    expect(wsServerEventSchema.safeParse({ type: "booking:new" }).success).toBe(false);
    expect(
      wsServerEventSchema.safeParse({
        type: "booking:new",
        payload: { bookingId: "b-1" },
      }).success,
    ).toBe(false);
    expect(wsServerEventSchema.safeParse(null).success).toBe(false);
    expect(wsServerEventSchema.safeParse("ping").success).toBe(false);
  });
});
