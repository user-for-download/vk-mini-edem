import { describe, expect, it } from "vitest";
import { getTripRange, rangesOverlap } from "../../src/utils/overlap.js";

describe("rangesOverlap", () => {
  const at = (t: string): Date => new Date(t);

  it("пересекающиеся интервалы", () => {
    expect(
      rangesOverlap(
        getTripRange(at("2030-06-01T10:00:00Z"), 120),
        getTripRange(at("2030-06-01T11:00:00Z"), 120)
      )
    ).toBe(true);
  });

  it("вложенные интервалы", () => {
    expect(
      rangesOverlap(
        getTripRange(at("2030-06-01T10:00:00Z"), 300),
        getTripRange(at("2030-06-01T11:00:00Z"), 60)
      )
    ).toBe(true);
  });

  it("точная граница (a.end === b.start) НЕ пересечение", () => {
    expect(
      rangesOverlap(
        getTripRange(at("2030-06-01T10:00:00Z"), 120),
        getTripRange(at("2030-06-01T12:00:00Z"), 120)
      )
    ).toBe(false);
  });

  it("непересекающиеся интервалы (с зазором)", () => {
    expect(
      rangesOverlap(
        getTripRange(at("2030-06-01T10:00:00Z"), 60),
        getTripRange(at("2030-06-01T12:00:00Z"), 60)
      )
    ).toBe(false);
  });

  it("одинаковые интервалы", () => {
    const a = getTripRange(at("2030-06-01T10:00:00Z"), 120);
    expect(rangesOverlap(a, getTripRange(at("2030-06-01T10:00:00Z"), 120))).toBe(
      true
    );
  });

  it("одна поездка внутри другой (по длительности)", () => {
    expect(
      rangesOverlap(
        getTripRange(at("2030-06-01T10:00:00Z"), 120),
        getTripRange(at("2030-06-01T10:30:00Z"), 240)
      )
    ).toBe(true);
  });
});

describe("getTripRange", () => {
  it("конец = начало + длительность в минутах", () => {
    const range = getTripRange(new Date("2030-06-01T10:00:00Z"), 90);
    expect(range.end.toISOString()).toBe("2030-06-01T11:30:00.000Z");
  });
});
