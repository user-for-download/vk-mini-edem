import { apiGet, apiPatch } from "@/lib/api-client";
import {
  adminBookingDtoSchema,
  adminPaginatedBookingsSchema,
  type BookingStatus,
} from "@edem/contracts";
import type {
  AdminBookingDto,
  AdminBookingStatusBody,
  AdminPaginatedBookings,
} from "@edem/contracts";

export interface FetchBookingsParams {
  status?: BookingStatus;
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
  return apiGet("/bookings?" + qs, adminPaginatedBookingsSchema);
}

export function updateBookingStatus(
  id: string,
  body: AdminBookingStatusBody
): Promise<AdminBookingDto> {
  return apiPatch(
    `/bookings/${encodeURIComponent(id)}/status`,
    body,
    adminBookingDtoSchema,
  );
}
