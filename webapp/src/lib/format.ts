/**
 * Единый часовой пояс для отображения дат в админ-панели — синхронно
 * с бэкендом (backend/src/serializers/index.ts, DISPLAY_TIMEZONE).
 * Без явного timeZone toLocaleString рендерит даты в часовом поясе
 * браузера зрителя, что сдвигает время на экране.
 */
const DISPLAY_TIMEZONE = "Europe/Moscow";

/** Дата и время в формате ru-RU, зафиксированные в Europe/Moscow. */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("ru-RU", {
    timeZone: DISPLAY_TIMEZONE,
  });
}

/** Только дата (без времени) в формате ru-RU, зафиксированная в Europe/Moscow. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    timeZone: DISPLAY_TIMEZONE,
  });
}
