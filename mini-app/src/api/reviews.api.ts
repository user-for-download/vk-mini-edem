import { apiClient } from "./client";
import { reviewSchema, tripSchema } from "@edem/contracts";
import { z } from "zod";
import type { Review, CreateReviewDto, Trip } from "@edem/contracts";

export type MyReview = Review & {
  tripId?: string;
};

const reviewArraySchema = z.array(reviewSchema);
const tripArraySchema = z.array(tripSchema);
const myReviewSchema = reviewSchema.extend({ tripId: z.string().optional() });
const myReviewArraySchema = z.array(myReviewSchema);

export const reviewsApi = {
  getUserReviews: (userId: string): Promise<Review[]> => {
    return apiClient.request<Review[]>(`/reviews/user/${userId}`, {}, reviewArraySchema);
  },

  createReview: (data: CreateReviewDto): Promise<Review> => {
    return apiClient.request<Review>("/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }, reviewSchema);
  },

  getMyReviews: (): Promise<MyReview[]> => {
    return apiClient.request<MyReview[]>("/reviews/my", {}, myReviewArraySchema);
  },

  getAvailableTrips: (): Promise<Trip[]> => {
    return apiClient.request<Trip[]>("/reviews/available-trips", {}, tripArraySchema);
  },
};
