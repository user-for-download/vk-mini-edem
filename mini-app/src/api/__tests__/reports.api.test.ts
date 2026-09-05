import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../client";
import { reportsApi } from "../reports.api";

describe("reportsApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a report through POST /reports", async () => {
    const request = vi.spyOn(apiClient, "request").mockResolvedValue({});
    await reportsApi.create({ targetType: "trip", targetId: "11111111-1111-4111-8111-111111111111", category: "safety", description: "Опасно" });
    expect(request).toHaveBeenCalledWith("/reports", { method: "POST", body: JSON.stringify({ targetType: "trip", targetId: "11111111-1111-4111-8111-111111111111", category: "safety", description: "Опасно" }) }, expect.anything());
  });
});
