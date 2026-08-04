import { describe, it, expect } from "vitest";
import { userSchema, carSchema } from "../src/schemas/user.schema";

describe("userSchema", () => {
  const validUser = {
    id: "u-1",
    name: "Илья Северов",
    avatar: "https://i.pravatar.cc/200?img=12",
    rating: 4.9,
    reviewsCount: 34,
    tripsCount: 58,
    isVerified: true,
    car: { model: "Skoda Octavia", color: "белый", plate: "А 217 МК 78" },
    about: "За рулём 7 лет",
  };

  it("should parse valid user", () => {
    const result = userSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it("should reject user with empty name", () => {
    const result = userSchema.safeParse({ ...validUser, name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject user with rating > 5", () => {
    const result = userSchema.safeParse({ ...validUser, rating: 6 });
    expect(result.success).toBe(false);
  });

  it("should reject user with invalid avatar URL", () => {
    const result = userSchema.safeParse({ ...validUser, avatar: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

describe("carSchema", () => {
  it("should parse valid car", () => {
    const result = carSchema.safeParse({
      model: "Skoda Octavia",
      color: "белый",
      plate: "А 217 МК 78",
    });
    expect(result.success).toBe(true);
  });

  it("should reject car with empty model", () => {
    const result = carSchema.safeParse({ model: "", color: "белый", plate: "А 217 МК 78" });
    expect(result.success).toBe(false);
  });
});
