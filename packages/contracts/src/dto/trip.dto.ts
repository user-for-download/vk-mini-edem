import { z } from "zod";
import { tripTagSchema, tripSchema } from "../schemas/trip.schema.js";

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

export const updateTripDtoSchema = createTripDtoSchema.partial();
export type UpdateTripDto = z.infer<typeof updateTripDtoSchema>;

export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

export const paginatedTripsResponseSchema = z.object({
  items: z.array(tripSchema),
  pagination: paginationSchema,
});

export type PaginatedTripsResponse = z.infer<typeof paginatedTripsResponseSchema>;
