import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type {
  AdminCityDto,
  PaginatedCitiesResponse,
} from "@edem/contracts";

export interface FetchCitiesParams {
  page: number;
  pageSize: number;
  q?: string;
}

/**
 * GET /api/v1/admin/cities?q=&page=&pageSize= — список точек справочника.
 */
export function fetchCities(
  params: FetchCitiesParams,
): Promise<PaginatedCitiesResponse> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.q) search.set("q", params.q);
  return apiGet<PaginatedCitiesResponse>(`/cities?${search.toString()}`);
}

/**
 * POST /api/v1/admin/cities — создать новую точку.
 */
export function createCity(name: string): Promise<AdminCityDto> {
  return apiPost<AdminCityDto>("/cities", { name });
}

/**
 * PATCH /api/v1/admin/cities/:id — переименовать.
 */
export function renameCity(id: string, name: string): Promise<AdminCityDto> {
  return apiPatch<AdminCityDto>(`/cities/${encodeURIComponent(id)}`, { name });
}

/**
 * DELETE /api/v1/admin/cities/:id — удалить. 409, если есть поездки.
 */
export function deleteCity(id: string): Promise<{ ok: true; id: string }> {
  return apiDelete<{ ok: true; id: string }>(
    `/cities/${encodeURIComponent(id)}`,
  );
}
