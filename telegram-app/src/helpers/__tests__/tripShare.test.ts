import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTripDeepLink,
  buildTripStartParam,
  shareTrip,
} from "@/helpers/tripShare";

const TRIP_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("trip share links", () => {
  it("builds the startapp token accepted by the deep-link parser", () => {
    expect(buildTripStartParam(TRIP_ID)).toBe(`trip_${TRIP_ID}`);
  });

  it("builds a web deep link to the trip details route", () => {
    expect(buildTripDeepLink(TRIP_ID, "https://app.example/")).toBe(
      `https://app.example/#/trips/${TRIP_ID}`,
    );
  });
});

describe("shareTrip", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Web Share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    await expect(shareTrip(TRIP_ID)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("falls back to the clipboard when Web Share is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    // jsdom-less node: location.origin отсутствует — deep link строится от localhost.
    await expect(shareTrip(TRIP_ID)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("reports failure when neither share nor clipboard works", async () => {
    vi.stubGlobal("navigator", {});
    await expect(shareTrip(TRIP_ID)).resolves.toBe("failed");
  });
});
