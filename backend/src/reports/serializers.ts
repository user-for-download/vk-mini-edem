import type { Prisma } from "../generated/prisma/client.js";

export type ReportWithRelations = Prisma.ReportGetPayload<{
  include: { reporter: true; adminActor: true };
}>;

export function serializeReport(report: ReportWithRelations) {
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    category: report.category,
    description: report.description,
    status: report.status,
    resolutionNote: report.resolutionNote,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
  };
}

export function serializeAdminReport(report: ReportWithRelations) {
  return {
    ...serializeReport(report),
    reporterId: report.reporterId,
    reporterName: report.reporter.name,
    adminActorId: report.adminActorId,
    adminActorName: report.adminActor?.name ?? null,
  };
}
