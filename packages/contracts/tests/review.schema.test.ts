import { describe, it, expect } from "vitest";
import { createReviewDtoSchema, REVIEW_TEXT_MAX_LENGTH } from "../src/dto/review.dto";
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

  it("should reject empty text", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 5,
      text: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only text", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 5,
      text: "   \t\n  ",
    });
    expect(result.success).toBe(false);
  });

  it("should trim text on parse", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 5,
      text: "  Доехали быстро и без приключений  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe("Доехали быстро и без приключений");
    }
  });

  it("should reject text longer than REVIEW_TEXT_MAX_LENGTH (150)", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 5,
      text: "x".repeat(REVIEW_TEXT_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewSchema", () => {
  const baseReview = {
    id: "review-1",
    targetRole: "driver",
    rating: 5,
    text: "Отличная поездка",
    status: "published",
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
  };

  it("preserves the serialized review id", () => {
    const result = reviewSchema.safeParse(baseReview);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("review-1");
    }
  });

  it("should accept review with status 'pending'", () => {
    const result = reviewSchema.safeParse({ ...baseReview, status: "pending" });
    expect(result.success).toBe(true);
  });

  it("should accept review with status 'published'", () => {
    const result = reviewSchema.safeParse({ ...baseReview, status: "published" });
    expect(result.success).toBe(true);
  });

  it("should accept review with status 'rejected'", () => {
    const result = reviewSchema.safeParse({ ...baseReview, status: "rejected" });
    expect(result.success).toBe(true);
  });

  it("should reject review with missing status", () => {
    const { status: _status, ...rest } = baseReview;
    const result = reviewSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject review with invalid status", () => {
    const result = reviewSchema.safeParse({ ...baseReview, status: "approved" });
    expect(result.success).toBe(false);
  });

  it("should accept text up to 1000 chars on read (tolerant read schema)", () => {
    const result = reviewSchema.safeParse({
      ...baseReview,
      text: "x".repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it("should reject text longer than 1000 chars on read", () => {
    const result = reviewSchema.safeParse({
      ...baseReview,
      text: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
