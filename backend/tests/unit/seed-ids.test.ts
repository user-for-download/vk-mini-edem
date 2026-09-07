import { describe, expect, it } from "vitest";
import {
  baseTripSchema,
  reportSchema,
  rideRequestSchema,
} from "@edem/contracts";
import {
  seedCityId,
  seedReportId,
  seedRideRequestId,
  seedUuid,
} from "../../prisma/seed-ids.js";

// Регрессия инцидента «slug-id в сиде»: детерминированные id сид-сущностей
// обязаны проходить UUID-валидацию контрактов. До исправления сид писал
// `city-вологда`/`rr-1`/`rep-1`, и POST /trips на свежезасеянной БД
// возвращал 400 "Invalid payload" (красный E2E в CI), а списки заявок
// и жалоб не проходили клиентскую валидацию (rideRequestSchema.id,
// reportSchema.id — uuid).
describe("seed-ids — deterministic contract-valid UUIDs", () => {
  it("produces RFC 4122 v5 UUIDs (version + variant nibbles)", () => {
    const id = seedUuid("edem.city", "вологда");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("is deterministic: same input -> same id", () => {
    expect(seedCityId("вологда")).toBe(seedCityId("вологда"));
    expect(seedRideRequestId("rr-1")).toBe(seedRideRequestId("rr-1"));
    expect(seedReportId("rep-1")).toBe(seedReportId("rep-1"));
  });

  it("separates namespaces: same name in different scopes -> different ids", () => {
    const ids = new Set([
      seedCityId("вологда"),
      seedUuid("edem.other", "вологда"),
      seedRideRequestId("rr-1"),
      seedReportId("rr-1"),
    ]);
    expect(ids.size).toBe(4);
  });

  it("city ids pass the create-trip DTO uuid requirement", () => {
    for (const name of ["вологда", "череповец", "кичменгский городок"]) {
      const parsed = baseTripSchema.shape.fromCityId.safeParse(
        seedCityId(name),
      );
      expect(parsed.success).toBe(true);
    }
  });

  it("ride-request ids pass rideRequestSchema.id", () => {
    for (const ref of ["rr-1", "rr-2", "rr-3", "rr-4", "rr-5"]) {
      const parsed = rideRequestSchema.shape.id.safeParse(
        seedRideRequestId(ref),
      );
      expect(parsed.success).toBe(true);
    }
  });

  it("report ids pass reportSchema.id", () => {
    for (const ref of ["rep-1", "rep-2", "rep-3", "rep-4"]) {
      const parsed = reportSchema.shape.id.safeParse(seedReportId(ref));
      expect(parsed.success).toBe(true);
    }
  });
});
