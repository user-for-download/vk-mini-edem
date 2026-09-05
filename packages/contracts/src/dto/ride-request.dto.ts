import { z } from "zod";
import { MAX_SEATS } from "../schemas/trip.schema.js";
import { rideRequestStatusSchema } from "../schemas/ride-request.schema.js";

const dateTime = z.string().datetime();

export const createRideRequestDtoSchema = z.object({
  fromCityId: z.string().uuid(),
  toCityId: z.string().uuid(),
  earliestAt: dateTime,
  latestAt: dateTime,
  seats: z.number().int().min(1).max(MAX_SEATS).default(1),
  expiresAt: dateTime,
}).superRefine((data, ctx) => {
  if (data.fromCityId === data.toCityId) {
    ctx.addIssue({ code: "custom", path: ["toCityId"], message: "Cities must be different" });
  }
  if (new Date(data.earliestAt) >= new Date(data.latestAt)) {
    ctx.addIssue({ code: "custom", path: ["latestAt"], message: "latestAt must be after earliestAt" });
  }
  if (new Date(data.expiresAt) <= new Date()) {
    ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "expiresAt must be in the future" });
  }
});
export type CreateRideRequestDto = z.infer<typeof createRideRequestDtoSchema>;

export const updateRideRequestDtoSchema = z.object({
  earliestAt: dateTime.optional(),
  latestAt: dateTime.optional(),
  seats: z.number().int().min(1).max(MAX_SEATS).optional(),
  expiresAt: dateTime.optional(),
}).strict();
export type UpdateRideRequestDto = z.infer<typeof updateRideRequestDtoSchema>;

export const rideRequestStatusUpdateSchema = z.object({
  status: rideRequestStatusSchema.extract(["active", "paused", "fulfilled", "cancelled"]),
}).strict();

export const rideRequestListQuerySchema = z.object({
  status: rideRequestStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
