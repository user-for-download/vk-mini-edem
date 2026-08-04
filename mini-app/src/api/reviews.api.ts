import { apiClient } from "./client";
import type { Review, CreateReviewDto, Trip } from "@edem/contracts";

export type MyReview = Review & {
  tripId?: string;
};

export const reviewsApi = {
  getUserReviews: (userId: string): Promise<Review[]> => {
    return apiClient.request<Review[]>(`/reviews/user/${userId}`);
  },

  createReview: (data: CreateReviewDto): Promise<Review> => {
    return apiClient.request<Review>("/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getMyReviews: (): Promise<MyReview[]> => {
    return apiClient.request<MyReview[]>("/reviews/my");
  },

  getAvailableTrips: (): Promise<Trip[]> => {
    return apiClient.request<Trip[]>("/reviews/available-trips");
  },
};
