import { apiGet, apiPatch } from "@/lib/api-client";
import type {
  AdminBookingDto,
  AdminBookingStatusBody,
  AdminPaginatedBookings,
} from "@edem/contracts";

export interface FetchBookingsParams {
  status?: "pending" | "confirmed" | "declined" | "cancelled";
  page: number;
  pageSize: number;
}

export function fetchBookings(
  params: FetchBookingsParams
): Promise<AdminPaginatedBookings> {
  const qs = new URLSearchParams();
  if (params.status) {
    qs.set("status", params.status);
  }
  qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize));
  return apiGet<AdminPaginatedBookings>("/bookings?" + qs);
}

export function updateBookingStatus(
  id: string,
  body: AdminBookingStatusBody
): Promise<AdminBookingDto> {
  return apiPatch<AdminBookingDto>(`/bookings/${id}/status`, body);
}
