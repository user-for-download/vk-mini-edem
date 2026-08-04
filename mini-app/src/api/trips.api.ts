// mini-app/src/api/trips.api.ts
import { apiClient } from "./client";
import type { Trip, CreateTripDto, TripFiltersDto } from "@edem/contracts";

export type SearchTripsFilters = TripFiltersDto & {
  q?: string;
  page?: number;
  limit?: number;
};

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
    if (filters?.maxPrice) query.set("maxPrice", filters.maxPrice.toString());
    if (filters?.page) query.set("page", filters.page.toString());
    if (filters?.limit) query.set("limit", filters.limit.toString());

    const queryString = query.toString() ? `?${query.toString()}` : "";

    return apiClient.request<PaginatedTripsResponse>(`/trips${queryString}`);
  },

  getMyTrips: (): Promise<MyTrip[]> => {
    return apiClient.request<MyTrip[]>("/trips/my");
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
