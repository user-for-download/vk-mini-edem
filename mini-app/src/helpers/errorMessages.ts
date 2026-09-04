// mini-app/src/helpers/errorMessages.ts
// Словарь серверных кодов ошибок → русские тексты.
// Бэкенд возвращает коды в поле `code` (см. backend/src/errors.ts).

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: "Проверьте введенные данные",
  UNAUTHORIZED: "Необходима авторизация",
  FORBIDDEN: "Доступ запрещен",
  NOT_FOUND: "Объект не найден",
  CONFLICT: "Конфликт данных",
  RATE_LIMITED: "Слишком много запросов, попробуйте позже",
  PAYLOAD_TOO_LARGE: "Размер запроса слишком велик",
  TRIP_NOT_ACTIVE: "Поездка больше не активна",
  TRIP_IN_PAST: "Время отправления уже прошло",
  NO_CAR: "Сначала добавьте автомобиль в профиле",
  SEAT_TAKEN: "Это место только что заняли",
  ALREADY_BOOKED: "Вы уже забронировали место в этой поездке",
  ALREADY_REVIEWED: "Вы уже оставляли отзыв об этой поездке",
  NOT_PARTICIPANT: "Вы не участвовали в этой поездке",
  SELF_REVIEW: "Нельзя оставить отзыв самому себе",
  DRIVER_TRIP_OVERLAP: "У вас уже есть активная поездка на это время. Выберите другое время.",
  PASSENGER_BOOKING_OVERLAP: "У вас уже есть бронь на поездку в это время. Проверьте «Мои поездки».",
  INTERNAL_ERROR: "Внутренняя ошибка сервера",
};

export function getErrorMessage(code?: string, fallback?: string): string {
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  return fallback || "Произошла неизвестная ошибка";
}

/**
 * Сообщение для 429 RATE_LIMITED с учётом времени до сброса лимита.
 * Сервер отдаёт retryAfterMs в теле ответа (и Retry-After заголовке).
 */
export function getRateLimitMessage(retryAfterMs?: number): string {
  if (retryAfterMs && retryAfterMs > 0) {
    const minutes = Math.max(1, Math.ceil(retryAfterMs / 1000 / 60));
    return `Лимит действий исчерпан. Попробуйте через ${minutes} мин.`;
  }
  return ERROR_MESSAGES.RATE_LIMITED;
}
