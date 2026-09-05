import { apiClient } from "./client";
import {
  rideRequestSchema,
  rideRequestListQuerySchema,
} from "@edem/contracts";
import type {
  CreateRideRequestDto,
  RideRequest,
  UpdateRideRequestDto,
} from "@edem/contracts";
import { z } from "zod";

const listSchema = z.object({
  items: z.array(rideRequestSchema),
  pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number(), hasMore: z.boolean() }),
});

export const rideRequestsApi = {
  list: (signal?: AbortSignal): Promise<RideRequest[]> =>
    apiClient.request("/ride-requests", { signal }, listSchema.transform((value) => value.items)),
  create: (data: CreateRideRequestDto): Promise<RideRequest> =>
    apiClient.request("/ride-requests", { method: "POST", body: JSON.stringify(data) }, rideRequestSchema),
  update: (id: string, data: UpdateRideRequestDto): Promise<RideRequest> =>
    apiClient.request(`/ride-requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }, rideRequestSchema),
  setStatus: (id: string, status: "active" | "paused" | "fulfilled" | "cancelled"): Promise<RideRequest> =>
    apiClient.request(`/ride-requests/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, rideRequestSchema),
  cancel: (id: string): Promise<RideRequest> =>
    apiClient.request(`/ride-requests/${encodeURIComponent(id)}`, { method: "DELETE" }, rideRequestSchema),
};

export { rideRequestListQuerySchema };
