import { z } from "zod";
import { userSchema } from "./user.schema.js";

export const tripTagSchema = z.enum([
  "Можно с животными",
  "Можно курить",
  "Есть багаж",
  "Только девушки",
  "Тихая поездка",
  "С остановками",
  "Не курить",
  "Можно с детьми",
  "Разговорчивый",
]);

export type TripTag = z.infer<typeof tripTagSchema>;

export const tripStatusSchema = z.enum(["active", "cancelled", "completed"]);

export type TripStatus = z.infer<typeof tripStatusSchema>;

const localBookingStatusSchema = z.enum(["pending", "confirmed", "declined", "cancelled"]);

export const myBookingSchema = z.object({
  id: z.string(),
  seat: z.number().int().min(1),
  status: localBookingStatusSchema,
  createdAt: z.string().datetime().optional(),
});

export type MyBooking = z.infer<typeof myBookingSchema>;

export const tripSchema = z.object({
  id: z.string(),
  fromCity: z.string().min(1),
  fromAddress: z.string(),
  toCity: z.string().min(1),
  toAddress: z.string(),
  date: z.string(),
  time: z.string(),
  departureAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive(),
  distanceKm: z.number().positive(),
  price: z.number().int().positive(),
  seatsTotal: z.number().int().min(1).max(8),
  seatsAvailable: z.number().int().min(0),
  driver: userSchema,
  tags: z.array(tripTagSchema),
  comment: z.string().max(500).optional(),
  status: tripStatusSchema.optional(),

  bookedSeats: z.array(z.number().int().min(1)).optional(),
  pendingRequestsCount: z.number().int().min(0).optional(),
  myBooking: myBookingSchema.nullable().optional(),
});

export type Trip = z.infer<typeof tripSchema>;
