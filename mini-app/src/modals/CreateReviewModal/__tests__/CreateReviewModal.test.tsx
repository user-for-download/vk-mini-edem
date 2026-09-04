// mini-app/src/modals/CreateReviewModal/__tests__/CreateReviewModal.test.tsx
//
// Рендер-тесты модалки отзыва без @testing-library/react (не установлен):
// используем react-dom/server renderToString (среда node, DOM не нужен).
//
// Два важных момента:
// 1) Отдельная ModalPage с open=false рендерит null, а open в
//    modalProps недоступен (OpenModalPageProps = Omit<ModalPageProps,
//    'open' | 'keepMounted'>). Рендерим модалку внутри ModalRoot с
//    activeModal (id совпадает) — так же, как делает useModalManager
//    в реальном приложении. В SSR контент рендерится инлайн (портала
//    нет — document отсутствует).
// 2) В среде node взаимодействие с формой не симулируется, поэтому
//    проверка лимита 150 символов строится по трём слоям:
//    - константа REVIEW_TEXT_MAX_LENGTH из @edem/contracts = 150
//      (компонент мапит её в MAX_TEXT_LENGTH);
//    - Textarea получает maxLength = REVIEW_TEXT_MAX_LENGTH (бразуер
//      физически не даст ввести больше);
//    - общая write-схема createReviewDtoSchema принимает ровно 150
//      символов и отклоняет 151 (тот же лимит, что валидирует и
//      бэкенд).
//
// Хуки модалки (snackbar, mutation, queries, current user, query
// client) мокаются, чтобы не тянуть react-query и VK snackbar в
// рендер-тест — паттерн как в AuthGate.test.tsx (vi.hoisted +
// фабрики vi.mock).
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ModalRoot } from "@vkontakte/vkui";
import {
  REVIEW_TEXT_MAX_LENGTH,
  createReviewDtoSchema,
} from "@edem/contracts";

// vi.hoisted: фабрики vi.mock поднимаются выше объявления переменных.
const { mockEnqueue, mockMutate, mockInvalidateQueries } = vi.hoisted(() => ({
  mockEnqueue: vi.fn(),
  mockMutate: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}));

vi.mock("@/providers/SnackbarProvider", () => ({
  useSnackbar: () => ({ enqueue: mockEnqueue }),
}));

vi.mock("@/queries/useReviewsQuery", () => ({
  useCreateReviewMutation: () => ({ mutate: mockMutate, isPending: false }),
  REVIEW_KEYS: {
    all: ["reviews"],
    availableTrips: () => ["reviews", "available-trips"],
  },
}));

vi.mock("@/queries/useBookingsQuery", () => ({
  useTripBookingsQuery: () => ({ data: undefined }),
}));

// useCurrentUser → null: сценарий «пассажир пишет водителю» без
// passenger-пикера (isDriver = false), Radio-группа не рендерится.
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { CreateReviewModal } from "@/modals/CreateReviewModal/CreateReviewModal";
import type { Trip, User } from "@/types";

const MODAL_ID = "create-review-modal";

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    name: "Илья Северов",
    avatar: "https://i.pravatar.cc/200?img=12",
    rating: 4.9,
    reviewsCount: 10,
    tripsCount: 20,
    ...overrides,
  };
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t-1",
    fromCity: "Москва",
    toCity: "Тула",
    date: "пт, 29 августа",
    time: "09:00",
    departureAt: FUTURE,
    durationMinutes: 180,
    distanceKm: 180,
    price: 800,
    seatsTotal: 3,
    seatsAvailable: 2,
    driver: makeUser({ id: "d-1", vkUserId: 777 }),
    tags: [],
    status: "active",
    ...overrides,
  };
}

/** SSR-рендер открытой модалки: пассажир оставляет отзыв водителю. */
function renderOpenModal(): string {
  return renderToString(
    <ModalRoot activeModal={MODAL_ID} disableModalOverlay>
      <CreateReviewModal
        modalProps={{ id: MODAL_ID }}
        close={vi.fn()}
        update={vi.fn()}
        trip={makeTrip()}
        target={makeUser({ id: "d-1" })}
      />
    </ModalRoot>
  );
}

describe("CreateReviewModal — лимит 150 символов", () => {
  it("REVIEW_TEXT_MAX_LENGTH из @edem/contracts равен 150", () => {
    expect(REVIEW_TEXT_MAX_LENGTH).toBe(150);
  });

  it("write-схема принимает ровно 150 символов (граница лимита)", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 5,
      text: "x".repeat(REVIEW_TEXT_MAX_LENGTH),
    });
    expect(result.success).toBe(true);
  });

  it("write-схема отклоняет 151 символ", () => {
    const result = createReviewDtoSchema.safeParse({
      tripId: "t-1",
      targetUserId: "u-2",
      rating: 5,
      text: "x".repeat(REVIEW_TEXT_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("Textarea блокирует ввод за лимитом: maxLength = REVIEW_TEXT_MAX_LENGTH", () => {
    const html = renderOpenModal();

    // React SSR рендерит attr как maxLength (camelCase), а не maxlength.
    expect(html).toContain(`maxLength="${REVIEW_TEXT_MAX_LENGTH}"`);
  });
});

describe("CreateReviewModal — начальный рендер", () => {
  it("показывает шапку «Отзыв о …», поездку и кнопку «Отправить отзыв»", () => {
    const html = renderOpenModal();

    expect(html).toContain("Отзыв о Илья Северов");
    expect(html).toContain("Москва → Тула, пт, 29 августа");
    expect(html).toContain(
      'placeholder="Расскажите, что понравилось или что стоит улучшить"',
    );
    expect(html).toContain("Отправить отзыв");
  });

  it("пустой комментарий: счётчик и ошибка валидации не показаны, кнопка disabled", () => {
    const html = renderOpenModal();

    // Счётчик `{n}/{MAX}` рендерится только когда text.length > 0.
    expect(html).not.toContain(`/${REVIEW_TEXT_MAX_LENGTH}`);
    // Ошибка «Максимум 150 символов» появляется только после сабмита.
    expect(html).not.toContain("Максимум");
    // canSubmit = false: trip и target есть, но текст пуст.
    expect(html).toContain("vkuiButton__disabled");
    // Успешный снакбар «…на модерацию» — только после сабмита.
    expect(html).not.toContain("на модерацию");
  });
});
