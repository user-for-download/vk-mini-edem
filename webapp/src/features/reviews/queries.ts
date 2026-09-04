import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReviewStatusValue } from "@edem/contracts";
import { toast } from "sonner";

import { approveReview, deleteReview, fetchReviews, rejectReview } from "./api";

export interface ReviewsQueryParams {
  status?: ReviewStatusValue;
  page: number;
  pageSize: number;
}

const reviewsKey = (p: ReviewsQueryParams) => ["admin", "reviews", p] as const;

export function useReviewsQuery(params: ReviewsQueryParams) {
  return useQuery({
    queryKey: reviewsKey(params),
    queryFn: () => fetchReviews(params),
  });
}

export function useDeleteReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      // Удаление отзыва влияет и на список, и на метрики дашборда — инвалидируем оба кэша.
      void queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success("Отзыв удалён");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить отзыв"
      );
    },
  });
}

export function useApproveReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveReview(id),
    onSuccess: () => {
      // Публикация меняет состав списка и метрики дашборда — инвалидируем оба кэша.
      void queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success("Отзыв опубликован");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось опубликовать отзыв"
      );
    },
  });
}

export function useRejectReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rejectReview(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success("Отзыв отклонён");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось отклонить отзыв"
      );
    },
  });
}
