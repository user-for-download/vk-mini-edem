import { describe, expect, it } from "vitest";
import { createReportDtoSchema, updateReportStatusDtoSchema } from "../index.js";

const valid = {
  targetType: "trip",
  targetId: "11111111-1111-4111-8111-111111111111",
  category: "safety",
  description: "Опасное поведение водителя",
};

describe("Report contracts", () => {
  it("accepts and trims a report description", () => {
    expect(createReportDtoSchema.parse({ ...valid, description: "  Жалоба  " }).description).toBe("Жалоба");
  });

  it("rejects invalid target/category and blank description", () => {
    expect(createReportDtoSchema.safeParse({ ...valid, targetType: "car", category: "abuse", description: " " }).success).toBe(false);
  });

  it("allows only moderation transitions", () => {
    expect(updateReportStatusDtoSchema.safeParse({ status: "pending" }).success).toBe(false);
    expect(updateReportStatusDtoSchema.safeParse({ status: "resolved", resolutionNote: "Готово" }).success).toBe(true);
  });
});
