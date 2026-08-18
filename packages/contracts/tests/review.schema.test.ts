import { describe, it, expect } from "vitest";
import { createReviewDtoSchema } from "../src/dto/review.dto";
import { reviewSchema } from "../src/schemas/review.schema";

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

describe("reviewSchema", () => {
  it("preserves the serialized review id", () => {
    const result = reviewSchema.safeParse({
      id: "review-1",
      targetRole: "driver",
      rating: 5,
      text: "Отличная поездка",
      date: "1 января 2026 г.",
      tripRoute: "Москва → Тула",
      author: {
        id: "user-1",
        name: "Автор",
        avatar: "https://example.com/avatar.jpg",
        rating: 5,
        reviewsCount: 1,
        tripsCount: 1,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("review-1");
    }
  });
});
