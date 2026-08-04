// mini-app/src/api/bookings.api.ts
import { apiClient } from "./client";
import type {
  Booking,
  CreateBookingDto,
  UpdateBookingStatusDto,
} from "@edem/contracts";
import type { PassengerBooking, Booking as AppBooking } from "@/types";

export const bookingsApi = {
  getUserBookings: (): Promise<PassengerBooking[]> => {
    return apiClient.request<PassengerBooking[]>("/bookings/my");
  },

  /**
   * История поездок пассажира.
   */
  getHistory: (): Promise<AppBooking[]> => {
    return apiClient.request<AppBooking[]>("/bookings/history");
  },

  getTripBookings: (tripId: string): Promise<Booking[]> => {
    return apiClient.request<Booking[]>(`/bookings/trip/${tripId}`);
  },

  createBooking: (data: CreateBookingDto): Promise<Booking> => {
    return apiClient.request<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateBookingStatus: (
    id: string,
    data: UpdateBookingStatusDto
  ): Promise<Booking> => {
    return apiClient.request<Booking>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
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
