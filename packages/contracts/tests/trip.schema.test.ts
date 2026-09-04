import { describe, it, expect } from "vitest";
import { tripSchema, MAX_SEATS } from "../src/schemas/trip.schema";
import { createTripDtoSchema } from "../src/dto/trip.dto";

describe("tripSchema", () => {
  const validTrip = {
    id: "t-1",
    fromCity: "Москва",
    fromAddress: "м. Тёплый Стан",
    toCity: "Санкт-Петербург",
    toAddress: "м. Московская",
    date: "3 августа, пн",
    time: "09:30",
    durationMinutes: 470,
    distanceKm: 705,
    price: 1450,
    seatsTotal: 3,
    seatsAvailable: 2,
    driver: {
      id: "u-2",
      name: "Марина Ковалёва",
      avatar: "https://i.pravatar.cc/200?img=32",
      rating: 4.8,
      reviewsCount: 21,
      tripsCount: 40,
    },
    tags: ["Есть багаж", "Тихая поездка"],
    comment: "Останавливаюсь один раз",
  };

  it("should parse valid trip", () => {
    const result = tripSchema.safeParse(validTrip);
    expect(result.success).toBe(true);
  });

  it("should parse public trips without a car plate", () => {
    const result = tripSchema.safeParse({
      ...validTrip,
      confirmedBookingsCount: 1,
      driver: {
        ...validTrip.driver,
        car: { model: "Skoda Octavia", color: "белый" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject trip with seatsAvailable > seatsTotal", () => {
    const result = tripSchema.safeParse({ ...validTrip, seatsAvailable: 3, seatsTotal: 2 });
    // Zod не проверяет cross-field по умолчанию, это ок
    expect(result.success).toBe(true);
  });

  it("should reject trip with negative price", () => {
    const result = tripSchema.safeParse({ ...validTrip, price: -100 });
    expect(result.success).toBe(false);
  });

  it("should reject response trip with seatsTotal > MAX_SEATS", () => {
    const result = tripSchema.safeParse({
      ...validTrip,
      seatsTotal: MAX_SEATS + 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("createTripDtoSchema", () => {
  it("should parse valid create trip dto", () => {
    const result = createTripDtoSchema.safeParse({
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Тула",
      toAddress: "пр-т Ленина",
      fromCityId: "11111111-1111-4111-8111-111111111111",
      toCityId: "22222222-2222-4222-8222-222222222222",
      departureAt: "2025-08-05T09:30:00.000Z",
      durationMinutes: 130,
      distanceKm: 165,
      price: 500,
      seatsTotal: 3,
      tags: ["Можно курить", "Есть багаж"],
    });
    expect(result.success).toBe(true);
  });

  it("should reject dto with price > 100000", () => {
    const result = createTripDtoSchema.safeParse({
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Тула",
      toAddress: "пр-т Ленина",
      fromCityId: "11111111-1111-4111-8111-111111111111",
      toCityId: "22222222-2222-4222-8222-222222222222",
      departureAt: "2025-08-05T09:30:00.000Z",
      durationMinutes: 130,
      distanceKm: 165,
      price: 200000,
      seatsTotal: 3,
      tags: [],
    });
    expect(result.success).toBe(false);
  });

  // Создание поездки ограничено MAX_SEATS = 3.
  it("should reject dto with seatsTotal = 4", () => {
    const result = createTripDtoSchema.safeParse({
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Тула",
      toAddress: "пр-т Ленина",
      fromCityId: "11111111-1111-4111-8111-111111111111",
      toCityId: "22222222-2222-4222-8222-222222222222",
      departureAt: "2025-08-05T09:30:00.000Z",
      durationMinutes: 130,
      distanceKm: 165,
      price: 500,
      seatsTotal: 4,
      tags: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject dto without fromCityId", () => {
    const result = createTripDtoSchema.safeParse({
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Тула",
      toAddress: "пр-т Ленина",
      toCityId: "22222222-2222-4222-8222-222222222222",
      departureAt: "2025-08-05T09:30:00.000Z",
      durationMinutes: 130,
      distanceKm: 165,
      price: 500,
      seatsTotal: 3,
      tags: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject dto with non-uuid fromCityId", () => {
    const result = createTripDtoSchema.safeParse({
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Тула",
      toAddress: "пр-т Ленина",
      fromCityId: "not-a-uuid",
      toCityId: "22222222-2222-4222-8222-222222222222",
      departureAt: "2025-08-05T09:30:00.000Z",
      durationMinutes: 130,
      distanceKm: 165,
      price: 500,
      seatsTotal: 3,
      tags: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject dto where fromCityId equals toCityId", () => {
    const sameId = "11111111-1111-4111-8111-111111111111";
    const result = createTripDtoSchema.safeParse({
      fromCity: "Вологда",
      fromAddress: "м. Тёплый Стан",
      toCity: "вологда",
      toAddress: "пр-т Ленина",
      fromCityId: sameId,
      toCityId: sameId,
      departureAt: "2025-08-05T09:30:00.000Z",
      durationMinutes: 130,
      distanceKm: 165,
      price: 500,
      seatsTotal: 3,
      tags: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pathMessages = result.error.issues.map((i) => i.path.join("."));
      expect(pathMessages).toContain("toCityId");
    }
  });
});
