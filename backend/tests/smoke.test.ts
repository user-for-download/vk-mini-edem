import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { db } from "../src/db.js";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

async function cleanDb() {
  await db.review.deleteMany();
  await db.booking.deleteMany();
  await db.trip.deleteMany();
  await db.car.deleteMany();
  await db.user.deleteMany();
}

beforeAll(async () => {
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await db.$disconnect();
});

describe("health", () => {
  it("returns ok", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string };

    expect(body.status).toBe("ok");
  });
});

describe("auth bootstrap", () => {
  it("creates user and returns token", async () => {
    await cleanDb();

    const response = await app.request("/api/auth/vk", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        vkUserId: 111111,
        sign: "dev-sign",
        ts: Date.now(),
      }),
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; name: string };
    };

    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.id).toBeTruthy();
    expect(body.user.name).toBeTruthy();
  });
});

describe("trips", () => {
  it("returns only active trips", async () => {
    await cleanDb();

    const driver = await db.user.create({
      data: {
        vkUserId: 222222,
        name: "Driver",
        avatar: "https://i.pravatar.cc/200?img=1",
      },
    });

    await db.trip.create({
      data: {
        driverId: driver.id,
        fromCity: "Москва",
        fromAddress: "м. Тёплый Стан",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        departureAt: new Date("2030-01-01T09:00:00Z"),
        durationMinutes: 120,
        distanceKm: 180,
        price: 700,
        seatsTotal: 3,
        seatsAvailable: 3,
        tags: ["Есть багаж"],
      },
    });

    await db.trip.create({
      data: {
        driverId: driver.id,
        fromCity: "Москва",
        fromAddress: "м. ВДНХ",
        toCity: "Ярославль",
        toAddress: "Автовокзал",
        departureAt: new Date("2030-01-01T10:00:00Z"),
        durationMinutes: 180,
        distanceKm: 265,
        price: 800,
        seatsTotal: 3,
        seatsAvailable: 3,
        tags: [],
        status: "cancelled",
      },
    });

    const response = await app.request("/api/trips");

    expect(response.status).toBe(200);

    const trips = (await response.json()) as Array<{
      fromCity: string;
      toCity: string;
      status: string;
    }>;

    expect(trips.length).toBe(1);
    expect(trips[0].fromCity).toBe("Москва");
    expect(trips[0].toCity).toBe("Тула");
    expect(trips[0].status).toBe("active");
  });
});

describe("bookings smoke", () => {
  it("creates booking and decreases seatsAvailable", async () => {
    await cleanDb();

    const passenger = await db.user.create({
      data: {
        vkUserId: 333333,
        name: "Passenger",
        avatar: "https://i.pravatar.cc/200?img=2",
      },
    });

    const driver = await db.user.create({
      data: {
        vkUserId: 444444,
        name: "Driver",
        avatar: "https://i.pravatar.cc/200?img=3",
      },
    });

    const trip = await db.trip.create({
      data: {
        driverId: driver.id,
        fromCity: "Москва",
        fromAddress: "м. Тёплый Стан",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        departureAt: new Date("2030-01-01T09:00:00Z"),
        durationMinutes: 120,
        distanceKm: 180,
        price: 700,
        seatsTotal: 3,
        seatsAvailable: 2,
        tags: [],
      },
    });

    const response = await app.request("/api/bookings", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer mock-access-token-${passenger.id}`,
      },
      body: JSON.stringify({
        tripId: trip.id,
        seat: 1,
        comment: "Буду вовремя",
      }),
    });

    expect(response.status).toBe(201);

    const booking = (await response.json()) as { id: string; seat: number };

    expect(booking.id).toBeTruthy();
    expect(booking.seat).toBe(1);

    const updatedTrip = await db.trip.findUnique({
      where: { id: trip.id },
    });

    expect(updatedTrip?.seatsAvailable).toBe(1);
  });
});
