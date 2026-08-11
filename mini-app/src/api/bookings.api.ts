// mini-app/src/api/bookings.api.ts
import { apiClient } from "./client";
import { passengerBookingSchema, bookingSchema, paginatedBookingsResponseSchema } from "@edem/contracts";
import { z } from "zod";
import type {
  Booking,
  CreateBookingDto,
  UpdateBookingStatusDto,
  PaginatedBookingsResponse,
} from "@edem/contracts";
import type { PassengerBooking, Booking as AppBooking } from "@/types";

const passengerBookingArraySchema = z.array(passengerBookingSchema);

export const bookingsApi = {
  getUserBookings: (): Promise<PassengerBooking[]> => {
    return apiClient.request<PassengerBooking[]>("/bookings/my", {}, passengerBookingArraySchema);
  },

  /**
   * История поездок пассажира.
   */
  getHistory: (): Promise<AppBooking[]> => {
    return apiClient.request<AppBooking[]>("/bookings/history", {}, passengerBookingArraySchema);
  },

  /**
   * Заявки на поездку для водителя с cursor-based пагинацией.
   *
   * @param tripId ID поездки
   * @param cursor Опциональный cursor для следующей страницы
   * @param limit Количество элементов (1-50, default 50)
   */
  getTripBookings: (
    tripId: string,
    cursor?: string,
    limit = 50
  ): Promise<PaginatedBookingsResponse> => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    params.set("limit", String(limit));

    return apiClient.request<PaginatedBookingsResponse>(
      `/bookings/trip/${tripId}?${params.toString()}`,
      {},
      paginatedBookingsResponseSchema
    );
  },

  createBooking: (data: CreateBookingDto): Promise<Booking> => {
    return apiClient.request<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }, bookingSchema);
  },

  updateBookingStatus: (
    id: string,
    data: UpdateBookingStatusDto
  ): Promise<Booking> => {
    return apiClient.request<Booking>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }, bookingSchema);
  },

  /**
   * Отмена брони пассажиром.
   */
  cancelBooking: (id: string): Promise<{ success: boolean }> => {
    return apiClient.request<{ success: boolean }>(
      `/bookings/${id}/cancel`,
      {
        method: "PATCH",
      }
    );
  },
};
