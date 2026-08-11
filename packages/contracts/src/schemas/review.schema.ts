import { z } from "zod";
import { userSchema, roleSchema } from "./user.schema.js";
import { cursorPaginationSchema } from "./common.schema.js";

export const reviewSchema = z.object({
  id: z.string(),
  author: userSchema,
  targetRole: roleSchema,
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(1000),
  date: z.string(),
  tripRoute: z.string(),
});

export type Review = z.infer<typeof reviewSchema>;

export const paginatedReviewsResponseSchema = z.object({
  items: z.array(reviewSchema),
  pagination: cursorPaginationSchema,
});

export type PaginatedReviewsResponse = z.infer<typeof paginatedReviewsResponseSchema>;
