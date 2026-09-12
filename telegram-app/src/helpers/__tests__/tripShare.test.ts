import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTripDeepLink,
  buildTripStartParam,
  shareTrip,
} from "@/helpers/tripShare";

vi.mock("@/utils/telegram-adapter", () => ({
  getRawInitData: vi.fn(),
  shareViaTelegram: vi.fn(),
}));

import { getRawInitData, shareViaTelegram } from "@/utils/telegram-adapter";

const mockedGetRawInitData = vi.mocked(getRawInitData);
const mockedShareViaTelegram = vi.mocked(shareViaTelegram);

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
  beforeEach(() => {
    mockedGetRawInitData.mockReset();
    mockedShareViaTelegram.mockReset();
    // Дефолт — браузер вне Telegram: нативный шаринг не трогаем.
    mockedGetRawInitData.mockReturnValue(undefined);
    mockedShareViaTelegram.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("внутри Telegram — нативный shareURL первым", async () => {
    mockedGetRawInitData.mockReturnValue("user=%7B%7D&hash=x");
    mockedShareViaTelegram.mockReturnValue(true);
    const share = vi.fn();
    vi.stubGlobal("navigator", { share });
    await expect(shareTrip(TRIP_ID)).resolves.toBe("shared");
    expect(mockedShareViaTelegram).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
  });

  it("отказ Telegram-шаринга — откат на Web Share", async () => {
    mockedGetRawInitData.mockReturnValue("user=%7B%7D&hash=x");
    mockedShareViaTelegram.mockReturnValue(false);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    await expect(shareTrip(TRIP_ID)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
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
