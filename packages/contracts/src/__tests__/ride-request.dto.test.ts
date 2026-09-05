import { describe, expect, it } from "vitest";
import { createRideRequestDtoSchema, rideRequestStatusUpdateSchema } from "../index.js";

const base = {
  fromCityId: "11111111-1111-4111-8111-111111111111",
  toCityId: "22222222-2222-4222-8222-222222222222",
  earliestAt: "2030-01-01T09:00:00.000Z",
  latestAt: "2030-01-01T12:00:00.000Z",
  expiresAt: "2030-01-02T00:00:00.000Z",
};

describe("RideRequest contracts", () => {
  it("accepts a valid request and defaults seats", () => {
    expect(createRideRequestDtoSchema.parse(base).seats).toBe(1);
  });

  it("rejects equal cities and reversed time window", () => {
    const result = createRideRequestDtoSchema.safeParse({
      ...base,
      toCityId: base.fromCityId,
      latestAt: base.earliestAt,
    });
    expect(result.success).toBe(false);
  });

  it("does not allow terminal status updates", () => {
    expect(rideRequestStatusUpdateSchema.safeParse({ status: "expired" }).success).toBe(false);
  });
});
