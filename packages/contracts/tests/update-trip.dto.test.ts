import { describe, it, expect } from "vitest";
import { updateTripDtoSchema } from "../src/dto/trip.dto";

/**
 * PATCH /trips/:id: правила обновления:
 *  - все поля опциональны (partial);
 *  - маршрут (`fromCity`/`fromCityId`/`toCity`/`toCityId`) ЗАПРЕЩЁН
 *    к изменению. Водитель должен удалить поездку и создать новую.
 */
describe("updateTripDtoSchema", () => {
  it("accepts empty payload (no-op)", () => {
    const result = updateTripDtoSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update with seatsTotal only", () => {
    const result = updateTripDtoSchema.safeParse({ seatsTotal: 2 });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with price and comment", () => {
    const result = updateTripDtoSchema.safeParse({
      price: 800,
      comment: "Один раз остановлюсь",
    });
    expect(result.success).toBe(true);
  });

  it("rejects update that tries to change fromCity (route is locked)", () => {
    const result = updateTripDtoSchema.safeParse({
      fromCity: "Санкт-Петербург",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod 4: unrecognized_keys группирует все лишние поля в один
      // issue с пустым path. Проверяем упоминание поля в messages.
      const messages = result.error.issues.map((i) => i.message).join("|");
      expect(messages).toMatch(/fromCity/);
    }
  });

  it("rejects update that tries to change toCity (route is locked)", () => {
    const result = updateTripDtoSchema.safeParse({
      toCity: "Вологда",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("|");
      expect(messages).toMatch(/toCity/);
    }
  });

  it("rejects update that tries to change fromCityId (route is locked)", () => {
    const result = updateTripDtoSchema.safeParse({
      fromCityId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("|");
      expect(messages).toMatch(/fromCityId/);
    }
  });

  it("rejects update that tries to change toCityId (route is locked)", () => {
    const result = updateTripDtoSchema.safeParse({
      toCityId: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("|");
      expect(messages).toMatch(/toCityId/);
    }
  });

  it("rejects update that tries to change address and route in one shot", () => {
    const result = updateTripDtoSchema.safeParse({
      fromAddress: "Новый адрес",
      fromCityId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("still validates durationMinutes / price / seatsTotal bounds", () => {
    const tooExpensive = updateTripDtoSchema.safeParse({ price: 200000 });
    expect(tooExpensive.success).toBe(false);

    const zeroDuration = updateTripDtoSchema.safeParse({ durationMinutes: 0 });
    expect(zeroDuration.success).toBe(false);

    const tooManySeats = updateTripDtoSchema.safeParse({ seatsTotal: 5 });
    expect(tooManySeats.success).toBe(false);
  });
});
