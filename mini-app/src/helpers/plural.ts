// mini-app/src/helpers/plural.ts

/**
 * Русское склонение существительного по числу:
 * pluralRu(1, "поездка", "поездки", "поездок")   → "поездка"
 * pluralRu(3, "поездка", "поездки", "поездок")   → "поездки"
 * pluralRu(22, "поездка", "поездки", "поездок")  → "поездки"
 * pluralRu(25, "поездка", "поездки", "поездок")  → "поездок"
 */
export function pluralRu(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Мест: 1 место / 2 места / 5 мест. */
export const pluralSeats = (n: number): string =>
  pluralRu(n, "место", "места", "мест");
