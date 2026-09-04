import { z } from "zod";
import { userSchema, roleSchema } from "./user.schema.js";
import { cursorPaginationSchema } from "./common.schema.js";
import { REVIEW_STATUSES } from "./status.const.js";

export const reviewSchema = z.object({
  id: z.string(),
  author: userSchema,
  targetRole: roleSchema,
  rating: z.number().int().min(1).max(5),
  // text остаётся max(1000) сознательно: read-схема терпимая и неблокирующая
  // (fail-closed) для существующих отзывов; лимит 150 enforced на запись
  // через createReviewDtoSchema (REVIEW_TEXT_MAX_LENGTH).
  text: z.string().min(1).max(1000),
  status: z.enum(REVIEW_STATUSES),
  date: z.string(),
  tripRoute: z.string(),
});

export type Review = z.infer<typeof reviewSchema>;

export const paginatedReviewsResponseSchema = z.object({
  items: z.array(reviewSchema),
  pagination: cursorPaginationSchema,
});

export type PaginatedReviewsResponse = z.infer<typeof paginatedReviewsResponseSchema>;
