// telegram-app/src/helpers/searchFilters.ts
// Полный набор поисковых фильтров (паритет VK SearchPanel):
// разбор «Откуда → Куда» / «Откуда - Куда» и сборка TripFiltersDto.
// Вынесено в helper ради unit-тестов без DOM.
import type { TripTag } from "@edem/contracts";
import type { SearchTripsFilters } from "@/api/trips.api";

const ROUTE_SEPARATOR_REGEX = /→|\s+[-—–]\s+/;

export function parseSearchQuery(raw: string): {
  q?: string;
  fromCity?: string;
  toCity?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (ROUTE_SEPARATOR_REGEX.test(trimmed)) {
    const normalized = trimmed.replace(/\s+[-—–]\s+/g, "→");
    const parts = normalized.split("→").map((part) => part.trim());
    const result: { fromCity?: string; toCity?: string } = {};
    if (parts[0]) result.fromCity = parts[0];
    if (parts[1]) result.toCity = parts[1];
    // Один город без направления — ищем по нему как по свободной строке,
    // чтобы не терять результаты (бэкенд ищет q по городам и адресам).
    if (!result.fromCity && !result.toCity) return { q: trimmed };
    if (result.fromCity && !result.toCity) return { q: result.fromCity };
    if (result.toCity && !result.fromCity) return { q: result.toCity };
    return result;
  }
  return { q: trimmed };
}

export interface SearchFormState {
  query: string;
  fromCity: string;
  toCity: string;
  dateFrom: string;
  dateTo: string;
  maxPrice: string;
  tags: TripTag[];
}

export const EMPTY_SEARCH_FORM: SearchFormState = {
  query: "",
  fromCity: "",
  toCity: "",
  dateFrom: "",
  dateTo: "",
  maxPrice: "",
  tags: [],
};

export function buildSearchFilters(
  state: SearchFormState,
): SearchTripsFilters | undefined {
  const result: SearchTripsFilters = { ...parseSearchQuery(state.query) };
  const fromCity = state.fromCity.trim();
  const toCity = state.toCity.trim();
  if (fromCity) result.fromCity = fromCity;
  if (toCity) result.toCity = toCity;
  if (state.dateFrom) result.dateFrom = state.dateFrom;
  if (state.dateTo) result.dateTo = state.dateTo;
  const maxPrice = Number(state.maxPrice);
  if (state.maxPrice.trim() && Number.isFinite(maxPrice) && maxPrice > 0) {
    result.maxPrice = Math.floor(maxPrice);
  }
  if (state.tags.length > 0) result.tags = [...state.tags];
  return Object.keys(result).length > 0 ? result : undefined;
}
