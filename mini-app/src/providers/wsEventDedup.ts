/**
 * Верхняя граница множества уже обработанных WS-событий.
 *
 * После reconnect клиент делает resync (инвалидация + refetch), а сервер
 * может повторно доставить события, пропущенные во время обрыва.
 * Без защиты повторный показ снэкбара/инвалидации дублировал бы UI.
 * При переполнении множество очищается целиком — лучше один возможный
 * повтор, чем бесконечный рост памяти.
 */
export const WS_SEEN_EVENTS_MAX = 200;

/**
 * Строит стабильный ключ события для дедупликации.
 * Пейлоады плоские ({bookingId, tripId, ...}), JSON.stringify детерминирован.
 */
export function buildWsEventKey(type: string, payload: unknown): string {
  return `${type}:${JSON.stringify(payload ?? null)}`;
}

/**
 * Отмечает событие как обработанное. Возвращает новое множество
 * (входное не мутируется). True = событие уже видели (дубликат).
 */
export function markSeenEvent(seen: ReadonlySet<string>, key: string): { seen: Set<string>; duplicate: boolean } {
  if (seen.has(key)) {
    return { seen: new Set(seen), duplicate: true };
  }
  if (seen.size >= WS_SEEN_EVENTS_MAX) {
    return { seen: new Set([key]), duplicate: false };
  }
  return { seen: new Set(seen).add(key), duplicate: false };
}
