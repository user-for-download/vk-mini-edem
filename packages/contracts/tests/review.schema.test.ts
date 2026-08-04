import { describe, it, expect } from "vitest";
import { createReviewDtoSchema } from "../src/dto/review.dto";

describe("createReviewDtoSchema", () => {
  it("should parse valid review dto", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 5,
      text: "Доехали быстро и без приключений",
    });
    expect(result.success).toBe(true);
  });

  it("should reject review with rating 0", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 0,
      text: "Плохо",
    });
    expect(result.success).toBe(false);
  });

  it("should reject review with rating 6", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 6,
      text: "Отлично",
    });
    expect(result.success).toBe(false);
  });
});
