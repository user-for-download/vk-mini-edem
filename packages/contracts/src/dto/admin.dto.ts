import { z } from "zod";
import { REVIEW_STATUSES } from "../schemas/status.const.js";

// ─── Auth ───────────────────────────────────────────────────────────────────
/**
 * Ответ успешного логина админ-панели. Сам JWT передаётся только в httpOnly
 * cookie; expiresAt (epoch ms) — для отображения в UI.
 */
export const adminLoginResponseSchema = z
  .object({
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type AdminLoginResponse = z.infer<typeof adminLoginResponseSchema>;

/**
 * Состояние сессии админ-панели. Endpoint всегда отвечает 200:
 * фронт не может прочитать httpOnly cookie и опрашивает этот ресурс.
 */
export const adminSessionResponseSchema = z
  .object({
    authenticated: z.boolean(),
    expiresAt: z.number().int().positive().nullable(),
  })
  .strict();

export type AdminSessionResponse = z.infer<typeof adminSessionResponseSchema>;

// ─── Dashboard ──────────────────────────────────────────────────────────────
export const adminDashboardDtoSchema = z
  .object({
    totalUsers: z.number().int().nonnegative(),
    totalTrips: z.number().int().nonnegative(),
    activeTrips: z.number().int().nonnegative(),
    totalBookings: z.number().int().nonnegative(),
    totalReviews: z.number().int().nonnegative(),
    newUsersLast7Days: z.number().int().nonnegative(),
  })
  .strict();

export type AdminDashboardDto = z.infer<typeof adminDashboardDtoSchema>;

// ─── User ───────────────────────────────────────────────────────────────────
export const adminUserDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    avatar: z.string(),
    rating: z.number(),
    tripsCount: z.number().int().nonnegative(),
    reviewsCount: z.number().int().nonnegative(),
    isVerified: z.boolean(),
    bannedAt: z.string().datetime().nullable(),
    banReason: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AdminUserDto = z.infer<typeof adminUserDtoSchema>;

// ─── Trip ───────────────────────────────────────────────────────────────────
export const adminTripDtoSchema = z
  .object({
    id: z.string(),
    fromCity: z.string(),
    toCity: z.string(),
    fromAddress: z.string(),
    toAddress: z.string(),
    price: z.number().int(),
    seatsTotal: z.number().int(),
    seatsAvailable: z.number().int(),
    status: z.string(),
    departureAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    driverName: z.string(),
    driverId: z.string(),
  })
  .strict();

export type AdminTripDto = z.infer<typeof adminTripDtoSchema>;

// ─── Booking ────────────────────────────────────────────────────────────────
export const adminBookingDtoSchema = z
  .object({
    id: z.string(),
    seat: z.number().int(),
    status: z.string(),
    createdAt: z.string().datetime(),
    tripId: z.string(),
    tripRoute: z.string(),
    passengerId: z.string(),
    passengerName: z.string(),
  })
  .strict();

export type AdminBookingDto = z.infer<typeof adminBookingDtoSchema>;

// ─── Review ─────────────────────────────────────────────────────────────────
export const adminReviewDtoSchema = z
  .object({
    id: z.string(),
    rating: z.number().int(),
    text: z.string(),
    targetRole: z.string(),
    status: z.enum(REVIEW_STATUSES),
    tripRoute: z.string(),
    createdAt: z.string().datetime(),
    authorId: z.string(),
    authorName: z.string(),
    targetUserId: z.string(),
    targetUserName: z.string(),
  })
  .strict();

export type AdminReviewDto = z.infer<typeof adminReviewDtoSchema>;

// ─── Feedback ───────────────────────────────────────────────────────────────
export const adminFeedbackDtoSchema = z
  .object({
    id: z.string(),
    subject: z.string(),
    text: z.string(),
    // Ответ админа (null = ещё не отвечено).
    reply: z.string().nullable(),
    repliedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    userId: z.string(),
    userName: z.string(),
  })
  .strict();

export type AdminFeedbackDto = z.infer<typeof adminFeedbackDtoSchema>;

// ─── Settings ───────────────────────────────────────────────────────────────
/**
 * Read-only snapshot of the current env-driven rate limits and feature flags.
 * The admin panel displays these; there is no backing DB table for MVP.
 */
export const adminSettingsDtoSchema = z
  .object({
    createTripRateMax: z.number().int(),
    cancelTripRateMax: z.number().int(),
    createBookingRateMax: z.number().int(),
    cancelBookingRateMax: z.number().int(),
    publicReadRateMax: z.number().int(),
    mutationRateMax: z.number().int(),
    allowDevAuth: z.boolean(),
    isProduction: z.boolean(),
    trustProxy: z.boolean(),
  })
  .strict();

export type AdminSettingsDto = z.infer<typeof adminSettingsDtoSchema>;

// ─── Paginated Wrapper ──────────────────────────────────────────────────────
/**
 * Wraps a list of items with offset-pagination metadata. Generic over the item
 * schema so each admin list endpoint gets a concrete, fully-typed page DTO.
 */
export const adminPaginatedSchema = <T extends z.ZodType>(item: T) =>
  z
    .object({
      items: z.array(item),
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
    })
    .strict();

export const adminPaginatedUsersSchema = adminPaginatedSchema(adminUserDtoSchema);
export type AdminPaginatedUsers = z.infer<typeof adminPaginatedUsersSchema>;

export const adminPaginatedTripsSchema = adminPaginatedSchema(adminTripDtoSchema);
export type AdminPaginatedTrips = z.infer<typeof adminPaginatedTripsSchema>;

export const adminPaginatedBookingsSchema = adminPaginatedSchema(adminBookingDtoSchema);
export type AdminPaginatedBookings = z.infer<typeof adminPaginatedBookingsSchema>;

export const adminPaginatedReviewsSchema = adminPaginatedSchema(adminReviewDtoSchema);
export type AdminPaginatedReviews = z.infer<typeof adminPaginatedReviewsSchema>;

export const adminPaginatedFeedbackSchema = adminPaginatedSchema(adminFeedbackDtoSchema);
export type AdminPaginatedFeedback = z.infer<typeof adminPaginatedFeedbackSchema>;
