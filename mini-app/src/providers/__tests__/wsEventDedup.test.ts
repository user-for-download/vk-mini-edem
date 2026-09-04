import { describe, it, expect } from "vitest";
import { WS_SEEN_EVENTS_MAX, buildWsEventKey, markSeenEvent } from "../wsEventDedup";

/**
 * Юнит-тесты дедупликации входящих WS-событий: повторная доставка
 * после resync на reconnect не должна двоить UI.
 */
describe("wsEventDedup", () => {
  it("builds a stable key for the same event", () => {
    // Act
    const first = buildWsEventKey("booking:new", { bookingId: "b1", tripId: "t1" });
    const second = buildWsEventKey("booking:new", { bookingId: "b1", tripId: "t1" });

    // Assert
    expect(second).toBe(first);
  });

  it("builds different keys for different types or payloads", () => {
    // Act
    const base = buildWsEventKey("booking:new", { bookingId: "b1", tripId: "t1" });
    const otherType = buildWsEventKey("trip:details_changed", { bookingId: "b1", tripId: "t1" });
    const otherPayload = buildWsEventKey("booking:new", { bookingId: "b2", tripId: "t1" });

    // Assert
    expect(otherType).not.toBe(base);
    expect(otherPayload).not.toBe(base);
  });

  it("marks the first delivery as new and the redelivery as duplicate", () => {
    // Arrange
    const key = buildWsEventKey("booking:new", { bookingId: "b1", tripId: "t1" });

    // Act
    const first = markSeenEvent(new Set(), key);
    const second = markSeenEvent(first.seen, key);

    // Assert
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("does not mutate the input set", () => {
    // Arrange
    const before = new Set<string>();

    // Act
    markSeenEvent(before, "k");

    // Assert
    expect(before.size).toBe(0);
  });

  it("resets the set on overflow instead of growing forever", () => {
    // Arrange: множество заполнено до cap
    const full = new Set(Array.from({ length: WS_SEEN_EVENTS_MAX }, (_, i) => `k${i}`));

    // Act
    const { seen, duplicate } = markSeenEvent(full, "fresh");

    // Assert: только новое событие, без краша
    expect(duplicate).toBe(false);
    expect(seen).toEqual(new Set(["fresh"]));
  });
});
