import { z } from "zod";
import { reportCategorySchema, reportStatusSchema, reportTargetTypeSchema } from "../schemas/report.schema.js";

export const REPORT_DESCRIPTION_MAX_LENGTH = 2000;

export const createReportDtoSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  category: reportCategorySchema,
  description: z.string().trim().min(1).max(REPORT_DESCRIPTION_MAX_LENGTH),
}).strict();
export type CreateReportDto = z.infer<typeof createReportDtoSchema>;

export const adminReportsQuerySchema = z.object({
  status: reportStatusSchema.optional(),
  targetType: reportTargetTypeSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;

export const updateReportStatusDtoSchema = z.object({
  status: z.enum(["in_review", "resolved", "rejected"]),
  resolutionNote: z.string().trim().max(REPORT_DESCRIPTION_MAX_LENGTH).optional(),
}).strict();
export type UpdateReportStatusDto = z.infer<typeof updateReportStatusDtoSchema>;
