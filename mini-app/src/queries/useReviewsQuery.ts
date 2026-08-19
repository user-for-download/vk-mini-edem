// mini-app/src/queries/useReviewsQuery.ts
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewsApi } from "../api/reviews.api";
import { USER_KEYS } from "./useUsersQuery";
import type { CreateReviewDto } from "@edem/contracts";

export const REVIEW_KEYS = {
  all: ["reviews"] as const,
  user: (userId: string) => [...REVIEW_KEYS.all, "user", userId] as const,
  userPaginated: (userId: string, limit: number) =>
    [...REVIEW_KEYS.user(userId), "paginated", limit] as const,
  my: () => [...REVIEW_KEYS.all, "my"] as const,
  availableTrips: () => [...REVIEW_KEYS.all, "available-trips"] as const,
};

/**
 * Отзывы, оставленные текущим пользователем.
 */
export function useMyReviewsQuery() {
  return useQuery({
    queryKey: REVIEW_KEYS.my(),
    queryFn: ({ signal }) => reviewsApi.getMyReviews(signal),
  });
}

/**
 * Отзывы о конкретном пользователе (первая страница).
 * Используется там, где достаточно первых отзывов (ProfilePanel).
 */
export function useUserReviewsQuery(userId: string) {
  return useQuery({
    queryKey: REVIEW_KEYS.user(userId),
    queryFn: async ({ signal }) => {
      const res = await reviewsApi.getUserReviews(userId, undefined, 20, signal);
      return res.items;
    },
    enabled: Boolean(userId),
  });
}

/**
 * Отзывы о пользователе с бесконечной прокруткой (cursor-based).
 * Используется в DriverProfileModal с кнопкой «Показать ещё».
 */
export function useUserReviewsInfiniteQuery(userId: string, limit = 20) {
  return useInfiniteQuery({
    queryKey: REVIEW_KEYS.userPaginated(userId, limit),
    queryFn: ({ pageParam, signal }) =>
      reviewsApi.getUserReviews(userId, pageParam as string | undefined, limit, signal),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: Boolean(userId),
    staleTime: 60_000, // 1 минута
  });
}

/**
 * Поездки, доступные текущему пользователю для отзыва.
 */
export function useAvailableReviewTripsQuery() {
  return useQuery({
    queryKey: REVIEW_KEYS.availableTrips(),
    queryFn: ({ signal }) => reviewsApi.getAvailableTrips(signal),
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
      // Префикс-инвалидация покрывает и user, и userPaginated (infinite) кэши.
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
