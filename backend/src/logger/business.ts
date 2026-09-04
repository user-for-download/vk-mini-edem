import { logger } from "../logger.js";

/**
 * Логирование бизнес-событий.
 *
 * Каждое событие имеет поле `event` для фильтрации:
 *   logger.info({ event: "trip.created", tripId, driverId }, "business_event")
 */
export function logBusinessEvent(
  event: string,
  data: Record<string, unknown>
): void {
  logger.info({ event, ...data }, "business_event");
}
