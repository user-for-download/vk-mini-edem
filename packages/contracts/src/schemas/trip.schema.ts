import { z } from "zod";
import { userSchema } from "./user.schema.js";

export const tripTagSchema = z.enum([
  "Можно с животными",
  "Можно курить",
  "Есть багаж",
  "Только девушки",
  "Тихая поездка",
  "С остановками",
]);

export type TripTag = z.infer<typeof tripTagSchema>;

export const tripStatusSchema = z.enum(["active", "cancelled", "completed"]);

export type TripStatus = z.infer<typeof tripStatusSchema>;

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
});

export type Trip = z.infer<typeof tripSchema>;
