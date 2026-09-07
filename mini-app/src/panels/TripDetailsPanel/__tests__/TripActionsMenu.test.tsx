// mini-app/src/panels/TripDetailsPanel/__tests__/TripActionsMenu.test.tsx
//
// Рендер-тесты inline-секции вторичных действий поездки без @testing-library/react:
// react-dom/server renderToString (среда node, DOM не нужен).
//
// - TripSecondaryActions: обе кнопки при canReport, только «Поделиться» без него,
//   «Жалоба уже отправлена» (disabled) при alreadyReported.
// - TripDetailsPanel для постороннего (без брони): kebab-кнопки в шапке нет
//   (угол занят системными кнопками VK-клиента), «Поделиться» есть,
//   «Пожаловаться» скрыта (бэкенд иначе вернёт 403).
// - TripDetailsPanel для участника с отправленной жалобой: кнопка
//   переименована в «Жалоба уже отправлена» и погашена — модалка вовсе
//   не открывается.
//   Хуки панели мокаются (паттерн CreateReviewModal.test.tsx).
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { Trip } from "@/types";
import type { Report } from "@edem/contracts";

const { mockEnqueue, mutationMock, mockState } = vi.hoisted(() => ({
  mockEnqueue: vi.fn(),
  mutationMock: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  mockState: { myReports: [] as Report[], currentUser: null as { id: string } | null },
}));

vi.mock("@/providers/SnackbarProvider", () => ({
  useSnackbar: () => ({ enqueue: mockEnqueue }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockState.currentUser,
}));

vi.mock("@/queries/useBookingsQuery", () => ({
  useCreateBookingMutation: mutationMock,
  useCancelBookingMutation: mutationMock,
  useTripBookingsQuery: () => ({ data: undefined }),
  useUpdateBookingStatusMutation: mutationMock,
}));

vi.mock("@/queries/useTripsQuery", () => ({
  useCancelTripMutation: mutationMock,
  useCompleteTripMutation: mutationMock,
  TRIP_KEYS: { all: ["trips"] },
}));

vi.mock("@/queries/useReportsQuery", () => ({
  useMyReportsQuery: () => ({ data: mockState.myReports }),
}));

vi.mock("@/providers/ModalProvider", () => ({
  useModalApi: () => ({ openCustomModalPage: vi.fn() }),
}));

vi.mock("@/providers/ConfirmProvider", () => ({
  useConfirm: () => vi.fn(async () => false),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { TripSecondaryActions } from "@/panels/TripDetailsPanel/TripSecondaryActions";
import { TripDetailsPanel } from "@/panels/TripDetailsPanel/TripDetailsPanel";

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

function makeTrip(): Trip {
  return {
    id: "t-1",
    fromCity: "Вологда",
    fromAddress: "Ж/д вокзал",
    toCity: "Череповец",
    toAddress: "Автовокзал",
    date: "пт, 29 августа",
    time: "09:00",
    departureAt: FUTURE,
    durationMinutes: 180,
    distanceKm: 180,
    price: 800,
    seatsTotal: 3,
    seatsAvailable: 2,
    driver: {
      id: "d-1",
      vkUserId: 777,
      name: "Илья Северов",
      avatar: "",
      rating: 4.9,
      reviewsCount: 10,
      tripsCount: 20,
      isVerified: true,
    },
    tags: [],
    status: "active",
  } as Trip;
}

function makeReport(): Report {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    targetType: "trip",
    targetId: "t-1",
    category: "safety",
    description: "Проблема в поездке",
    status: "pending",
    resolutionNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
  };
}

describe("TripSecondaryActions", () => {
  it("показывает обе кнопки при canReport", () => {
    const html = renderToString(
      <TripSecondaryActions
        onShare={vi.fn()}
        onReport={vi.fn()}
        canReport
        alreadyReported={false}
      />,
    );

    expect(html).toContain("Поделиться поездкой");
    expect(html).toContain("Пожаловаться на поездку");
  });

  it("скрывает жалобу без canReport, «Поделиться» остаётся", () => {
    const html = renderToString(
      <TripSecondaryActions
        onShare={vi.fn()}
        onReport={vi.fn()}
        canReport={false}
        alreadyReported={false}
      />,
    );

    expect(html).toContain("Поделиться поездкой");
    expect(html).not.toContain("Пожаловаться на поездку");
  });

  it("alreadyReported: кнопка «Жалоба уже отправлена» и погашена", () => {
    const html = renderToString(
      <TripSecondaryActions
        onShare={vi.fn()}
        onReport={vi.fn()}
        canReport
        alreadyReported
      />,
    );

    expect(html).toContain("Жалоба уже отправлена");
    expect(html).not.toContain("Пожаловаться на поездку");
    expect(html).toContain("vkuiButton__disabled");
  });
});

describe("TripDetailsPanel — inline-секция «Дополнительно»", () => {
  it("постороннему: kebab нет, жалоба скрыта, «Поделиться» есть", () => {
    mockState.currentUser = null;
    mockState.myReports = [];
    const html = renderToString(
      <TripDetailsPanel id="trip" trip={makeTrip()} onBack={vi.fn()} onOpenDriver={vi.fn()} />,
    );

    // Kebab удалён: верхний правый угол занят системными кнопками VK.
    expect(html).not.toContain('aria-label="Действия с поездкой"');
    // Inline-секция: поделиться всем, жалоба только участникам.
    expect(html).toContain("Дополнительно");
    expect(html).toContain("Поделиться поездкой");
    expect(html).not.toContain("Пожаловаться на поездку");
  });

  it("участник с отправленной жалобой: кнопка переименована, модалка не откроется", () => {
    mockState.currentUser = null;
    mockState.myReports = [makeReport()];
    const trip = {
      ...makeTrip(),
      myBooking: { id: "b-1", seat: 1, status: "confirmed" },
    } as Trip;
    const html = renderToString(
      <TripDetailsPanel id="trip" trip={trip} onBack={vi.fn()} onOpenDriver={vi.fn()} />,
    );

    expect(html).toContain("Жалоба уже отправлена");
    expect(html).not.toContain("Пожаловаться на поездку");
    expect(html).toContain("vkuiButton__disabled");
  });

  it("водитель на своей поездке: жаловаться нельзя, только «Поделиться»", () => {
    mockState.currentUser = { id: "d-1" };
    mockState.myReports = [];
    const html = renderToString(
      <TripDetailsPanel id="trip" trip={makeTrip()} onBack={vi.fn()} onOpenDriver={vi.fn()} />,
    );

    expect(html).toContain("Поделиться поездкой");
    expect(html).not.toContain("Пожаловаться на поездку");
    expect(html).not.toContain("Жалоба уже отправлена");
  });
});
