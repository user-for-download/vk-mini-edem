// mini-app/src/modals/CreateReviewModal/__tests__/CreateReviewModal.preselect.test.tsx
//
// Preselect пассажира в CreateReviewModal (high-fixes-21):
// открытие review-флоу из контекста поездки/пассажира (trip + target)
// предвыбирает этого пассажира в radio-группе «Кому оставить отзыв».
//
// Паттерн как в CreateReviewModal.test.tsx: SSR через renderToString внутри
// ModalRoot (DOM не нужен), хуки мокаются через vi.hoisted + vi.mock.
// Отличие сценария: current user — ВОДИТЕЛЬ поездки, а useTripBookingsQuery
// отдаёт подтверждённые брони, поэтому radio-группа рендерится.
//
// useEffect в SSR не выполняется — тесты проверяют начальное состояние
// (useState(target?.id)), т.е. именно «открытие из контекста предвыбирает».
// Ручная смена покрыта кодом: onChange пишет selectedPassengerId, а
// targetUser/effectiveSelectedId отдают приоритет явному выбору над target.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { ModalRoot } from "@vkontakte/vkui";

const { mockEnqueue, mockMutate, mockInvalidateQueries, mockBookingsData, mockCurrentUser } =
  vi.hoisted(() => ({
    mockEnqueue: vi.fn(),
    mockMutate: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockBookingsData: vi.fn(),
    mockCurrentUser: vi.fn(),
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
  useTripBookingsQuery: () => ({ data: mockBookingsData() }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockCurrentUser(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { CreateReviewModal } from "@/modals/CreateReviewModal/CreateReviewModal";
import type { Booking, Trip, User } from "@/types";

const MODAL_ID = "create-review-modal";

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

const DRIVER_NAME = "Водитель Дмитрий";
const PASSENGER_A = "Пассажир Альфа";
const PASSENGER_B = "Пассажир Браво";
const PASSENGER_PENDING = "Пассажир Чарли";

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
    seatsAvailable: 1,
    driver: makeUser({ id: "d-1", name: DRIVER_NAME, vkUserId: 777 }),
    tags: [],
    status: "active",
    ...overrides,
  };
}

function makeBooking(
  trip: Trip,
  passenger: User,
  seat: number,
  status: Booking["status"] = "confirmed",
): Booking {
  return { id: `b-${passenger.id}`, trip, passenger, seat, status };
}

const passengerA = makeUser({ id: "p-a", name: PASSENGER_A });
const passengerB = makeUser({ id: "p-b", name: PASSENGER_B });
const passengerPending = makeUser({ id: "p-c", name: PASSENGER_PENDING });

function mockDriverWithBookings(): Trip {
  const trip = makeTrip();
  mockCurrentUser.mockReturnValue(makeUser({ id: "d-1", name: DRIVER_NAME }));
  mockBookingsData.mockReturnValue({
    pages: [
      {
        items: [
          makeBooking(trip, passengerA, 1, "confirmed"),
          makeBooking(trip, passengerB, 2, "confirmed"),
          // Pending-заявка — не цель отзыва, в пикер не попадает.
          makeBooking(trip, passengerPending, 3, "pending"),
        ],
      },
    ],
  });
  return trip;
}

function renderOpenModal(trip: Trip, target: User | null): string {
  return renderToString(
    <ModalRoot activeModal={MODAL_ID} disableModalOverlay>
      <CreateReviewModal
        modalProps={{ id: MODAL_ID }}
        close={vi.fn()}
        update={vi.fn()}
        trip={trip}
        target={target}
      />
    </ModalRoot>,
  );
}

/** Количество checked-radio в SSR-разметке (React рендерит checked как checked=""). */
function countChecked(html: string): number {
  return html.match(/checked=""/g)?.length ?? 0;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateReviewModal — preselect пассажира из контекста", () => {
  it("target из контекста предвыбран: checked стоит у второго пассажира", () => {
    const trip = mockDriverWithBookings();
    const html = renderOpenModal(trip, passengerB);

    expect(html).toContain(`Отзыв о ${PASSENGER_B}`);
    // Ровно один выбранный radio…
    expect(countChecked(html)).toBe(1);
    // …и он принадлежит карточке второго пассажира: имя A (его единственный
    // occurrence — label до checked-input'а B), checked, затем имя B в label.
    const checkedIdx = html.indexOf('checked=""');
    expect(html.indexOf(PASSENGER_A)).toBeLessThan(checkedIdx);
    expect(checkedIdx).toBeLessThan(html.lastIndexOf(PASSENGER_B));
    // Pending-пассажир в пикер не попадает.
    expect(html).not.toContain(PASSENGER_PENDING);
  });

  it("оба подтверждённых пассажира на выбор: ручная смена возможна", () => {
    const trip = mockDriverWithBookings();
    const html = renderOpenModal(trip, passengerB);

    // Два radio с общим name — пользователь может переключить выбор.
    expect(html.match(/type="radio"/g)?.length ?? 0).toBe(2);
    expect(html.match(/name="review-target"/g)?.length ?? 0).toBe(2);
    expect(html).toContain(PASSENGER_A);
    expect(html).toContain(PASSENGER_B);
  });

  it("без контекста выбран первый пассажир (прежнее поведение)", () => {
    const trip = mockDriverWithBookings();
    const html = renderOpenModal(trip, null);

    expect(html).toContain(`Отзыв о ${PASSENGER_A}`);
    expect(countChecked(html)).toBe(1);
    const checkedIdx = html.indexOf('checked=""');
    // Checked-input первого пассажира стоит до имён обоих пассажиров в label'ах.
    expect(checkedIdx).toBeLessThan(html.lastIndexOf(PASSENGER_A));
    expect(checkedIdx).toBeLessThan(html.indexOf(PASSENGER_B));
  });

  it("без контекста и без броней: поле пустое, краша нет", () => {
    const trip = makeTrip();
    mockCurrentUser.mockReturnValue(makeUser({ id: "d-1", name: DRIVER_NAME }));
    mockBookingsData.mockReturnValue(undefined);
    const html = renderOpenModal(trip, null);

    expect(html).toContain("Оставить отзыв");
    expect(html).not.toContain('type="radio"');
    expect(countChecked(html)).toBe(0);
    expect(html).toContain("Отправить отзыв");
  });
});
