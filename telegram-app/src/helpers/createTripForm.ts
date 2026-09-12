import { createTripDtoSchema, type TripTag } from "@edem/contracts";
import type { z } from "zod";

/** Payload POST /trips — тип из схемы (бэкенд — авторитет). */
export type CreateTripPayload = z.infer<typeof createTripDtoSchema>;

/**
 * Черновик формы создания поездки (строковые поля ввода + теги).
 * Чистый хелпер ради unit-тестов инвариантов без DOM.
 */
export interface CreateTripDraft {
  fromName: string;
  toName: string;
  fromAddress: string;
  toAddress: string;
  /** datetime-local значение. */
  date: string;
  durationHours: string;
  distanceKm: string;
  price: string;
  seats: string;
  tags: TripTag[];
  comment: string;
}

export interface DirectoryCity {
  id: string;
  name: string;
}

export type CreateTripValidation =
  | { ok: true; data: CreateTripPayload }
  | { ok: false; error: string };

/**
 * Валидация черновика перед POST /trips (порядок как в форме):
 * 1. оба города — из справочника (свободный ввод запрещён);
 * 2. дата отправления — в будущем;
 * 3. полный payload — через createTripDtoSchema (бэкенд — авторитет:
 *    MAX_SEATS=3, fromCityId !== toCityId, лимиты цены/дистанции).
 */
export function validateCreateTripDraft(
  draft: CreateTripDraft,
  cities: readonly DirectoryCity[] | undefined,
  now: Date = new Date(),
): CreateTripValidation {
  const fromCity = cities?.find((city) => city.name === draft.fromName);
  const toCity = cities?.find((city) => city.name === draft.toName);
  if (!fromCity || !toCity) {
    return { ok: false, error: "Выберите города из справочника" };
  }
  const departureAt = new Date(draft.date);
  if (!Number.isFinite(departureAt.getTime()) || departureAt <= now) {
    return { ok: false, error: "Укажите будущие дату и время отправления" };
  }
  const parsed = createTripDtoSchema.safeParse({
    fromCity: fromCity.name,
    toCity: toCity.name,
    fromCityId: fromCity.id,
    toCityId: toCity.id,
    fromAddress: draft.fromAddress.trim(),
    toAddress: draft.toAddress.trim(),
    departureAt: departureAt.toISOString(),
    durationMinutes: Number(draft.durationHours) * 60,
    distanceKm: Number(draft.distanceKm),
    price: Number(draft.price),
    seatsTotal: Number(draft.seats),
    tags: draft.tags,
    comment: draft.comment.trim() || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Проверьте данные поездки",
    };
  }
  return { ok: true, data: parsed.data };
}
