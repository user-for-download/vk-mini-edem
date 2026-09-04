// mini-app/src/views/ProfileView/panels/ReviewsPanel/__tests__/ReviewsPanel.test.tsx
//
// Рендер-тесты панели «Отзывы» без @testing-library/react (не установлен):
// используем react-dom/server renderToString (среда node, DOM не нужен).
// Конвенция репо — см. CreateReviewModal.test.tsx:
// 1) Хуки (useCurrentUser, useMyReviewsQuery, useUserReviewsQuery) мокаются
//    через vi.hoisted + фабрики vi.mock; на возвращаемых значениях
//    настраивается mockReturnValue в каждом тесте (канонический паттерн
//    vitest — тождество функций стабильно, данные меняются по тестам).
// 2) В среде node взаимодействие с DOM не симулируется, поэтому переключать
//    SegmentedControl нельзя: рендерится начальная вкладка «Мои».
//    Логика вкладки «О вас» покрывается unit-тестами чистой функции
//    getReviewsForTab (helpers/__tests__/reviewsTabs.test.ts) — компонент
//    лишь рендерит результат фильтрации.
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { REVIEW_STATUS } from "@edem/contracts";
import type { Review, User } from "@/types";

const { mockMyReviewsQuery, mockAboutReviewsQuery } = vi.hoisted(() => ({
  mockMyReviewsQuery: vi.fn(),
  mockAboutReviewsQuery: vi.fn(),
}));

vi.mock("@/queries/useReviewsQuery", () => ({
  useMyReviewsQuery: mockMyReviewsQuery,
  useUserReviewsQuery: mockAboutReviewsQuery,
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ id: "u-me", name: "Я", avatar: "https://vk.com/photo.png" }),
}));

import { ReviewsPanel } from "@/views/ProfileView/panels/ReviewsPanel/ReviewsPanel";

interface MockQueryState {
  data?: Review[];
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isFetching?: boolean;
}

const ME: User = {
  id: "u-me",
  name: "Я",
  avatar: "https://vk.com/photo.png",
  rating: 5,
  reviewsCount: 0,
  tripsCount: 0,
};

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r-1",
    author: ME,
    targetRole: "passenger",
    rating: 5,
    text: "Текст отзыва",
    status: REVIEW_STATUS.PUBLISHED,
    date: "1 сентября 2026",
    tripRoute: "Вологда → Череповец",
    ...overrides,
  };
}

function makeQueryState(overrides: MockQueryState = {}) {
  return {
    data: undefined as Review[] | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function setQueries(my: MockQueryState, about: MockQueryState = {}) {
  mockMyReviewsQuery.mockReturnValue(makeQueryState(my));
  mockAboutReviewsQuery.mockReturnValue(makeQueryState(about));
}

function renderPanel(): string {
  return renderToString(
    <ReviewsPanel id="panel-profile-reviews" role="passenger" onBack={() => {}} onOpenCreateReview={() => {}} />
  );
}

describe("ReviewsPanel: структура", () => {
  it("заголовок «Отзывы» и две вкладки (Мои/О вас)", () => {
    setQueries({ data: [makeReview({ status: REVIEW_STATUS.PENDING })] });

    const html = renderPanel();

    expect(html).toContain("Отзывы");
    expect(html).toContain("Мои");
    expect(html).toContain("О вас");
    expect(html).not.toContain("Ждут");
  });
});

describe("ReviewsPanel: начальная вкладка «Мои»", () => {
  it("показывает pending- и published-отзывы вместе", () => {
    setQueries({
      data: [
        makeReview({ id: "r-pending", text: "Пендинг-текст", status: REVIEW_STATUS.PENDING }),
        makeReview({ id: "r-published", text: "Пабlished-текст", status: REVIEW_STATUS.PUBLISHED }),
      ],
    });

    const html = renderPanel();

    expect(html).toContain("Пендинг-текст");
    expect(html).toContain("Пабlished-текст");
    // Подпись статуса непубличного отзыва — из ReviewCard.
    expect(html).toContain("На модерации");
  });

  it("пустое состояние: заголовок «Мои» + CTA «Оставить отзыв»", () => {
    setQueries({ data: [] });

    const html = renderPanel();

    expect(html).toContain("Вы пока не оставили отзывов");
    expect(html).not.toContain("Нет отзывов на модерации");
    expect(html).toContain("Оставить отзыв");
  });
});

describe("ReviewsPanel: состояния загрузки и ошибки", () => {
  it("loading — скелетоны (aria-busy)", () => {
    setQueries({ isLoading: true });

    const html = renderPanel();

    expect(html).toContain("Загрузка отзывов");
  });

  it("ошибка запроса — EmptyState с кнопкой «Попробовать снова»", () => {
    setQueries({ isError: true, error: new Error("Нет соединения") });

    const html = renderPanel();

    expect(html).toContain("Не удалось загрузить отзывы");
    expect(html).toContain("Попробовать снова");
  });
});
