import { describe, it, expect } from "vitest";
import { banUserBodySchema } from "../src/schemas/admin.schema";
import { adminUserDtoSchema } from "../src/dto/admin.dto";
import { bannedErrorSchema } from "../src/dto/auth.dto";

describe("banUserBodySchema", () => {
  it("should parse valid reason", () => {
    // Arrange
    const body = { reason: "Спам в чатах" };

    // Act
    const result = banUserBodySchema.safeParse(body);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe("Спам в чатах");
    }
  });

  it("should trim surrounding whitespace on parse", () => {
    // Arrange
    const body = { reason: "  Спам  " };

    // Act
    const result = banUserBodySchema.safeParse(body);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe("Спам");
    }
  });

  it("should reject missing reason", () => {
    // Act
    const result = banUserBodySchema.safeParse({});

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject empty reason", () => {
    // Act
    const result = banUserBodySchema.safeParse({ reason: "" });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject whitespace-only reason (trim before min-length)", () => {
    // Act
    const result = banUserBodySchema.safeParse({ reason: "   \t\n " });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should accept reason of exactly 500 characters (boundary)", () => {
    // Arrange
    const body = { reason: "a".repeat(500) };

    // Act
    const result = banUserBodySchema.safeParse(body);

    // Assert
    expect(result.success).toBe(true);
  });

  it("should reject reason longer than 500 characters", () => {
    // Arrange
    const body = { reason: "a".repeat(501) };

    // Act
    const result = banUserBodySchema.safeParse(body);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject non-string reason", () => {
    // Act
    const result = banUserBodySchema.safeParse({ reason: 1 });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject extra fields (strict)", () => {
    // Act
    const result = banUserBodySchema.safeParse({
      reason: "Спам",
      bannedAt: "2026-08-27T00:00:00.000Z",
    });

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("adminUserDtoSchema — banReason", () => {
  const baseUser = {
    id: "u-1",
    name: "Иван Петров",
    avatar: "https://i.pravatar.cc/200?img=12",
    rating: 4.5,
    tripsCount: 10,
    reviewsCount: 4,
    isVerified: false,
    bannedAt: null,
    createdAt: "2026-08-27T00:00:00.000Z",
  };

  it("should parse user with banReason string (active ban)", () => {
    // Act
    const result = adminUserDtoSchema.safeParse({
      ...baseUser,
      banReason: "Спам в чатах",
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse user with banReason null (no ban or legacy ban without reason)", () => {
    // Act
    const result = adminUserDtoSchema.safeParse({ ...baseUser, banReason: null });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should reject user with missing banReason (required field)", () => {
    const { banReason: _omitted, ...rest } = { ...baseUser, banReason: null };
    // Act
    const result = adminUserDtoSchema.safeParse(rest);

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject user with non-nullable non-string banReason", () => {
    // Act
    const result = adminUserDtoSchema.safeParse({ ...baseUser, banReason: 123 });

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("bannedErrorSchema", () => {
  it("should parse valid 403 ban error with reason", () => {
    // Act
    const result = bannedErrorSchema.safeParse({
      code: "FORBIDDEN",
      message: "Account is banned",
      banReason: "Спам в чатах",
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should parse valid 403 ban error with null banReason (legacy ban)", () => {
    // Act
    const result = bannedErrorSchema.safeParse({
      code: "FORBIDDEN",
      message: "Account is banned",
      banReason: null,
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should reject error with non-FORBIDDEN code (literal type)", () => {
    // Act
    const result = bannedErrorSchema.safeParse({
      code: "UNAUTHORIZED",
      message: "Account is banned",
      banReason: null,
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject error with missing banReason", () => {
    // Act
    const result = bannedErrorSchema.safeParse({
      code: "FORBIDDEN",
      message: "Account is banned",
    });

    // Assert
    expect(result.success).toBe(false);
  });

  it("should reject error with extra fields (strict)", () => {
    // Act
    const result = bannedErrorSchema.safeParse({
      code: "FORBIDDEN",
      message: "Account is banned",
      banReason: null,
      extra: true,
    });

    // Assert
    expect(result.success).toBe(false);
  });
});
