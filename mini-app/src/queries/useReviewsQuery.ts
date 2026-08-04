// mini-app/src/queries/useReviewsQuery.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewsApi } from "../api/reviews.api";
import { USER_KEYS } from "./useUsersQuery";
import type { CreateReviewDto } from "@edem/contracts";
import type { Review, Trip } from "@/types";

export const REVIEW_KEYS = {
  all: ["reviews"] as const,
  user: (userId: string) => [...REVIEW_KEYS.all, "user", userId] as const,
  my: () => [...REVIEW_KEYS.all, "my"] as const,
  availableTrips: () => [...REVIEW_KEYS.all, "available-trips"] as const,
};

/**
 * Отзывы, оставленные текущим пользователем.
 */
export function useMyReviewsQuery() {
  return useQuery({
    queryKey: REVIEW_KEYS.my(),
    queryFn: () => reviewsApi.getMyReviews(),
  });
}

/**
 * Отзывы о конкретном пользователе.
 */
export function useUserReviewsQuery(userId: string) {
  return useQuery({
    queryKey: REVIEW_KEYS.user(userId),
    queryFn: async () => {
      const res = await reviewsApi.getUserReviews(userId);
      return res as unknown as Review[];
    },
    enabled: Boolean(userId),
  });
}

/**
 * Поездки, доступные текущему пользователю для отзыва.
 */
export function useAvailableReviewTripsQuery() {
  return useQuery({
    queryKey: REVIEW_KEYS.availableTrips(),
    queryFn: async () => {
      const res = await reviewsApi.getAvailableTrips();
      return res as unknown as Trip[];
    },
  });
}

/**
 * Создание отзыва.
 */
export function useCreateReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReviewDto) => reviewsApi.createReview(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: REVIEW_KEYS.availableTrips(),
      });
      queryClient.invalidateQueries({
        queryKey: REVIEW_KEYS.user(variables.targetUserId),
      });
      queryClient.invalidateQueries({
        queryKey: REVIEW_KEYS.all,
      });
      queryClient.invalidateQueries({
        queryKey: USER_KEYS.detail(variables.targetUserId),
      });
      queryClient.invalidateQueries({
        queryKey: USER_KEYS.all,
      });
      queryClient.invalidateQueries({
        queryKey: ["trips"],
      });
      queryClient.invalidateQueries({
        queryKey: ["bookings"],
      });
    },
  });
}
