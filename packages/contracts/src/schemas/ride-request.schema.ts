import { z } from "zod";
import { MAX_SEATS } from "./trip.schema.js";
import { cityDtoSchema } from "./city.schema.js";

export const RIDE_REQUEST_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  FULFILLED: "fulfilled",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export const rideRequestStatusSchema = z.enum([
  "active",
  "paused",
  "fulfilled",
  "expired",
  "cancelled",
]);
export type RideRequestStatus = z.infer<typeof rideRequestStatusSchema>;

export const rideRequestSchema = z.object({
  id: z.string().uuid(),
  fromCity: cityDtoSchema,
  toCity: cityDtoSchema,
  earliestAt: z.string().datetime(),
  latestAt: z.string().datetime(),
  seats: z.number().int().min(1).max(MAX_SEATS),
  status: rideRequestStatusSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RideRequest = z.infer<typeof rideRequestSchema>;
