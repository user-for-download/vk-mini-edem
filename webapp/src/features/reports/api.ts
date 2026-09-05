import { apiGet, apiPatch } from "@/lib/api-client";
import type { AdminReportsQuery, UpdateReportStatusDto } from "@edem/contracts";

export type AdminReport = {
  id: string;
  targetType: string;
  targetId: string;
  category: string;
  description: string;
  status: string;
  resolutionNote: string | null;
  reporterId: string;
  reporterName: string;
  adminActorId: string | null;
  adminActorName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type AdminReportsResponse = {
  items: AdminReport[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean };
};

export function fetchReports(params: AdminReportsQuery): Promise<AdminReportsResponse> {
  const search = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.status) search.set("status", params.status);
  if (params.targetType) search.set("targetType", params.targetType);
  return apiGet(`/reports?${search.toString()}`);
}

export function updateReportStatus(id: string, data: UpdateReportStatusDto): Promise<AdminReport> {
  return apiPatch(`/reports/${encodeURIComponent(id)}/status`, data);
}
