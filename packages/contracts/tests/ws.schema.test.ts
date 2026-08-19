import { describe, expect, it } from "vitest";
import { wsServerEventSchema } from "../src/index.js";

describe("wsServerEventSchema", () => {
  it("accepts the authentication acknowledgement", () => {
    expect(wsServerEventSchema.parse({ type: "auth:ok" })).toEqual({ type: "auth:ok" });
  });

  it("rejects malformed event payloads", () => {
    expect(
      wsServerEventSchema.safeParse({ type: "booking:new", payload: { bookingId: 1 } }).success,
    ).toBe(false);
  });
});
