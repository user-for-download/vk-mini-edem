import { z } from "zod";
import { userSchema } from "./user.schema.js";
import { tripSchema } from "./trip.schema.js";

export const bookingStatusSchema = z.enum(["pending", "confirmed", "declined"]);

export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const bookingSchema = z.object({
  id: z.string(),
  trip: tripSchema,
  passenger: userSchema,
  seat: z.number().int().min(1).max(8),
  status: bookingStatusSchema,
  comment: z.string().max(300).optional(),
});

export type Booking = z.infer<typeof bookingSchema>;
