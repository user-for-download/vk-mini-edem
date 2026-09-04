// backend/src/utils/overlap.ts
// Чистые функции для проверки пересечения временных интервалов поездок/броней.

export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Пересечение интервалов: [a.start, a.end) ∩ [b.start, b.end) ≠ ∅.
 * Точная граница (a.end === b.start) пересечением НЕ считается —
 * водитель может приехать и сразу уехать.
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Интервал поездки: от отправления до отправления + длительность. */
export function getTripRange(
  departureAt: Date,
  durationMinutes: number
): TimeRange {
  return {
    start: departureAt,
    end: new Date(departureAt.getTime() + durationMinutes * 60_000),
  };
}
