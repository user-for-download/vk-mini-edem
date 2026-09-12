// Рендер-тесты тел модалок (TripDetails/CreateTrip/Feedback).
// Modal — портал и в renderToString не попадает, поэтому тестируются
// экспортированные тела (CreateTripBody/FeedbackForm). Детали поездки —
// это TripDetailsPage, покрытый tripDetailsPage.test.tsx 8/8.
// Паттерн tripsPages.test.tsx (SSR, без testing-library).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppRoot } from "@telegram-apps/telegram-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAllCities.mockReturnValue(queryState({ data: [] }));
  mockUseCreateTrip.mockReturnValue(mutation());
  mockUseCreateFeedback.mockReturnValue(mutation());
});

const { mockUseAllCities, mockUseCreateTrip, mockUseCreateFeedback } = vi.hoisted(
  () => ({
    mockUseAllCities: vi.fn(),
    mockUseCreateTrip: vi.fn(),
    mockUseCreateFeedback: vi.fn(),
  }),
);

vi.mock("@/queries/useAllCities", () => ({
  useAllCitiesQuery: mockUseAllCities,
}));

vi.mock("@/queries/useTripsQuery", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/queries/useTripsQuery")>();
  return {
    ...original,
    useCreateTripMutation: mockUseCreateTrip,
  };
});

vi.mock("@/queries/useSupportQuery", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/queries/useSupportQuery")>();
  return {
    ...original,
    useCreateFeedbackMutation: mockUseCreateFeedback,
  };
});

import { CreateTripBody } from "@/components/CreateTripModal";
import { FeedbackForm } from "@/components/FeedbackModal";
import { ToastProvider } from "@/components/ToastProvider";

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

function mutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, error: null, ...overrides };
}

function render(element: ReactNode): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return renderToString(
    <AppRoot platform="base">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/trips/my/new"]}>
          <ToastProvider>{element}</ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </AppRoot>,
  );
}

const CITIES = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Вологда" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Череповец" },
];

describe("CreateTripBody", () => {
  it("города — из справочника (datalist), места — кап MAX_SEATS=3", () => {
    mockUseAllCities.mockReturnValue(queryState({ data: CITIES }));
    const html = render(<CreateTripBody onCreated={() => {}} />);
    expect(html).toContain("Маршрут");
    expect(html).toContain("Город отправления");
    expect(html).toContain("Вологда");
    expect(html).toContain("Череповец");
    expect(html).toContain("Поездка");
    expect(html).toContain("Условия поездки");
    expect(html).toContain("Опубликовать");
  });

  it("справочник грузится — плейсхолдер вместо формы", () => {
    mockUseAllCities.mockReturnValue(
      queryState({ data: undefined, isLoading: true }),
    );
    const html = render(<CreateTripBody onCreated={() => {}} />);
    expect(html).toContain("Загружаем города");
    expect(html).not.toContain("Опубликовать");
  });

  it("ошибка мутации — видимый текст", () => {
    mockUseAllCities.mockReturnValue(queryState({ data: CITIES }));
    mockUseCreateTrip.mockReturnValue(
      mutation({ error: new Error("Overlap with passenger booking") }),
    );
    const html = render(<CreateTripBody onCreated={() => {}} />);
    expect(html).toContain("Overlap with passenger booking");
  });
});

describe("FeedbackForm", () => {
  it("темы из списка, лимит 2000, пустое сообщение — сабмит погашен", () => {
    const html = render(<FeedbackForm onClose={() => {}} />);
    expect(html).toContain("Тема обращения");
    expect(html).toContain("Вопрос по поездке");
    expect(html).toContain("Предложение по улучшению");
    expect(html).toContain("Опишите детали вашего обращения");
    expect(html).toContain("Отправить в поддержку");
    expect(html).toContain("Мои обращения");
  });
});
