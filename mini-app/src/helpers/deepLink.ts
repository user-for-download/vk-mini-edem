export interface DeepLinkParams {
  /** Открыть конкретную поездку */
  tripId?: string;
  /** Открыть историю броней */
  openHistory?: boolean;
  /** Открыть модалку */
  modal?: string;
  /** Id водителя для модалки профиля */
  driverId?: string;
}

/**
 * Парсит параметры deep link из URL.
 *
 * VK Mini Apps передаёт параметры через:
 * 1. Hash-роутер: /#/trips/t-1
 * 2. Query-параметры: ?tripId=t-1
 */
export function parseDeepLink(): DeepLinkParams {
  const params: DeepLinkParams = {};

  // 1. Проверяем hash (основной механизм)
  const hash = window.location.hash;
  if (hash.includes("/trips/") && !hash.includes("/trips/my")) {
    const match = hash.match(/\/trips\/([^/?#]+)/);
    if (match) {
      params.tripId = match[1];
    }
  }
  if (hash.includes("/bookings/history")) {
    params.openHistory = true;
  }

  // 2. Проверяем query params (fallback)
  const searchParams = new URLSearchParams(window.location.search);
  if (!params.tripId && searchParams.get("tripId")) {
    params.tripId = searchParams.get("tripId")!;
  }
  if (searchParams.get("modal")) {
    params.modal = searchParams.get("modal")!;
  }
  if (searchParams.get("driverId")) {
    params.driverId = searchParams.get("driverId")!;
  }

  return params;
}
