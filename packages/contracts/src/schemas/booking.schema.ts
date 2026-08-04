import { z } from "zod";
import { userSchema } from "./user.schema.js";
import { tripSchema } from "./trip.schema.js";

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
  seat: z.number().int().min(1).max(8),
  status: bookingStatusSchema,
  comment: z.string().max(300).optional(),
});

export type Booking = z.infer<typeof bookingSchema>;
