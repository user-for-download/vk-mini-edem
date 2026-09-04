import { apiDelete, apiGet, apiPatch } from "@/lib/api-client";
import type {
  AdminPaginatedReviews,
  AdminReviewDto,
  ReviewStatusValue,
} from "@edem/contracts";

export interface FetchReviewsParams {
  status?: ReviewStatusValue;
  page: number;
  pageSize: number;
}

/**
 * GET /api/v1/admin/reviews?status=&page=&pageSize=
 * status — необязательный фильтр по статусу (pending/published/rejected).
 */
export function fetchReviews(
  params: FetchReviewsParams
): Promise<AdminPaginatedReviews> {
  const search = new URLSearchParams();
  if (params.status) {
    search.set("status", params.status);
  }
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  return apiGet(`/reviews?${search.toString()}`);
}

/**
 * DELETE /api/v1/admin/reviews/:id — безвозвратное удаление отзыва.
 */
export function deleteReview(id: string): Promise<{ ok: boolean; id: string }> {
  return apiDelete(`/reviews/${id}`);
}

/**
 * PATCH /api/v1/admin/reviews/:id/approve — одобрение (pending → published).
 * Отзыв становится публичным и начинает учитываться в рейтинге.
 * 409 CONFLICT, если отзыв уже не в статусе pending.
 */
export function approveReview(id: string): Promise<AdminReviewDto> {
  return apiPatch(`/reviews/${id}/approve`);
}

/**
 * PATCH /api/v1/admin/reviews/:id/reject — отклонение (pending → rejected).
 * Отзыв скрывается из публичного списка, рейтинг не меняется.
 * 409 CONFLICT, если отзыв уже не в статусе pending.
 */
export function rejectReview(id: string): Promise<AdminReviewDto> {
  return apiPatch(`/reviews/${id}/reject`);
}
