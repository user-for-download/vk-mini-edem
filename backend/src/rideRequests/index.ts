import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import {
  createRideRequestDtoSchema,
  rideRequestListQuerySchema,
  rideRequestStatusUpdateSchema,
  updateRideRequestDtoSchema,
} from "@edem/contracts";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { getSanitizedBody, sanitizeValue } from "../middleware/sanitize.js";
import { mutationLimiter, createUserRateLimiter } from "../middleware/rateLimit.js";
import { ERROR_CODES } from "../errors.js";
import { serializeRideRequest } from "./serializers.js";

const MAX_ACTIVE_REQUESTS = 3;
const rideRequestMutationLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyPrefix: "ride-request-mutation",
});

export const rideRequestsRouter = new Hono<AuthEnv>();
rideRequestsRouter.use("*", requireUser);

const includeCities = { fromCity: true, toCity: true } as const;

function invalidPayload(c: Context) {
  return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid payload" }, 400);
}

async function getOwnedRequest(id: string, userId: string) {
  return db.rideRequest.findFirst({ where: { id, userId }, include: includeCities });
}

rideRequestsRouter.get("/", async (c) => {
  const parsed = rideRequestListQuerySchema.safeParse(sanitizeValue(c.req.query()));
  if (!parsed.success) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid query" }, 400);

  const { status, page, limit } = parsed.data;
  const userId = c.get("user").id;
  const where = { userId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    db.rideRequest.findMany({ where, include: includeCities, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    db.rideRequest.count({ where }),
  ]);
  return c.json({ items: items.map(serializeRideRequest), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total } });
});

rideRequestsRouter.post("/", mutationLimiter, rideRequestMutationLimiter, async (c) => {
  const parsed = createRideRequestDtoSchema.safeParse(await getSanitizedBody(c));
  if (!parsed.success) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid payload", errors: z.formatError(parsed.error) }, 400);
  const userId = c.get("user").id;
  const data = parsed.data;
  const now = new Date();

  const activeCount = await db.rideRequest.count({ where: { userId, status: { in: ["active", "paused"] }, expiresAt: { gt: now } } });
  if (activeCount >= MAX_ACTIVE_REQUESTS) return c.json({ code: ERROR_CODES.CONFLICT, message: "Too many active ride requests" }, 409);
  const cities = await db.city.findMany({ where: { id: { in: [data.fromCityId, data.toCityId] } }, select: { id: true } });
  if (cities.length !== 2) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "City not found" }, 400);

  const item = await db.rideRequest.create({ data: { ...data, userId, earliestAt: new Date(data.earliestAt), latestAt: new Date(data.latestAt), expiresAt: new Date(data.expiresAt) }, include: includeCities });
  return c.json(serializeRideRequest(item), 201);
});

rideRequestsRouter.get("/matching", async (c) => {
  const fromCityId = c.req.query("fromCityId");
  const toCityId = c.req.query("toCityId");
  const earliestAt = c.req.query("earliestAt");
  const latestAt = c.req.query("latestAt");
  if (!fromCityId || !toCityId || !earliestAt || !latestAt || !z.string().uuid().safeParse(fromCityId).success || !z.string().uuid().safeParse(toCityId).success) {
    return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid matching query" }, 400);
  }
  const start = new Date(earliestAt);
  const end = new Date(latestAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid matching window" }, 400);
  const items = await db.rideRequest.findMany({ where: { userId: { not: c.get("user").id }, fromCityId, toCityId, status: "active", expiresAt: { gt: new Date() }, earliestAt: { lte: end }, latestAt: { gte: start } }, include: includeCities, orderBy: { createdAt: "desc" }, take: 50 });
  return c.json({ items: items.map(serializeRideRequest) });
});

rideRequestsRouter.patch("/:id", mutationLimiter, rideRequestMutationLimiter, async (c) => {
  const current = await getOwnedRequest(c.req.param("id"), c.get("user").id);
  if (!current) return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Ride request not found" }, 404);
  if (!["active", "paused"].includes(current.status)) return c.json({ code: ERROR_CODES.CONFLICT, message: "Ride request is terminal" }, 409);
  const parsed = updateRideRequestDtoSchema.safeParse(await getSanitizedBody(c));
  if (!parsed.success) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid payload" }, 400);
  const data = parsed.data;
  const earliestAt = data.earliestAt ? new Date(data.earliestAt) : current.earliestAt;
  const latestAt = data.latestAt ? new Date(data.latestAt) : current.latestAt;
  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : current.expiresAt;
  if (earliestAt >= latestAt || expiresAt <= new Date()) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid request window" }, 400);
  const item = await db.rideRequest.update({ where: { id: current.id }, data: { ...(data.seats === undefined ? {} : { seats: data.seats }), earliestAt, latestAt, expiresAt }, include: includeCities });
  return c.json(serializeRideRequest(item));
});

rideRequestsRouter.patch("/:id/status", mutationLimiter, rideRequestMutationLimiter, async (c) => {
  const current = await getOwnedRequest(c.req.param("id"), c.get("user").id);
  if (!current) return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Ride request not found" }, 404);
  const parsed = rideRequestStatusUpdateSchema.safeParse(await getSanitizedBody(c));
  if (!parsed.success) return c.json({ code: ERROR_CODES.VALIDATION_FAILED, message: "Invalid payload" }, 400);
  const next = parsed.data.status;
  if (!["active", "paused"].includes(current.status) || (next === "active" && current.expiresAt <= new Date())) return c.json({ code: ERROR_CODES.CONFLICT, message: "Invalid ride request transition" }, 409);
  const item = await db.rideRequest.update({ where: { id: current.id }, data: { status: next }, include: includeCities });
  return c.json(serializeRideRequest(item));
});

rideRequestsRouter.delete("/:id", mutationLimiter, rideRequestMutationLimiter, async (c) => {
  const current = await getOwnedRequest(c.req.param("id"), c.get("user").id);
  if (!current) return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Ride request not found" }, 404);
  if (current.status === "cancelled") return c.json(serializeRideRequest(current));
  const item = await db.rideRequest.update({ where: { id: current.id }, data: { status: "cancelled" }, include: includeCities });
  return c.json(serializeRideRequest(item));
});
