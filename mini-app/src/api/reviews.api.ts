import { apiClient } from "./client";
import { reviewSchema, tripSchema, paginatedReviewsResponseSchema } from "@edem/contracts";
import { z } from "zod";
import type { Review, CreateReviewDto, Trip, PaginatedReviewsResponse } from "@edem/contracts";

export type MyReview = Review & {
  tripId?: string;
};

const tripArraySchema = z.array(tripSchema);
const myReviewSchema = reviewSchema.extend({ tripId: z.string().optional() });
const myReviewArraySchema = z.array(myReviewSchema);

export const reviewsApi = {
  /**
   * Отзывы о пользователе с cursor-based пагинацией.
   *
   * @param userId ID пользователя
   * @param cursor Опциональный cursor для следующей страницы
   * @param limit Количество элементов (1-50, default 20)
   */
  getUserReviews: (
    userId: string,
    cursor?: string,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<PaginatedReviewsResponse> => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    params.set("limit", String(limit));

    return apiClient.request<PaginatedReviewsResponse>(
      `/reviews/user/${encodeURIComponent(userId)}?${params.toString()}`,
      { signal },
      paginatedReviewsResponseSchema
    );
  },

  createReview: (data: CreateReviewDto): Promise<Review> => {
    return apiClient.request<Review>("/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }, reviewSchema);
  },

  getMyReviews: (signal?: AbortSignal): Promise<MyReview[]> => {
    return apiClient.request<MyReview[]>("/reviews/my", { signal }, myReviewArraySchema);
  },

  getAvailableTrips: (signal?: AbortSignal): Promise<Trip[]> => {
    return apiClient.request<Trip[]>("/reviews/available-trips", { signal }, tripArraySchema);
  },
};
