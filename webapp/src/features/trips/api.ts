import { apiGet, apiPatch } from "@/lib/api-client";
import {
  adminPaginatedTripsSchema,
  adminTripDtoSchema,
  type AdminPaginatedTrips,
  type AdminTripDto,
  type TripStatus,
} from "@edem/contracts";

export type { TripStatus };

export interface FetchTripsParams {
  status?: TripStatus;
  page: number;
  pageSize: number;
}

/**
 * GET /api/v1/admin/trips?status=&page=&pageSize=
 * (undefined-статус опускаем — бэкенд вернёт все поездки).
 */
export function fetchTrips(params: FetchTripsParams): Promise<AdminPaginatedTrips> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.status !== undefined) {
    search.set("status", params.status);
  }
  return apiGet(`/trips?${search.toString()}`, adminPaginatedTripsSchema);
}

/**
 * PATCH /api/v1/admin/trips/:id/cancel — отмена поездки.
 */
export function cancelTrip(id: string): Promise<AdminTripDto> {
  return apiPatch(`/trips/${encodeURIComponent(id)}/cancel`, undefined, adminTripDtoSchema);
}
