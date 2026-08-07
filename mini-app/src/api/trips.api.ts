// mini-app/src/api/trips.api.ts
import { apiClient } from "./client";
import {
  paginatedTripsResponseSchema,
  tripSchema,
  type Trip,
  type CreateTripDto,
  type TripFiltersDto,
  type PaginatedTripsResponse,
} from "@edem/contracts";

export type SearchTripsFilters = TripFiltersDto & {
  q?: string;
  tags?: string[];
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type UpdateTripDto = Partial<CreateTripDto>;

export type MyTrip = Trip & {
  bookedSeats?: number[];
  pendingRequestsCount?: number;
};

export const tripsApi = {
  getTrips: (filters?: SearchTripsFilters): Promise<PaginatedTripsResponse> => {
    const query = new URLSearchParams();

    if (filters?.q) query.set("q", filters.q);
    if (filters?.fromCity) query.set("fromCity", filters.fromCity);
    if (filters?.toCity) query.set("toCity", filters.toCity);
    if (filters?.dateFrom) query.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) query.set("dateTo", filters.dateTo);
    if (filters?.maxPrice) query.set("maxPrice", filters.maxPrice.toString());
    if (filters?.tags && filters.tags.length > 0) {
      query.set("tags", filters.tags.join(","));
    }
    if (filters?.page) query.set("page", filters.page.toString());
    if (filters?.limit) query.set("limit", filters.limit.toString());

    const queryString = query.toString() ? `?${query.toString()}` : "";

    return apiClient.request<PaginatedTripsResponse>(
      `/trips${queryString}`,
      {},
      paginatedTripsResponseSchema
    );
  },

  updateTrip: (id: string, data: UpdateTripDto): Promise<Trip> => {
    return apiClient.request<Trip>(
      `/trips/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      tripSchema
    );
  },

  getMyTrips: (options?: {
    page?: number;
    limit?: number;
    status?: "active" | "archive";
  }): Promise<PaginatedTripsResponse> => {
    const query = new URLSearchParams();
    if (options?.page) query.set("page", options.page.toString());
    if (options?.limit) query.set("limit", options.limit.toString());
    if (options?.status) query.set("status", options.status);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiClient.request<PaginatedTripsResponse>(
      `/trips/my${queryString}`,
      {},
      paginatedTripsResponseSchema
    );
  },

  getTripById: (id: string): Promise<Trip> => {
    return apiClient.request<Trip>(`/trips/${id}`, {}, tripSchema);
  },

  createTrip: (data: CreateTripDto): Promise<Trip> => {
    return apiClient.request<Trip>("/trips", {
      method: "POST",
      body: JSON.stringify(data),
    }, tripSchema);
  },

  cancelTrip: (id: string): Promise<Trip> => {
    return apiClient.request<Trip>(`/trips/${id}/cancel`, {
      method: "PATCH",
    }, tripSchema);
  },

  completeTrip: (id: string): Promise<Trip> => {
    return apiClient.request<Trip>(`/trips/${id}/complete`, {
      method: "PATCH",
    }, tripSchema);
  },
};
