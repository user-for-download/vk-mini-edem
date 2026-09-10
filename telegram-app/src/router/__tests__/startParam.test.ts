import { describe, expect, it } from "vitest";
import { parseTripStartParam } from "@/router/AppRouter";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("parseTripStartParam", () => {
  it("принимает UUID и префикс trip_", () => {
    expect(parseTripStartParam(UUID)).toBe(UUID);
    expect(parseTripStartParam(`trip_${UUID}`)).toBe(UUID);
  });

  it("отклоняет мусор и не-UUID", () => {
    expect(parseTripStartParam(null)).toBeNull();
    expect(parseTripStartParam("trip_")).toBeNull();
    expect(parseTripStartParam("not-a-trip")).toBeNull();
    expect(parseTripStartParam(`trip_zzz`)).toBeNull();
  });
});
