import { describe, it, expect } from "vitest";
import type { WsClientEvent } from "@edem/contracts";
import { WS_SEND_QUEUE_MAX, drainOutbox, enqueueOutbox } from "../wsSendQueue";

/**
 * Юнит-тесты очереди исходящих WS-сообщений: порядок FIFO, граница cap
 * со сбросом самого старого, очистка при drain. Чистые функции —
 * моки WebSocket не нужны.
 */
describe("wsSendQueue", () => {
  const pong = (): WsClientEvent => ({ type: "pong" });

  it("preserves FIFO order on enqueue", () => {
    // Arrange
    const first: WsClientEvent = { type: "auth", token: "a" };
    const second: WsClientEvent = { type: "auth", token: "b" };

    // Act
    const { queue } = enqueueOutbox(enqueueOutbox([], first).queue, second);

    // Assert
    expect(queue).toEqual([first, second]);
  });

  it("does not mutate the input queue", () => {
    // Arrange
    const before: WsClientEvent[] = [];

    // Act
    enqueueOutbox(before, pong());

    // Assert
    expect(before).toEqual([]);
  });

  it("drops the oldest message on overflow and reports it", () => {
    // Arrange: очередь заполнена до cap
    const full: WsClientEvent[] = Array.from({ length: WS_SEND_QUEUE_MAX }, (_, i) => ({
      type: "auth",
      token: `token-${i}`,
    }));

    // Act
    const { queue, dropped } = enqueueOutbox(full, { type: "auth", token: "newest" });

    // Assert: размер в cap, самое старое ушло, порядок остальных сохранён
    expect(dropped).toBe(true);
    expect(queue).toHaveLength(WS_SEND_QUEUE_MAX);
    expect(queue[0]).toEqual({ type: "auth", token: "token-1" });
    expect(queue[WS_SEND_QUEUE_MAX - 1]).toEqual({ type: "auth", token: "newest" });
  });

  it("reports no drop while under capacity", () => {
    // Act
    const { queue, dropped } = enqueueOutbox([], pong());

    // Assert
    expect(dropped).toBe(false);
    expect(queue).toHaveLength(1);
  });

  it("drains all events in order and empties the queue", () => {
    // Arrange
    const { queue } = enqueueOutbox(enqueueOutbox([], pong()).queue, pong());

    // Act
    const { events, queue: rest } = drainOutbox(queue);

    // Assert: flush при reconnect отправляет именно в этом порядке
    expect(events).toHaveLength(2);
    expect(rest).toEqual([]);
  });

  it("drains an empty queue to empty events", () => {
    // Act
    const { events, queue } = drainOutbox([]);

    // Assert
    expect(events).toEqual([]);
    expect(queue).toEqual([]);
  });
});
