import { describe, expect, it } from "vitest";
import { parseDeepLink } from "./deepLink";

describe("parseDeepLink", () => {
  it("leaves hash routes to the router", () => {
    expect(parseDeepLink("")).toEqual({});
  });

  it("parses query fallback parameters", () => {
    expect(
      parseDeepLink("?tripId=trip-1&driverId=driver-1&modal=review&openHistory=true"),
    ).toEqual({
      tripId: "trip-1",
      driverId: "driver-1",
      modal: "review",
      openHistory: true,
    });
  });
});
