const MOSCOW_OFFSET_HOURS = 3;
const MOSCOW_TIME_ZONE = "Europe/Moscow";

export function moscowWallClockToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return null;

  const utcMillis = Date.UTC(year, month - 1, day, hours - MOSCOW_OFFSET_HOURS, minutes);
  const value = new Date(utcMillis);
  const check = new Date(utcMillis + MOSCOW_OFFSET_HOURS * 60 * 60 * 1000);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hours ||
    check.getUTCMinutes() !== minutes
  ) {
    return null;
  }

  return value.toISOString();
}

export function formatMoscowDateTime(iso: string): { date: string; time: string } | null {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;

  const values: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value)) {
    values[part.type] = part.value;
  }

  if (!values.year || !values.month || !values.day || !values.hour || !values.minute) return null;
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}
