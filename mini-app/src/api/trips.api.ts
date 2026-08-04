// mini-app/src/api/trips.api.ts
import { apiClient } from "./client";
import type { Trip, CreateTripDto, TripFiltersDto } from "@edem/contracts";

export type SearchTripsFilters = TripFiltersDto & {
  q?: string;
  tags?: string[];
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type UpdateTripDto = Partial<CreateTripDto>;

export interface PaginatedTripsResponse {
  items: Trip[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

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

    return apiClient.request<PaginatedTripsResponse>(`/trips${queryString}`);
  },

  updateTrip: (id: string, data: UpdateTripDto): Promise<Trip> => {
    return apiClient.request<Trip>(`/trips/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getMyTrips: (options?: { page?: number; limit?: number }): Promise<PaginatedTripsResponse> => {
    const query = new URLSearchParams();
    if (options?.page) query.set("page", options.page.toString());
    if (options?.limit) query.set("limit", options.limit.toString());
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiClient.request<PaginatedTripsResponse>(`/trips/my${queryString}`);
  },

  getTripById: (id: string): Promise<Trip> => {
    return apiClient.request<Trip>(`/trips/${id}`);
  },

  createTrip: (data: CreateTripDto): Promise<Trip> => {
    return apiClient.request<Trip>("/trips", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  cancelTrip: (id: string): Promise<Trip> => {
    return apiClient.request<Trip>(`/trips/${id}/cancel`, {
      method: "PATCH",
    });
  },

  completeTrip: (id: string): Promise<Trip> => {
    return apiClient.request<Trip>(`/trips/${id}/complete`, {
      method: "PATCH",
    });
  },
};
