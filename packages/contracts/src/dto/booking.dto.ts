import { z } from "zod";
import { driverBookingActionSchema } from "../schemas/booking.schema.js";
import { MAX_SEATS } from "../schemas/trip.schema.js";

export const createBookingDtoSchema = z.object({
  tripId: z.string(),
  seat: z.number().int().min(1).max(MAX_SEATS),
  comment: z.string().max(300).optional(),
});
export type CreateBookingDto = z.infer<typeof createBookingDtoSchema>;

export const updateBookingStatusDtoSchema = z.object({
  status: driverBookingActionSchema,
});
export type UpdateBookingStatusDto = z.infer<typeof updateBookingStatusDtoSchema>;
