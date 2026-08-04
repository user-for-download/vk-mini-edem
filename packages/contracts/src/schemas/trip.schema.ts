import { z } from "zod";
import { userSchema } from "./user.schema";

// ─── TripTag ────────────────────────────────────────────────────────────────
export const tripTagSchema = z.enum([
  "Можно с животными",
  "Можно курить",
  "Есть багаж",
  "Только девушки",
  "Тихая поездка",
  "С остановками",
]);

export type TripTag = z.infer<typeof tripTagSchema>;

// ─── TripStatus ─────────────────────────────────────────────────────────────
export const tripStatusSchema = z.enum(["active", "cancelled", "completed"]);

export type TripStatus = z.infer<typeof tripStatusSchema>;

// ─── Trip ───────────────────────────────────────────────────────────────────
export const tripSchema = z.object({
  id: z.string(),
  fromCity: z.string().min(1),
  fromAddress: z.string(),
  toCity: z.string().min(1),
  toAddress: z.string(),
  date: z.string(),
  time: z.string(),
  durationMinutes: z.number().int().positive(),
  distanceKm: z.number().positive(),
  price: z.number().int().positive(),
  seatsTotal: z.number().int().min(1).max(8),
  seatsAvailable: z.number().int().min(0),
  driver: userSchema,
  tags: z.array(tripTagSchema),
  comment: z.string().max(500).optional(),
  status: tripStatusSchema.optional(),

  /**
   * Номера мест, которые сейчас заняты pending/confirmed бронями.
   * Нужно для корректной отрисовки SeatScheme.
   */
  bookedSeats: z.array(z.number().int().min(1)).optional(),

  /**
   * Количество pending-заявок на поездку.
   * Используется в экране «Мои поездки» водителя.
   */
  pendingRequestsCount: z.number().int().min(0).optional(),
});

export type Trip = z.infer<typeof tripSchema>;
