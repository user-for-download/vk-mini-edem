import { describe, expect, it } from "vitest";
import { moscowDateBoundary } from "../../src/utils/moscowTime.js";

describe("moscowDateBoundary", () => {
  it("maps the beginning of a Moscow date to UTC", () => {
    expect(moscowDateBoundary("2026-08-20")?.toISOString()).toBe("2026-08-19T21:00:00.000Z");
  });

  it("maps the inclusive end of a Moscow date to UTC", () => {
    expect(moscowDateBoundary("2026-08-20", true)?.toISOString()).toBe(
      "2026-08-20T20:59:59.999Z"
    );
  });

  it("rejects malformed and impossible dates", () => {
    expect(moscowDateBoundary("20.08.2026")).toBeNull();
    expect(moscowDateBoundary("2026-02-30")).toBeNull();
  });
});
