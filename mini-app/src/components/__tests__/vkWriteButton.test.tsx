// mini-app/src/components/__tests__/vkWriteButton.test.tsx
//
// Рендер-тесты кнопки «Написать» (ЛС ВКонтакте) без @testing-library/react:
// используем react-dom/server renderToString. Компоненты презентационные
// (без сторов/провайдеров), поэтому достаточно мокнуть @/helpers/vkLink,
// чтобы не тянуть bridge и не выполнять реальных открытий ссылок.
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("@/helpers/vkLink", () => ({
  openVkMessages: vi.fn(),
  buildVkMessageUrl: vi.fn(),
}));

import { BookingRequestRow } from "@/components/BookingRequestRow";
import { PassengerTripCard } from "@/components/PassengerTripCard";
import type { Booking, PassengerBooking, Trip, User } from "@/types";

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

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-1",
    seat: 1,
    status: "pending",
    passenger: makeUser({ id: "p-1", vkUserId: 555 }),
    trip: makeTrip(),
    ...overrides,
  };
}

describe("BookingRequestRow — кнопка «Написать» (водитель → пассажир)", () => {
  const onSetStatus = vi.fn();

  it("показывает «Написать» у pending-заявки с vkUserId пассажира", () => {
    const html = renderToString(
      <BookingRequestRow booking={makeBooking({ status: "pending" })} onSetStatus={onSetStatus} />
    );
    expect(html).toContain('aria-label="Написать в VK"');
  });

  it("показывает «Написать» у подтверждённой брони с vkUserId пассажира", () => {
    const html = renderToString(
      <BookingRequestRow booking={makeBooking({ status: "confirmed" })} onSetStatus={onSetStatus} />
    );
    expect(html).toContain('aria-label="Написать в VK"');
  });

  it("скрывает «Написать» у pending-заявки, если у пассажира нет vkUserId", () => {
    const booking = makeBooking({
      status: "pending",
      passenger: makeUser({ id: "p-1", vkUserId: undefined }),
    });
    const html = renderToString(<BookingRequestRow booking={booking} onSetStatus={onSetStatus} />);
    expect(html).not.toContain("Написать");
  });

  it("скрывает «Написать» у отклонённой заявки, даже если vkUserId есть", () => {
    const html = renderToString(
      <BookingRequestRow booking={makeBooking({ status: "declined" })} onSetStatus={onSetStatus} />
    );
    expect(html).not.toContain("Написать");
  });

  it("рендерит «Принять заявку» и «Отклонить» в actions для pending", () => {
    const html = renderToString(
      <BookingRequestRow booking={makeBooking({ status: "pending" })} onSetStatus={onSetStatus} />
    );
    expect(html).toContain("Принять заявку");
    expect(html).toContain("Отклонить");
  });

  it("не рендерит actions для подтверждённой/отклонённой брони", () => {
    const confirmed = renderToString(
      <BookingRequestRow booking={makeBooking({ status: "confirmed" })} onSetStatus={onSetStatus} />
    );
    expect(confirmed).not.toContain("Принять заявку");
    expect(confirmed).not.toContain("Отклонить");

    const declined = renderToString(
      <BookingRequestRow booking={makeBooking({ status: "declined" })} onSetStatus={onSetStatus} />
    );
    expect(declined).not.toContain("Принять заявку");
    expect(declined).not.toContain("Отклонить");
  });
});

describe("PassengerTripCard — кнопка «Написать» (пассажир → водитель)", () => {
  it("показывает «Написать» у активной брони с vkUserId водителя", () => {
    const booking: PassengerBooking = {
      ...makeBooking({ status: "confirmed" }),
      scope: "active",
    };
    const html = renderToString(<PassengerTripCard booking={booking} />);
    expect(html).toContain("Написать в VK");
  });

  it("показывает «Написать» у pending-брони (с момента заявки)", () => {
    const booking: PassengerBooking = {
      ...makeBooking({ status: "pending" }),
      scope: "active",
    };
    const html = renderToString(<PassengerTripCard booking={booking} />);
    expect(html).toContain("Написать в VK");
  });

  it("скрывает «Написать», если у водителя нет vkUserId", () => {
    const booking: PassengerBooking = {
      ...makeBooking({
        status: "confirmed",
        trip: makeTrip({ driver: makeUser({ id: "d-1", vkUserId: undefined }) }),
      }),
      scope: "active",
    };
    const html = renderToString(<PassengerTripCard booking={booking} />);
    expect(html).not.toContain("Написать");
  });

  it("скрывает «Написать» для отменённой поездки", () => {
    const booking: PassengerBooking = {
      ...makeBooking({ status: "confirmed", trip: makeTrip({ status: "cancelled" }) }),
      scope: "active",
    };
    const html = renderToString(<PassengerTripCard booking={booking} />);
    expect(html).not.toContain("Написать");
  });
});
