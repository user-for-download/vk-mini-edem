import { apiGet, apiPatch } from "@/lib/api-client";
import {
  type AdminReportsQuery,
  type Report,
  reportSchema,
  type UpdateReportStatusDto,
} from "@edem/contracts";
import { z } from "zod";

export type AdminReportStatus = Report["status"];

export type AdminReport = Report & {
  reporterId: string;
  reporterName: string;
  adminActorId: string | null;
  adminActorName: string | null;
};

export type AdminReportsResponse = {
  items: AdminReport[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

const adminReportSchema = reportSchema.extend({
  reporterId: z.string(),
  reporterName: z.string(),
  adminActorId: z.string().nullable(),
  adminActorType: z.string().nullable(),
  adminActorName: z.string().nullable(),
});

const adminReportsResponseSchema = z.object({
  items: z.array(adminReportSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
});

export function fetchReports(
  params: AdminReportsQuery,
): Promise<AdminReportsResponse> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.status) search.set("status", params.status);
  if (params.targetType) search.set("targetType", params.targetType);
  return apiGet(`/reports?${search.toString()}`, adminReportsResponseSchema);
}

export function updateReportStatus(
  id: string,
  data: UpdateReportStatusDto,
): Promise<AdminReport> {
  return apiPatch(
    `/reports/${encodeURIComponent(id)}/status`,
    data,
    adminReportSchema,
  );
}
