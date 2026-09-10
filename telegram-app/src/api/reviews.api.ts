import { z } from "zod";
import {
  paginatedReviewsResponseSchema,
  reviewSchema,
  tripSchema,
  type CreateReviewDto,
  type PaginatedReviewsResponse,
  type Review,
  type Trip,
} from "@edem/contracts";
import { apiClient } from "./client";

export type MyReview = Review & { tripId?: string };

const myReviewsSchema = z.array(
  reviewSchema.extend({ tripId: z.string().optional() }),
);
const tripsSchema = z.array(tripSchema);

export const reviewsApi = {
  getUserReviews: (
    userId: string,
    cursor?: string,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<PaginatedReviewsResponse> => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set("cursor", cursor);

    return apiClient.request(
      `/reviews/user/${encodeURIComponent(userId)}?${query.toString()}`,
      { signal },
      paginatedReviewsResponseSchema,
    );
  },

  createReview: (data: CreateReviewDto): Promise<Review> =>
    apiClient.request(
      "/reviews",
      { method: "POST", body: JSON.stringify(data) },
      reviewSchema,
    ),

  getMyReviews: (signal?: AbortSignal): Promise<MyReview[]> =>
    apiClient.request("/reviews/my", { signal }, myReviewsSchema),

  getAvailableTrips: (signal?: AbortSignal): Promise<Trip[]> =>
    apiClient.request(
      "/reviews/available-trips",
      { signal },
      tripsSchema,
    ),
};
