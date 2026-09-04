import { describe, it, expect } from "vitest";
import {
  cityDtoSchema,
  adminCityDtoSchema,
  cityNameBodySchema,
  citySuggestQuerySchema,
  citySuggestResponseSchema,
  adminCitiesQuerySchema,
  paginatedCitiesResponseSchema,
  CITY_NAME_MAX_LENGTH,
  CITY_SUGGEST_LIMIT_MAX,
  CITY_SUGGEST_LIMIT_DEFAULT,
  ADMIN_CITY_PAGE_SIZE_MAX,
  ADMIN_CITY_PAGE_SIZE_DEFAULT,
  normalizeCityName,
  cityNameNormalized,
} from "../src/dto/city.dto";

const UUID_V4 = "11111111-1111-4111-8111-111111111111";
const UUID_V4_OTHER = "22222222-2222-4222-8222-222222222222";

describe("normalizeCityName / cityNameNormalized", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeCityName("  Великий   Устюг  ")).toBe("Великий Устюг");
    expect(normalizeCityName("Вологда")).toBe("Вологда");
    expect(normalizeCityName("\tКичменгский\tГородок\n")).toBe(
      "Кичменгский Городок",
    );
  });

  it("lowercases for normalized key", () => {
    expect(cityNameNormalized("Вологда")).toBe("вологда");
    expect(cityNameNormalized("ВОЛОГДА")).toBe("вологда");
    expect(cityNameNormalized("  ВОЛОГДА  ")).toBe("вологда");
  });

  it("treats equivalent names as the same key", () => {
    expect(cityNameNormalized("Великий Устюг")).toBe(
      cityNameNormalized("  великий   устюг "),
    );
  });
});

describe("cityDtoSchema", () => {
  it("accepts a valid city", () => {
    const r = cityDtoSchema.safeParse({ id: UUID_V4, name: "Вологда" });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = cityDtoSchema.safeParse({ id: UUID_V4, name: "" });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than CITY_NAME_MAX_LENGTH", () => {
    const r = cityDtoSchema.safeParse({
      id: UUID_V4,
      name: "а".repeat(CITY_NAME_MAX_LENGTH + 1),
    });
    expect(r.success).toBe(false);
  });

  it("ignores unknown fields (passthrough response DTO)", () => {
    // Response DTOs intentionally use passthrough: сервер может
    // со временем добавить поля без ломки старых клиентов.
    const r = cityDtoSchema.safeParse({
      id: UUID_V4,
      name: "Вологда",
      tripsCount: 5,
    });
    expect(r.success).toBe(true);
  });
});

describe("adminCityDtoSchema", () => {
  it("accepts a city with tripsCount and timestamps", () => {
    const r = adminCityDtoSchema.safeParse({
      id: UUID_V4,
      name: "Вологда",
      tripsCount: 12,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative tripsCount", () => {
    const r = adminCityDtoSchema.safeParse({
      id: UUID_V4,
      name: "Вологда",
      tripsCount: -1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });
});

describe("cityNameBodySchema", () => {
  it("accepts a trimmed name and applies the transform", () => {
    const r = cityNameBodySchema.safeParse({ name: "  Вологда  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Вологда");
    }
  });

  it("trims and collapses internal whitespace", () => {
    const r = cityNameBodySchema.safeParse({
      name: "  Великий\t\tУстюг  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Великий Устюг");
    }
  });

  it("rejects empty after trim", () => {
    const r = cityNameBodySchema.safeParse({ name: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than CITY_NAME_MAX_LENGTH", () => {
    const r = cityNameBodySchema.safeParse({
      name: "а".repeat(CITY_NAME_MAX_LENGTH + 1),
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const r = cityNameBodySchema.safeParse({ name: "Вологда", id: UUID_V4 });
    expect(r.success).toBe(false);
  });
});

describe("citySuggestQuerySchema", () => {
  it("accepts a non-empty query and applies default limit", () => {
    const r = citySuggestQuerySchema.safeParse({ q: "вол" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.q).toBe("вол");
      expect(r.data.limit).toBe(CITY_SUGGEST_LIMIT_DEFAULT);
    }
  });

  it("trims the query", () => {
    const r = citySuggestQuerySchema.safeParse({ q: "  вол  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.q).toBe("вол");
    }
  });

  it("accepts empty q (returns full directory)", () => {
    const r = citySuggestQuerySchema.safeParse({ q: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.q).toBe("");
  });

  it("accepts whitespace-only q (treated as empty)", () => {
    const r = citySuggestQuerySchema.safeParse({ q: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.q).toBe("");
  });

  it("accepts missing q (returns full directory)", () => {
    const r = citySuggestQuerySchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("rejects limit over CITY_SUGGEST_LIMIT_MAX", () => {
    const r = citySuggestQuerySchema.safeParse({
      q: "вол",
      limit: CITY_SUGGEST_LIMIT_MAX + 1,
    });
    expect(r.success).toBe(false);
  });

  it("accepts limit equal to the maximum", () => {
    const r = citySuggestQuerySchema.safeParse({
      q: "вол",
      limit: CITY_SUGGEST_LIMIT_MAX,
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    const r = citySuggestQuerySchema.safeParse({ q: "вол", page: 1 });
    expect(r.success).toBe(false);
  });
});

describe("citySuggestResponseSchema", () => {
  it("accepts an empty items array", () => {
    const r = citySuggestResponseSchema.safeParse({ items: [] });
    expect(r.success).toBe(true);
  });

  it("accepts a list of cities", () => {
    const r = citySuggestResponseSchema.safeParse({
      items: [
        { id: UUID_V4, name: "Вологда" },
        { id: UUID_V4_OTHER, name: "Вохтога" },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("adminCitiesQuerySchema", () => {
  it("applies defaults when called with only `q`", () => {
    const r = adminCitiesQuerySchema.safeParse({ q: "вол" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.pageSize).toBe(ADMIN_CITY_PAGE_SIZE_DEFAULT);
      expect(r.data.q).toBe("вол");
    }
  });

  it("accepts pagination overrides", () => {
    const r = adminCitiesQuerySchema.safeParse({
      q: "вол",
      page: 2,
      pageSize: 10,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(2);
      expect(r.data.pageSize).toBe(10);
    }
  });

  it("rejects pageSize over ADMIN_CITY_PAGE_SIZE_MAX", () => {
    const r = adminCitiesQuerySchema.safeParse({
      pageSize: ADMIN_CITY_PAGE_SIZE_MAX + 1,
    });
    expect(r.success).toBe(false);
  });

  it("allows omitting q", () => {
    const r = adminCitiesQuerySchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    const r = adminCitiesQuerySchema.safeParse({ q: "вол", foo: "bar" });
    expect(r.success).toBe(false);
  });
});

describe("paginatedCitiesResponseSchema", () => {
  it("accepts a paginated payload", () => {
    const r = paginatedCitiesResponseSchema.safeParse({
      items: [
        {
          id: UUID_V4,
          name: "Вологда",
          tripsCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
        hasMore: false,
      },
    });
    expect(r.success).toBe(true);
  });
});
