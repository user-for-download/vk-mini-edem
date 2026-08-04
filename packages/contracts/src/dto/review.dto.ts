import { z } from "zod";

// ─── CreateReviewDto ────────────────────────────────────────────────────────
export const createReviewDtoSchema = z.object({
  tripId: z.string(),
  targetUserId: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(1000),
});

export type CreateReviewDto = z.infer<typeof createReviewDtoSchema>;
