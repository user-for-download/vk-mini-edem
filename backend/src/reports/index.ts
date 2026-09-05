import { Hono } from "hono";
import { Prisma } from "../generated/prisma/client.js";
import { createReportDtoSchema, adminReportsQuerySchema, updateReportStatusDtoSchema } from "@edem/contracts";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { getSanitizedBody, sanitizeValue } from "../middleware/sanitize.js";
import { mutationLimiter, createUserRateLimiter, createRateLimiter, adminReadLimiter } from "../middleware/rateLimit.js";
import { ERROR_CODES } from "../errors.js";
import { adminGuard } from "../admin/guard.js";
import { serializeAdminReport, serializeReport } from "./serializers.js";

const reportLimiter = createUserRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "report-create" });
const reportReadLimiter = createUserRateLimiter({ windowMs: 60_000, max: 60, keyPrefix: "report-read" });
const reportAdminMutationLimiter = createRateLimiter({ windowMs: 60_000, max: 60, keyPrefix: "report-admin-mutation" });
const includeRelations = { reporter: true, adminActor: true } as const;

export const reportsRouter = new Hono<AuthEnv>();
reportsRouter.use("*", requireUser);

async function canReport(userId: string, targetType: string, targetId: string): Promise<boolean> {
  if (targetType === "user") {
    if (targetId === userId) return false;
    const relationship = await db.booking.findFirst({ where: { OR: [{ passengerId: userId, trip: { driverId: targetId } }, { passengerId: targetId, trip: { driverId: userId } }] }, select: { id: true } });
    return Boolean(relationship);
  }
  if (targetType === "trip") {
    return Boolean(await db.trip.findFirst({ where: { id: targetId, OR: [{ driverId: userId }, { bookings: { some: { passengerId: userId } } }] }, select: { id: true } }));
  }
  if (targetType === "booking") {
    return Boolean(await db.booking.findFirst({ where: { id: targetId, OR: [{ passengerId: userId }, { trip: { driverId: userId } }] }, select: { id: true } }));
  }
  return false;
}

reportsRouter.get("/", reportReadLimiter, async (c) => {
  const userId = c.get("user").id;
  const items = await db.report.findMany({ where: { reporterId: userId }, include: includeRelations, orderBy: { createdAt: "desc" } });
  return c.json(items.map(serializeReport));
});

reportsRouter.post("/", mutationLimiter, reportLimiter, async (c) => {
  const parsed = createReportDtoSchema.safeParse(await getSanitizedBody(c));
  if (!parsed.success) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid report payload" }, 400);
  const { targetType, targetId, category, description } = parsed.data;
  const userId = c.get("user").id;
  if (!(await canReport(userId, targetType, targetId))) return c.json({ code: ERROR_CODES.FORBIDDEN, message: "Report is not allowed in this context" }, 403);
  let item;
  try {
    item = await db.$transaction(async (tx) => {
    const duplicate = await tx.report.findFirst({ where: { reporterId: userId, targetType, targetId, category, status: { in: ["pending", "in_review"] } }, select: { id: true } });
    if (duplicate) return null;
    return tx.report.create({ data: { reporterId: userId, targetType, targetId, category, description }, include: includeRelations });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      return c.json({ code: ERROR_CODES.CONFLICT, message: "An open report already exists" }, 409);
    }
    throw error;
  }
  if (!item) return c.json({ code: ERROR_CODES.CONFLICT, message: "An open report already exists" }, 409);
  return c.json(serializeReport(item), 201);
});

export const adminReportsRouter = new Hono();
adminReportsRouter.use("*", adminGuard);
adminReportsRouter.get("/", adminReadLimiter, async (c) => {
  const parsed = adminReportsQuerySchema.safeParse(sanitizeValue(c.req.query()));
  if (!parsed.success) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid query" }, 400);
  const { status, targetType, page, pageSize } = parsed.data;
  const where = { ...(status ? { status } : {}), ...(targetType ? { targetType } : {}) };
  const [items, total] = await Promise.all([
    db.report.findMany({ where, include: includeRelations, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.report.count({ where }),
  ]);
  return c.json({ items: items.map(serializeAdminReport), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total } });
});

adminReportsRouter.get("/:id", adminReadLimiter, async (c) => {
  const item = await db.report.findUnique({ where: { id: c.req.param("id") }, include: includeRelations });
  if (!item) return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Report not found" }, 404);
  return c.json(serializeAdminReport(item));
});

adminReportsRouter.patch("/:id/status", reportAdminMutationLimiter, async (c) => {
  const id = c.req.param("id");
  const parsed = updateReportStatusDtoSchema.safeParse(await getSanitizedBody(c));
  if (!parsed.success) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid report status payload" }, 400);
  const current = await db.report.findUnique({ where: { id }, select: { status: true } });
  if (!current) return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Report not found" }, 404);
  if (current.status === "resolved" || current.status === "rejected") return c.json({ code: ERROR_CODES.CONFLICT, message: "Report is already terminal" }, 409);
  const item = await db.report.updateMany({ where: { id, status: { in: ["pending", "in_review"] } }, data: { status: parsed.data.status, resolutionNote: parsed.data.resolutionNote, resolvedAt: parsed.data.status === "resolved" || parsed.data.status === "rejected" ? new Date() : null, adminActorId: null, adminActorType: "admin" } });
  if (item.count !== 1) return c.json({ code: ERROR_CODES.CONFLICT, message: "Report was just changed" }, 409);
  const updated = await db.report.findUnique({ where: { id }, include: includeRelations });
  if (!updated) return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Report not found" }, 404);
  return c.json(serializeAdminReport(updated));
});
