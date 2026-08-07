// mini-app/src/api/bookings.api.ts
import { apiClient } from "./client";
import { passengerBookingSchema, bookingSchema } from "@edem/contracts";
import { z } from "zod";
import type {
  Booking,
  CreateBookingDto,
  UpdateBookingStatusDto,
} from "@edem/contracts";
import type { PassengerBooking, Booking as AppBooking } from "@/types";

const passengerBookingArraySchema = z.array(passengerBookingSchema);
const bookingArraySchema = z.array(bookingSchema);

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

  getTripBookings: (tripId: string): Promise<Booking[]> => {
    return apiClient.request<Booking[]>(`/bookings/trip/${tripId}`, {}, bookingArraySchema);
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
