import { z } from "zod";
import { tripStatusSchema } from "./trip.schema.js";
import { bookingStatusSchema } from "./booking.schema.js";
import { REVIEW_STATUSES } from "./status.const.js";

// ─── Constants ──────────────────────────────────────────────────────────────
/** Upper bound for `pageSize` on admin list endpoints. */
export const ADMIN_PAGE_SIZE_MAX = 100;

/** Sanity ceiling for the `page` index (offset pagination). Not exported. */
const ADMIN_PAGE_MAX = 10_000;

// ─── Helpers ────────────────────────────────────────────────────────────────
/**
 * Coerces a query-string param into a positive integer with a default and an
 * upper bound. Query params arrive as strings, hence `z.coerce`.
 */
const positiveIntQuery = (def: number, max: number) =>
  z.coerce.number().int().positive().max(max).default(def);

// ─── Query Schemas ──────────────────────────────────────────────────────────
export const adminUsersQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    page: positiveIntQuery(1, ADMIN_PAGE_MAX),
    pageSize: positiveIntQuery(20, ADMIN_PAGE_SIZE_MAX),
  })
  .strict();

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminTripsQuerySchema = z
  .object({
    status: tripStatusSchema.optional(),
    page: positiveIntQuery(1, ADMIN_PAGE_MAX),
    pageSize: positiveIntQuery(20, ADMIN_PAGE_SIZE_MAX),
  })
  .strict();

export type AdminTripsQuery = z.infer<typeof adminTripsQuerySchema>;

export const adminBookingsQuerySchema = z
  .object({
    status: bookingStatusSchema.optional(),
    page: positiveIntQuery(1, ADMIN_PAGE_MAX),
    pageSize: positiveIntQuery(20, ADMIN_PAGE_SIZE_MAX),
  })
  .strict();

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;

export const adminReviewsQuerySchema = z
  .object({
    status: z.enum(REVIEW_STATUSES).optional(),
    page: positiveIntQuery(1, ADMIN_PAGE_MAX),
    pageSize: positiveIntQuery(20, ADMIN_PAGE_SIZE_MAX),
  })
  .strict();

export type AdminReviewsQuery = z.infer<typeof adminReviewsQuerySchema>;

export const adminFeedbackQuerySchema = z
  .object({
    page: positiveIntQuery(1, ADMIN_PAGE_MAX),
    pageSize: positiveIntQuery(20, ADMIN_PAGE_SIZE_MAX),
  })
  .strict();

export type AdminFeedbackQuery = z.infer<typeof adminFeedbackQuerySchema>;

// ─── Body Schemas ───────────────────────────────────────────────────────────
/**
 * Тело логина админ-панели: только статичный ADMIN_TOKEN.
 * Сессия устанавливается httpOnly cookie (ответ см. adminLoginResponseSchema).
 */
export const adminLoginBodySchema = z
  .object({
    token: z.string().min(1).max(512),
  })
  .strict();

export type AdminLoginBody = z.infer<typeof adminLoginBodySchema>;

export const adminBookingStatusBodySchema = z
  .object({
    status: bookingStatusSchema,
  })
  .strict();

export type AdminBookingStatusBody = z.infer<typeof adminBookingStatusBodySchema>;

/**
 * Тело PATCH /admin/users/:id/ban. Причина обязательна: 1–500 символов после
 * trim. `.strict()` отвергает любые лишние поля (например `bannedAt` с клиента —
 * время проставляет только сервер).
 */
export const banUserBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type BanUserBody = z.infer<typeof banUserBodySchema>;

// ─── Param Schemas ──────────────────────────────────────────────────────────
export const adminIdParamsSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export type AdminIdParams = z.infer<typeof adminIdParamsSchema>;
