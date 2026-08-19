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
 * Hash-маршруты обрабатывает router. Здесь разбираются только fallback
 * query-параметры VK, чтобы не добавлять активный hash-маршрут в историю дважды.
 */
export function parseDeepLink(search = window.location.search): DeepLinkParams {
  const params: DeepLinkParams = {};

  const searchParams = new URLSearchParams(search);
  const tripId = searchParams.get("tripId");
  if (tripId) {
    params.tripId = tripId;
  }
  if (searchParams.get("openHistory") === "true") {
    params.openHistory = true;
  }
  if (searchParams.get("modal")) {
    params.modal = searchParams.get("modal")!;
  }
  if (searchParams.get("driverId")) {
    params.driverId = searchParams.get("driverId")!;
  }

  return params;
}
