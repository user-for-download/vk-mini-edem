import { z } from "zod";

export const REPORT_CATEGORIES = [
  "safety",
  "fraud",
  "harassment",
  "spam",
  "inaccurate_info",
  "other",
] as const;

export const REPORT_TARGET_TYPES = ["user", "trip", "booking"] as const;
export const REPORT_STATUSES = ["pending", "in_review", "resolved", "rejected"] as const;

export const reportCategorySchema = z.enum(REPORT_CATEGORIES);
export const reportTargetTypeSchema = z.enum(REPORT_TARGET_TYPES);
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export const reportSchema = z.object({
  id: z.string().uuid(),
  targetType: reportTargetTypeSchema,
  targetId: z.string().uuid(),
  category: reportCategorySchema,
  description: z.string().min(1).max(2000),
  status: reportStatusSchema,
  resolutionNote: z.string().max(2000).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});

export type Report = z.infer<typeof reportSchema>;
