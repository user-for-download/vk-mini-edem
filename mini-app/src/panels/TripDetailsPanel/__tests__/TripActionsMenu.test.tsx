// mini-app/src/panels/TripDetailsPanel/__tests__/TripActionsMenu.test.tsx
//
// Рендер-тесты kebab-меню опций поездки без @testing-library/react:
// react-dom/server renderToString (среда node, DOM не нужен).
//
// - TripActionsSheet рендерится напрямую: оба пункта меню на месте.
// - TripDetailsPanel в закрытом состоянии: кебаб-кнопка в шапке есть,
//   нижних кнопок «Поделиться»/«Пожаловаться» нет, шит не отрендерен.
//   Хуки панели мокаются (паттерн CreateReviewModal.test.tsx).
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createRef } from "react";
import type { Trip } from "@/types";

const { mockEnqueue, mutationMock } = vi.hoisted(() => ({
  mockEnqueue: vi.fn(),
  mutationMock: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/providers/SnackbarProvider", () => ({
  useSnackbar: () => ({ enqueue: mockEnqueue }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => null,
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

vi.mock("@/providers/ModalProvider", () => ({
  useModalApi: () => ({ openCustomModalPage: vi.fn() }),
}));

vi.mock("@/providers/ConfirmProvider", () => ({
  useConfirm: () => vi.fn(async () => false),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { TripActionsSheet } from "@/panels/TripDetailsPanel/TripActionsSheet";
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

describe("TripActionsSheet", () => {
  it("показывает пункты «Поделиться» и «Пожаловаться»", () => {
    const html = renderToString(
      <TripActionsSheet
        toggleRef={createRef<HTMLElement>()}
        onClose={vi.fn()}
        onShare={vi.fn()}
        onReport={vi.fn()}
      />,
    );

    expect(html).toContain("Поделиться поездкой");
    expect(html).toContain("Пожаловаться на поездку");
  });
});

describe("TripDetailsPanel — kebab-меню в шапке", () => {
  it("кебаб-кнопка есть, нижних кнопок опций нет, шит закрыт", () => {
    const html = renderToString(
      <TripDetailsPanel id="trip" trip={makeTrip()} onBack={vi.fn()} onOpenDriver={vi.fn()} />,
    );

    // Тоггл меню в шапке с доступным именем.
    expect(html).toContain('aria-label="Действия с поездкой"');
    // Старые нижние кнопки удалены из вёрстки.
    expect(html).not.toContain("Поделиться поездкой");
    expect(html).not.toContain("Пожаловаться на поездку");
  });
});
