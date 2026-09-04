import { describe, expect, it } from "vitest";
import { filterTripsForUser, shouldFetchMoreTrips } from "./tripSearch";

const trip = (id: string, driverId: string) => ({ id, driver: { id: driverId } });

describe("trip search pagination", () => {
  it("filters the current user's trips and requests another page when none remain", () => {
    const visible = filterTripsForUser([trip("1", "me")], "me");

    expect(visible).toEqual([]);
    expect(shouldFetchMoreTrips(visible.length, true, false)).toBe(true);
  });

  it("keeps foreign trips and does not fetch solely to replace a mixed page", () => {
    const visible = filterTripsForUser(
      [trip("1", "me"), trip("2", "other")],
      "me"
    );

    expect(visible.map(({ id }) => id)).toEqual(["2"]);
    expect(shouldFetchMoreTrips(visible.length, true, false)).toBe(false);
  });

  it("stops when all pages contain only the current user's trips", () => {
    const visible = filterTripsForUser([trip("1", "me")], "me");

    expect(shouldFetchMoreTrips(visible.length, false, false)).toBe(false);
  });
});
