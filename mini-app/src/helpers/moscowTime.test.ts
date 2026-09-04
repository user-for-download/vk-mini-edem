import { describe, expect, it } from "vitest";
import { formatMoscowDateTime, moscowWallClockToIso } from "./moscowTime";

describe("Moscow time helpers", () => {
  it("converts Moscow wall-clock time to an absolute instant", () => {
    expect(moscowWallClockToIso("2026-08-20", "00:15")).toBe("2026-08-19T21:15:00.000Z");
  });

  it("stores late-evening Moscow time as the correct UTC instant", () => {
    // 23:30 МСК = 20:30 UTC того же дня (MSK = UTC+3, без DST);
    // зеркальный граничный случай к 00:15 МСК (уходит на предыдущие сутки UTC).
    expect(moscowWallClockToIso("2026-08-20", "23:30")).toBe("2026-08-20T20:30:00.000Z");
    expect(formatMoscowDateTime("2026-08-20T20:30:00.000Z")).toEqual({
      date: "2026-08-20",
      time: "23:30",
    });
  });

  it("rejects impossible dates and times", () => {
    expect(moscowWallClockToIso("2026-02-30", "10:00")).toBeNull();
    expect(moscowWallClockToIso("2026-08-20", "24:00")).toBeNull();
  });

  it("formats an instant as Moscow wall-clock fields", () => {
    expect(formatMoscowDateTime("2026-08-19T21:15:00.000Z")).toEqual({
      date: "2026-08-20",
      time: "00:15",
    });
  });
});
