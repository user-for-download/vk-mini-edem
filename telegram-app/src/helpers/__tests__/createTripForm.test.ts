import { describe, expect, it } from "vitest";
import {
  validateCreateTripDraft,
  type CreateTripDraft,
} from "@/helpers/createTripForm";

const CITIES = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Вологда" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Череповец" },
] as const;

const NOW = new Date("2026-09-12T10:00:00.000Z");

function draft(overrides: Partial<CreateTripDraft> = {}): CreateTripDraft {
  return {
    fromName: "Вологда",
    toName: "Череповец",
    fromAddress: "пл. Бабушкина, 1",
    toAddress: "пр. Победы, 1",
    date: "2026-09-13T09:00",
    durationHours: "2",
    distanceKm: "140",
    price: "450",
    seats: "2",
    tags: [],
    comment: "",
    ...overrides,
  };
}

describe("validateCreateTripDraft", () => {
  it("валидный черновик: fromCityId/toCityId из справочника", () => {
    const result = validateCreateTripDraft(draft(), [...CITIES], NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data["fromCityId"]).toBe(CITIES[0].id);
      expect(result.data["toCityId"]).toBe(CITIES[1].id);
      expect(result.data["fromCity"]).toBe("Вологда");
      expect(result.data["seatsTotal"]).toBe(2);
    }
  });

  it("город вне справочника — отказ (свободный ввод запрещён)", () => {
    expect(
      validateCreateTripDraft(draft({ fromName: "Москва" }), [...CITIES], NOW),
    ).toEqual({ ok: false, error: "Выберите города из справочника" });
    expect(validateCreateTripDraft(draft(), undefined, NOW)).toEqual({
      ok: false,
      error: "Выберите города из справочника",
    });
  });

  it("прошедшая дата — отказ", () => {
    expect(
      validateCreateTripDraft(draft({ date: "2026-09-11T09:00" }), [...CITIES], NOW),
    ).toEqual({ ok: false, error: "Укажите будущие дату и время отправления" });
    expect(
      validateCreateTripDraft(draft({ date: "не дата" }), [...CITIES], NOW),
    ).toEqual({ ok: false, error: "Укажите будущие дату и время отправления" });
  });

  it("4 места — отказ схемы (MAX_SEATS=3)", () => {
    const result = validateCreateTripDraft(draft({ seats: "4" }), [...CITIES], NOW);
    expect(result.ok).toBe(false);
  });

  it("тот же город туда-обратно — отказ схемы", () => {
    const result = validateCreateTripDraft(
      draft({ toName: "Вологда" }),
      [...CITIES],
      NOW,
    );
    expect(result.ok).toBe(false);
  });
});
