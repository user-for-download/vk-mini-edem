import { describe, expect, it } from "vitest";
import { parseDeepLink } from "./deepLink";

describe("parseDeepLink", () => {
  it("leaves hash routes to the router", () => {
    expect(parseDeepLink("")).toEqual({});
  });

  it("parses query fallback parameters", () => {
    expect(
      parseDeepLink(
        "?tripId=trip-1&driverId=driver-1&modal=review&openHistory=true",
      ),
    ).toEqual({
      tripId: "trip-1",
      driverId: "driver-1",
      modal: "review",
      openHistory: true,
    });
  });

  it("accepts uuid-style trip ids", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseDeepLink(`?tripId=${id}`)).toEqual({ tripId: id });
  });

  it("drops trip ids with invalid charset", () => {
    expect(parseDeepLink("?tripId=trip/1?x=<script>")).toEqual({});
    expect(parseDeepLink("?tripId=trip 1")).toEqual({});
  });

  it("drops trip ids longer than 64 chars", () => {
    expect(parseDeepLink(`?tripId=${"a".repeat(65)}`)).toEqual({});
    expect(parseDeepLink(`?tripId=${"a".repeat(64)}`)).toEqual({
      tripId: "a".repeat(64),
    });
  });
});
