// mini-app/src/modals/DriverProfileModal/__tests__/DriverProfileModal.test.tsx
//
// Рендер-тесты модалки профиля водителя без @testing-library/react
// (не установлен): используем react-dom/server renderToString (среда node,
// DOM не нужен) — паттерн как в CreateReviewModal.test.tsx и
// ReviewsPanel.test.tsx (vi.hoisted + фабрики vi.mock, mockReturnValue
// настраивается в каждом тесте).
//
// Что покрываем (acceptance high-fixes-19):
// 1) Параллельная загрузка: reviews-хук вызывается с driverId из пропсов
//    даже пока профиль ещё грузится (без waterfall `driver?.id ?? ""`).
// 2) Различимые состояния loading / error / empty (DOM-ассерты).
// 3) Error-state предлагает retry («Попробовать снова») и восстановление
//    после retry (перерендер с успехом показывает профиль).
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ModalRoot } from "@vkontakte/vkui";
import { REVIEW_STATUS } from "@edem/contracts";
import type { Review, User } from "@/types";

const { mockUserQuery, mockUserReviewsInfiniteQuery } = vi.hoisted(() => ({
  mockUserQuery: vi.fn(),
  mockUserReviewsInfiniteQuery: vi.fn(),
}));

vi.mock("@/queries/useUsersQuery", () => ({
  useUserQuery: mockUserQuery,
}));

vi.mock("@/queries/useReviewsQuery", () => ({
  useUserReviewsInfiniteQuery: mockUserReviewsInfiniteQuery,
}));

import { DriverProfileModal } from "@/modals/DriverProfileModal/DriverProfileModal";

const DRIVER_ID = "d-1";
const MODAL_ID = "driver-profile";

function makeDriver(overrides: Partial<User> = {}): User {
  return {
    id: DRIVER_ID,
    name: "Иван Водителев",
    avatar: "https://i.pravatar.cc/200?img=12",
    rating: 4.9,
    reviewsCount: 3,
    tripsCount: 20,
    ...overrides,
  } as User;
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r-1",
    author: makeDriver({ id: "u-author", name: "Автор Отзывов" }),
    targetRole: "driver",
    rating: 5,
    text: "Отличная поездка, всё понравилось",
    status: REVIEW_STATUS.PUBLISHED,
    date: "1 сентября 2026",
    tripRoute: "Москва → Тула",
    ...overrides,
  } as Review;
}

function makeUserState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function makeReviewsState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function makeReviewsPage(items: Review[], hasMore = false) {
  return {
    pages: [{ items, pagination: { hasMore, nextCursor: null } }],
    pageParams: [undefined],
  };
}

function setQueries(
  user: Record<string, unknown>,
  reviews: Record<string, unknown> = {},
) {
  mockUserQuery.mockReset();
  mockUserReviewsInfiniteQuery.mockReset();
  mockUserQuery.mockReturnValue(makeUserState(user));
  mockUserReviewsInfiniteQuery.mockReturnValue(makeReviewsState(reviews));
}

function renderModal(): string {
  return renderToString(
    <ModalRoot activeModal={MODAL_ID} disableModalOverlay>
      <DriverProfileModal
        modalProps={{ id: MODAL_ID } as never}
        driverId={DRIVER_ID}
        close={vi.fn()}
        update={vi.fn()}
      />
    </ModalRoot>,
  );
}

describe("DriverProfileModal — параллельная загрузка (без waterfall)", () => {
  it("reviews-запрос стартует с driverId из пропсов, пока профиль ещё грузится", () => {
    setQueries({ data: undefined, isLoading: true }, { isLoading: true });

    renderModal();

    // Оба хука вызваны с исходным driverId — reviews не ждёт driver?.id.
    expect(mockUserQuery).toHaveBeenCalledWith(DRIVER_ID);
    expect(mockUserReviewsInfiniteQuery).toHaveBeenCalledWith(
      DRIVER_ID,
      expect.any(Number),
    );
    const reviewsArg = mockUserReviewsInfiniteQuery.mock.calls[0][0] as string;
    expect(reviewsArg).toBe(DRIVER_ID);
    expect(reviewsArg).not.toBe("");
  });
});

describe("DriverProfileModal — состояния профиля", () => {
  it("loading: показывает «Загрузка профиля»", () => {
    setQueries({ data: undefined, isLoading: true }, { isLoading: true });

    const html = renderModal();

    expect(html).toContain("Загрузка профиля");
    expect(html).not.toContain("Иван Водителев");
  });

  it("error: показывает «Профиль не найден» с кнопкой retry", () => {
    setQueries({ data: undefined, isError: true });

    const html = renderModal();

    expect(html).toContain("Профиль не найден");
    expect(html).toContain("Не удалось загрузить данные водителя");
    expect(html).toContain("Попробовать снова");
  });

  it("retry восстанавливает профиль: после ошибки повторный рендер с успехом показывает водителя", () => {
    // Первая попытка — ошибка с retry-кнопкой.
    setQueries({ data: undefined, isError: true });
    const errorHtml = renderModal();
    expect(errorHtml).toContain("Попробовать снова");

    // Retry (refetch) завершился успехом — профиль рендерится.
    setQueries(
      { data: makeDriver() },
      { data: makeReviewsPage([]) },
    );
    const recoveredHtml = renderModal();
    expect(recoveredHtml).toContain("Иван Водителев");
    expect(recoveredHtml).not.toContain("Профиль не найден");
  });
});

describe("DriverProfileModal — состояния отзывов", () => {
  it("reviews loading: профиль виден + «Загрузка отзывов»", () => {
    setQueries({ data: makeDriver() }, { isLoading: true });

    const html = renderModal();

    expect(html).toContain("Иван Водителев");
    expect(html).toContain("Загрузка отзывов");
  });

  it("reviews error: «Не удалось загрузить отзывы» с кнопкой retry", () => {
    setQueries({ data: makeDriver() }, { isError: true });

    const html = renderModal();

    expect(html).toContain("Иван Водителев");
    expect(html).toContain("Не удалось загрузить отзывы");
    expect(html).toContain("Попробовать снова");
  });

  it("reviews empty: «Отзывов пока нет»", () => {
    setQueries({ data: makeDriver() }, { data: makeReviewsPage([]) });

    const html = renderModal();

    expect(html).toContain("Иван Водителев");
    expect(html).toContain("Отзывов пока нет");
  });

  it("reviews success: список отзывов рендерится", () => {
    setQueries(
      { data: makeDriver() },
      { data: makeReviewsPage([makeReview()]) },
    );

    const html = renderModal();

    expect(html).toContain("Иван Водителев");
    expect(html).toContain("Отличная поездка, всё понравилось");
    expect(html).not.toContain("Отзывов пока нет");
    expect(html).not.toContain("Загрузка отзывов");
  });

  it("reviews retry восстанавливает список: ошибка → успех", () => {
    setQueries({ data: makeDriver() }, { isError: true });
    expect(renderModal()).toContain("Не удалось загрузить отзывы");

    setQueries(
      { data: makeDriver() },
      { data: makeReviewsPage([makeReview()]) },
    );
    const recoveredHtml = renderModal();
    expect(recoveredHtml).toContain("Отличная поездка, всё понравилось");
    expect(recoveredHtml).not.toContain("Не удалось загрузить отзывы");
  });
});
