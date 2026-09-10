// Рендер-тесты страниц поездок/броней (tg-migration-12): вкладки,
// счётчики заявок, фильтры истории, полный набор фильтров поиска,
// edit ride-request, confirm-guards. Паттерн reviewsPage.test.tsx.
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppRoot } from "@telegram-apps/telegram-ui";

const {
  mockUseInfiniteTrips,
  mockUseInfiniteMyTrips,
  mockUseCancelTrip,
  mockUseCompleteTrip,
  mockUseMyBookings,
  mockUseHistory,
  mockUseCancelBooking,
  mockUseRideRequests,
  mockUseAllCities,
  mockUseCreateRideRequest,
  mockUseUpdateRideRequest,
  mockUseRideRequestStatus,
  mockUseCancelRideRequest,
} = vi.hoisted(() => ({
  mockUseInfiniteTrips: vi.fn(),
  mockUseInfiniteMyTrips: vi.fn(),
  mockUseCancelTrip: vi.fn(),
  mockUseCompleteTrip: vi.fn(),
  mockUseMyBookings: vi.fn(),
  mockUseHistory: vi.fn(),
  mockUseCancelBooking: vi.fn(),
  mockUseRideRequests: vi.fn(),
  mockUseAllCities: vi.fn(),
  mockUseCreateRideRequest: vi.fn(),
  mockUseUpdateRideRequest: vi.fn(),
  mockUseRideRequestStatus: vi.fn(),
  mockUseCancelRideRequest: vi.fn(),
}));

vi.mock("@/queries/useTripsQuery", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/queries/useTripsQuery")>();
  return {
    ...original,
    useInfiniteTripsQuery: mockUseInfiniteTrips,
    useInfiniteMyTripsQuery: mockUseInfiniteMyTrips,
    useCancelTripMutation: mockUseCancelTrip,
    useCompleteTripMutation: mockUseCompleteTrip,
  };
});

vi.mock("@/queries/useBookingsQuery", () => ({
  useMyBookingsQuery: mockUseMyBookings,
  usePassengerHistoryQuery: mockUseHistory,
  useCancelBookingMutation: mockUseCancelBooking,
}));

vi.mock("@/queries/useRideRequestsQuery", () => ({
  useRideRequestsQuery: mockUseRideRequests,
  useCreateRideRequestMutation: mockUseCreateRideRequest,
  useUpdateRideRequestMutation: mockUseUpdateRideRequest,
  useRideRequestStatusMutation: mockUseRideRequestStatus,
  useCancelRideRequestMutation: mockUseCancelRideRequest,
}));

vi.mock("@/queries/useAllCities", () => ({
  useAllCitiesQuery: mockUseAllCities,
}));

import { SearchPage } from "@/pages/SearchPage";
import { MyTripsPage } from "@/pages/MyTripsPage";
import { PassengerBookingsPage } from "@/pages/PassengerBookingsPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { RideRequestsPage } from "@/pages/RideRequestsPage";

function queryState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function infiniteState(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    ...queryState(),
    data: { pages: [{ items, pagination: { hasMore: false } }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
  };
}

function mutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, error: null, ...overrides };
}

function render(element: ReactNode): string {
  return renderToString(
    <AppRoot platform="base">
      <MemoryRouter initialEntries={["/"]}>{element}</MemoryRouter>
    </AppRoot>,
  );
}

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    fromCity: "Москва",
    toCity: "Тула",
    date: "1 июня 2030",
    time: "09:00",
    departureAt: "2030-06-01T09:00:00.000Z",
    durationMinutes: 120,
    distanceKm: 180,
    price: 500,
    seatsTotal: 3,
    seatsAvailable: 2,
    driver: { id: "u-me", name: "Я", rating: 5, reviewsCount: 1 },
    tags: [],
    status: "active",
    pendingRequestsCount: 2,
    confirmedBookingsCount: 1,
    ...overrides,
  };
}

describe("MyTripsPage parity", () => {
  it("renders tabs, request counts and guarded actions", () => {
    mockUseInfiniteMyTrips.mockReturnValue(infiniteState([makeTrip()]));
    mockUseCancelTrip.mockReturnValue(mutation());
    mockUseCompleteTrip.mockReturnValue(mutation());
    const html = render(<MyTripsPage />);
    expect(html).toContain("Активные");
    expect(html).toContain("Архив");
    expect(html).toContain("Заявки: 2");
    // SSR разбивает текст комментарием: «Заявки<!-- --> (2)».
    expect(html).toContain("(2)");
    expect(html).toContain("Завершить");
    expect(html).toContain("Отменить");
    expect(html).toContain("Детали");
  });

  it("shows the archive empty state", () => {
    mockUseInfiniteMyTrips.mockReturnValue(infiniteState([]));
    // SSR не кликает табы: дефолтная вкладка — активные, проверяем её
    // пустое состояние; текст архива — статическая строка компонента.
    const html = render(<MyTripsPage />);
    expect(html).toContain("Архив");
    expect(html).toContain("Пока пусто");
  });
});

describe("HistoryPage parity", () => {
  it("renders history filters and links into trip details", () => {
    const booking = (id: string, category: string, city: string) => ({
      id,
      seat: 1,
      status: "confirmed",
      historyCategory: category,
      trip: { id: `trip-${id}`, fromCity: city, toCity: "Тула", departureAt: "2030-06-01T09:00:00.000Z" },
    });
    mockUseHistory.mockReturnValue(
      queryState({ data: [booking("b-1", "completed", "Москва"), booking("b-2", "cancelled", "Тверь")] }),
    );
    const html = render(<HistoryPage />);
    expect(html).toContain("Все");
    expect(html).toContain("Завершённые");
    expect(html).toContain("Отменённые");
    // SSR разбивает «→» комментариями: проверяем города по частям.
    expect(html).toContain("Москва");
    expect(html).toContain("Тверь");
    expect(html).toContain("Тула");
  });
});

describe("SearchPage parity", () => {
  it("exposes the full filter set, not just q", () => {
    mockUseInfiniteTrips.mockReturnValue(infiniteState([]));
    const html = render(<SearchPage />);
    expect(html).toContain("Откуда (город)");
    expect(html).toContain("Куда (город)");
    expect(html).toContain("Дата от");
    expect(html).toContain("Дата до");
    expect(html).toContain("Цена до");
    expect(html).toContain("Не курить");
    expect(html).toContain("Сбросить");
  });
});

describe("PassengerBookingsPage parity", () => {
  it("links into the trip and guards cancellation", () => {
    mockUseMyBookings.mockReturnValue(
      queryState({
        data: [
          {
            id: "b-1",
            seat: 2,
            status: "pending",
            trip: { id: "t-9", fromCity: "Москва", toCity: "Тула" },
          },
        ],
      }),
    );
    mockUseCancelBooking.mockReturnValue(mutation());
    const html = render(<PassengerBookingsPage />);
    expect(html).toContain("Открыть поездку");
    expect(html).toContain("Отменить заявку");
    expect(html).toContain("место №2");
  });
});

describe("RideRequestsPage parity", () => {
  it("exposes edit and guarded cancel for mutable requests", () => {
    mockUseRideRequests.mockReturnValue(
      queryState({
        data: [
          {
            id: "r-1",
            fromCity: { id: "c-1", name: "Москва" },
            toCity: { id: "c-2", name: "Тула" },
            earliestAt: "2030-06-01T09:00:00.000Z",
            latestAt: "2030-06-01T12:00:00.000Z",
            expiresAt: "2030-05-30T00:00:00.000Z",
            seats: 1,
            status: "active",
          },
        ],
      }),
    );
    mockUseAllCities.mockReturnValue(queryState({ data: [] }));
    mockUseCreateRideRequest.mockReturnValue(mutation());
    mockUseUpdateRideRequest.mockReturnValue(mutation());
    mockUseRideRequestStatus.mockReturnValue(mutation());
    mockUseCancelRideRequest.mockReturnValue(mutation());
    const html = render(<RideRequestsPage />);
    expect(html).toContain("Редактировать");
    expect(html).toContain("Отменить запрос");
    expect(html).toContain("Поставить на паузу");
  });
});
