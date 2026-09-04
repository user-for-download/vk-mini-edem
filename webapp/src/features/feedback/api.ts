import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import type { AdminFeedbackDto, AdminPaginatedFeedback } from "@edem/contracts";

export interface FetchFeedbackParams {
  page: number;
  pageSize: number;
}

/**
 * GET /api/v1/admin/feedback?page=&pageSize=
 */
export function fetchFeedback(
  params: FetchFeedbackParams
): Promise<AdminPaginatedFeedback> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  return apiGet(`/feedback?${search.toString()}`);
}

/**
 * GET /api/v1/admin/feedback/:id — детальная карточка обращения.
 */
export function fetchFeedbackById(id: string): Promise<AdminFeedbackDto> {
  return apiGet<AdminFeedbackDto>(`/feedback/${encodeURIComponent(id)}`);
}

/**
 * POST /api/v1/admin/feedback/:id/reply — первичный ответ админа.
 */
export function createFeedbackReply(
  id: string,
  reply: string
): Promise<AdminFeedbackDto> {
  return apiPost<AdminFeedbackDto>(
    `/feedback/${encodeURIComponent(id)}/reply`,
    { reply },
  );
}

/**
 * PUT /api/v1/admin/feedback/:id/reply — редактирование существующего ответа.
 */
export function updateFeedbackReply(
  id: string,
  reply: string
): Promise<AdminFeedbackDto> {
  return apiPut<AdminFeedbackDto>(
    `/feedback/${encodeURIComponent(id)}/reply`,
    { reply },
  );
}
