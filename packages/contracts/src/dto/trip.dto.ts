import { z } from "zod";
import { tripTagSchema } from "../schemas/trip.schema";

// ─── CreateTripDto ──────────────────────────────────────────────────────────
export const createTripDtoSchema = z.object({
  fromCity: z.string().min(1).max(100),
  fromAddress: z.string().max(200),
  toCity: z.string().min(1).max(100),
  toAddress: z.string().max(200),
  departureAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  distanceKm: z.number().positive(),
  price: z.number().int().positive().max(100000),
  seatsTotal: z.number().int().min(1).max(8),
  tags: z.array(tripTagSchema).max(6),
  comment: z.string().max(500).optional(),
});

export type CreateTripDto = z.infer<typeof createTripDtoSchema>;

// ─── TripFiltersDto ─────────────────────────────────────────────────────────
export const tripFiltersDtoSchema = z.object({
  fromCity: z.string().optional(),
  toCity: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  tags: z.array(tripTagSchema).optional(),
  maxPrice: z.number().int().positive().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type TripFiltersDto = z.infer<typeof tripFiltersDtoSchema>;
