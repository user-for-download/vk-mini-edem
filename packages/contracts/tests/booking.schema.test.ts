import { describe, it, expect } from "vitest";
import { createBookingDtoSchema } from "../src/dto/booking.dto";
import { bookingStatusSchema, driverBookingActionSchema } from "../src/schemas/booking.schema";

describe("createBookingDtoSchema", () => {
  it("should parse valid booking dto", () => {
    const result = createBookingDtoSchema.safeParse({
      tripId: "t-1",
      seat: 2,
      comment: "Возьму небольшой рюкзак",
    });
    expect(result.success).toBe(true);
  });

  it("should reject booking with seat > 8", () => {
    const result = createBookingDtoSchema.safeParse({
      tripId: "t-1",
      seat: 9,
    });
    expect(result.success).toBe(false);
  });

  it("should reject booking with long comment", () => {
    const result = createBookingDtoSchema.safeParse({
      tripId: "t-1",
      seat: 2,
      comment: "a".repeat(301),
    });
    expect(result.success).toBe(false);
  });
});

describe("bookingStatusSchema", () => {
  it("should accept cancelled", () => {
    expect(bookingStatusSchema.safeParse("cancelled").success).toBe(true);
  });

  it("should accept all four statuses", () => {
    for (const s of ["pending", "confirmed", "declined", "cancelled"]) {
      expect(bookingStatusSchema.safeParse(s).success).toBe(true);
    }
  });
});

describe("driverBookingActionSchema", () => {
  it("should accept confirmed", () => {
    expect(driverBookingActionSchema.safeParse("confirmed").success).toBe(true);
  });

  it("should accept declined", () => {
    expect(driverBookingActionSchema.safeParse("declined").success).toBe(true);
  });

  it("should reject cancelled", () => {
    expect(driverBookingActionSchema.safeParse("cancelled").success).toBe(false);
  });

  it("should reject pending", () => {
    expect(driverBookingActionSchema.safeParse("pending").success).toBe(false);
  });
});
