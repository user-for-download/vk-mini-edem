import { z } from "zod";
import { tripTagSchema, tripSchema, MAX_SEATS } from "../schemas/trip.schema.js";

/**
 * Базовый объект без refine.
 * От него отдельно берутся .partial() (для обновления) и .refine() (для обоих вариантов).
 * Это критично: .refine() возвращает ZodEffects, у которого нет метода .partial().
 *
 * `fromCity`/`toCity` — строки-снимки (историческое имя для UI/поиска/
 * уведомлений). `fromCityId`/`toCityId` — FK на справочник City. Без
 * пары id-ов сервер отвергает поездку (autocomplete UI не позволяет
 * ввести город вручную — только выбор из справочника).
 */
const baseTripSchema = z.object({
  fromCity: z.string().min(1).max(100),
  fromAddress: z.string().max(200),
  toCity: z.string().min(1).max(100),
  toAddress: z.string().max(200),
  fromCityId: z.string().uuid(),
  toCityId: z.string().uuid(),
  departureAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  distanceKm: z.number().positive(),
  price: z.number().int().positive().max(100000),
  seatsTotal: z.number().int().min(1).max(MAX_SEATS),
  tags: z.array(tripTagSchema).max(6),
  comment: z.string().max(500).optional(),
});

export const createTripDtoSchema = baseTripSchema.refine(
  (data) =>
    data.fromCity.trim().toLowerCase() !== data.toCity.trim().toLowerCase(),
  {
    message: "Города отправления и назначения совпадают",
    path: ["toCity"],
  },
).refine(
  (data) => data.fromCityId !== data.toCityId,
  {
    message: "Города отправления и назначения совпадают",
    path: ["toCityId"],
  },
);

export type CreateTripDto = z.infer<typeof createTripDtoSchema>;

export const tripFiltersDtoSchema = z.object({
  // Полнотекстовый поиск по городам/адресам (backend: trips GET /).
  q: z.string().max(100).optional(),
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

/**
 * PATCH /trips/:id: маршрут (`fromCity`/`fromCityId`/`toCity`/`toCityId`)
 * ЗАПРЕЩЁН к изменению. Водитель не может подменить направление после
 * публикации, чтобы не обманывать уже подтверждённых пассажиров
 * (см. `EditTripModal`: «Удалить поездку» — единственный способ сменить
 * маршрут). Бэкенд и UI зеркалят это правило.
 *
 * `.strict()` гарантирует, что Zod не «проглотит» запрещённые поля
 * (по умолчанию Zod их просто отбрасывает — а нам нужен 400).
 */
export const updateTripDtoSchema = baseTripSchema
  .partial()
  .omit({ fromCity: true, fromCityId: true, toCity: true, toCityId: true })
  .strict();

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
