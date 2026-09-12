// telegram-app/src/helpers/searchFilters.ts
// Поисковые фильтры для ленты поездок: города + сегмент дат (Сегодня/
// Завтра/Выходные/Все) + максимальная цена + теги. Сборка TripFiltersDto.
// Вынесено в helper ради unit-тестов без DOM.
import type { TripTag } from "@edem/contracts";
import type { SearchTripsFilters } from "@/api/trips.api";
import { toIsoDate } from "@/utils/date";

export type DateSegment = "all" | "today" | "tomorrow" | "weekend";

export const DATE_SEGMENTS: ReadonlyArray<{ value: DateSegment; label: string }> = [
  { value: "all", label: "Все даты" },
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
];

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function parseSegment(value: string | null): DateSegment {
  return value === "today" || value === "tomorrow" || value === "weekend"
    ? value
    : "all";
}

/** URL-параметр ?segment= → DateSegment (мусор → "all"). */
export function parseDateSegmentParam(value: string | null): DateSegment {
  return parseSegment(value);
}

/**
 * Сегмент дат → диапазон dateFrom/dateTo (локальные даты, ISO):
 * - today/tomorrow — конкретный день;
 * - weekend — ближайшие суббота–воскресенье; если выходные уже идут
 *   (суббота/воскресенье) — от сегодня до воскресенья.
 */
export function dateSegmentToRange(
  segment: DateSegment,
  now: Date = new Date(),
): { dateFrom?: string; dateTo?: string } {
  if (segment === "all") return {};
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (segment === "today") {
    const iso = toIsoDate(today);
    return { dateFrom: iso, dateTo: iso };
  }
  if (segment === "tomorrow") {
    const iso = toIsoDate(new Date(today.getTime() + MS_IN_DAY));
    return { dateFrom: iso, dateTo: iso };
  }
  const dayOfWeek = today.getDay(); // 0 = воскресенье, 6 = суббота
  if (dayOfWeek === 0) {
    const iso = toIsoDate(today);
    return { dateFrom: iso, dateTo: iso };
  }
  const saturday = new Date(today.getTime() + (6 - dayOfWeek) * MS_IN_DAY);
  const sunday = new Date(saturday.getTime() + MS_IN_DAY);
  return { dateFrom: toIsoDate(saturday), dateTo: toIsoDate(sunday) };
}

export interface SearchFormState {
  fromCity: string;
  toCity: string;
  dateSegment: DateSegment;
  maxPrice: string;
  tags: TripTag[];
}

export const EMPTY_SEARCH_FORM: SearchFormState = {
  fromCity: "",
  toCity: "",
  dateSegment: "all",
  maxPrice: "",
  tags: [],
};

export function buildSearchFilters(
  state: SearchFormState,
): SearchTripsFilters | undefined {
  const result: SearchTripsFilters = {};
  const fromCity = state.fromCity.trim();
  const toCity = state.toCity.trim();
  if (fromCity) result.fromCity = fromCity;
  if (toCity) result.toCity = toCity;
  const range = dateSegmentToRange(state.dateSegment);
  if (range.dateFrom) result.dateFrom = range.dateFrom;
  if (range.dateTo) result.dateTo = range.dateTo;
  const maxPrice = Number(state.maxPrice);
  if (state.maxPrice.trim() && Number.isFinite(maxPrice) && maxPrice > 0) {
    result.maxPrice = Math.floor(maxPrice);
  }
  if (state.tags.length > 0) result.tags = [...state.tags];
  return Object.keys(result).length > 0 ? result : undefined;
}
