import { apiDelete, apiGet, apiPatch } from "@/lib/api-client";
import {
  adminPaginatedReviewsSchema,
  adminReviewDtoSchema,
  type AdminPaginatedReviews,
  type AdminReviewDto,
  type ReviewStatusValue,
} from "@edem/contracts";
import { z } from "zod";

const deleteReviewResponseSchema = z.object({ ok: z.boolean(), id: z.string() }).strict();

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
  return apiGet(`/reviews?${search.toString()}`, adminPaginatedReviewsSchema);
}

/**
 * DELETE /api/v1/admin/reviews/:id — безвозвратное удаление отзыва.
 */
export function deleteReview(id: string): Promise<{ ok: boolean; id: string }> {
  return apiDelete(`/reviews/${encodeURIComponent(id)}`, deleteReviewResponseSchema);
}

/**
 * PATCH /api/v1/admin/reviews/:id/approve — одобрение (pending → published).
 * Отзыв становится публичным и начинает учитываться в рейтинге.
 * 409 CONFLICT, если отзыв уже не в статусе pending.
 */
export function approveReview(id: string): Promise<AdminReviewDto> {
  return apiPatch(`/reviews/${encodeURIComponent(id)}/approve`, undefined, adminReviewDtoSchema);
}

/**
 * PATCH /api/v1/admin/reviews/:id/reject — отклонение (pending → rejected).
 * Отзыв скрывается из публичного списка, рейтинг не меняется.
 * 409 CONFLICT, если отзыв уже не в статусе pending.
 */
export function rejectReview(id: string): Promise<AdminReviewDto> {
  return apiPatch(`/reviews/${encodeURIComponent(id)}/reject`, undefined, adminReviewDtoSchema);
}
