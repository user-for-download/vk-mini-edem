import { describe, it, expect } from "vitest";
import { createBookingDtoSchema } from "../src/dto/booking.dto";

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
