import { describe, expect, it } from "vitest";
import {
  buildSearchFilters,
  EMPTY_SEARCH_FORM,
  parseSearchQuery,
} from "@/helpers/searchFilters";

describe("parseSearchQuery", () => {
  it("returns an empty filter for blank input", () => {
    expect(parseSearchQuery("   ")).toEqual({});
  });

  it("keeps a free-text query as q", () => {
    expect(parseSearchQuery("Москва")).toEqual({ q: "Москва" });
  });

  it("splits an arrow route into from/to cities", () => {
    expect(parseSearchQuery("Москва → Тула")).toEqual({
      fromCity: "Москва",
      toCity: "Тула",
    });
  });

  it("accepts dash separators like the VK search", () => {
    expect(parseSearchQuery("Москва - Тула")).toEqual({
      fromCity: "Москва",
      toCity: "Тула",
    });
  });

  it("falls back to q when only one side of the route is given", () => {
    expect(parseSearchQuery("Москва → ")).toEqual({ q: "Москва" });
  });
});

describe("buildSearchFilters", () => {
  it("returns undefined for a pristine form (backend default feed)", () => {
    expect(buildSearchFilters(EMPTY_SEARCH_FORM)).toBeUndefined();
  });

  it("combines query, explicit cities, dates, price and tags", () => {
    const filters = buildSearchFilters({
      query: "центр",
      fromCity: "Москва",
      toCity: "Тула",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-05",
      maxPrice: "1500",
      tags: ["Не курить"],
    });
    expect(filters).toMatchObject({
      q: "центр",
      fromCity: "Москва",
      toCity: "Тула",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-05",
      maxPrice: 1500,
      tags: ["Не курить"],
    });
  });

  it("ignores a non-numeric price instead of sending NaN", () => {
    const filters = buildSearchFilters({
      ...EMPTY_SEARCH_FORM,
      maxPrice: "много",
    });
    expect(filters).toBeUndefined();
  });
});
