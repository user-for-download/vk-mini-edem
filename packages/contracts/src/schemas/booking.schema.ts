import { z } from "zod";
import { userSchema } from "./user.schema.js";
import { tripSchema, MAX_SEATS } from "./trip.schema.js";
import { cursorPaginationSchema } from "./common.schema.js";

export const bookingStatusSchema = z.enum(["pending", "confirmed", "declined", "cancelled"]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

/**
 * Статусы, которые водитель может установить через PATCH /:id/status.
 * «cancelled» устанавливается только пассажиром или при отмене поездки.
 */
export const driverBookingActionSchema = z.enum(["confirmed", "declined"]);
export type DriverBookingAction = z.infer<typeof driverBookingActionSchema>;

export const bookingSchema = z.object({
  id: z.string(),
  trip: tripSchema,
  passenger: userSchema,
  seat: z.number().int().min(1).max(MAX_SEATS),
  status: bookingStatusSchema,
  expiresAt: z.string().datetime().nullable().optional(),
  comment: z.string().max(300).optional(),
});

export type Booking = z.infer<typeof bookingSchema>;

/**
 * Enriched-бронь для экрана «Мои брони и история».
 * Бэкенд GET /bookings/my и /bookings/history возвращает расширенный объект
 * с полями scope, canReview, hasReview.
 */
export const passengerBookingSchema = bookingSchema.extend({
  scope: z.enum(["active", "history"]).optional(),
  canReview: z.boolean().optional(),
  hasReview: z.boolean().optional(),
  historyCategory: z.enum(["completed", "cancelled", "other"]).optional(),
});

export type PassengerBooking = z.infer<typeof passengerBookingSchema>;

export const paginatedBookingsResponseSchema = z.object({
  items: z.array(bookingSchema),
  pagination: cursorPaginationSchema,
});

export type PaginatedBookingsResponse = z.infer<typeof paginatedBookingsResponseSchema>;
