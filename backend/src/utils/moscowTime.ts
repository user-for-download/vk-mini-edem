const MOSCOW_OFFSET_MINUTES = 3 * 60;

export function moscowDateBoundary(date: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const hours = endOfDay ? 23 : 0;
  const minutes = endOfDay ? 59 : 0;
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes) - MOSCOW_OFFSET_MINUTES * 60_000;
  const check = new Date(utcMillis + MOSCOW_OFFSET_MINUTES * 60_000);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return new Date(utcMillis + (endOfDay ? 59_999 : 0));
}
