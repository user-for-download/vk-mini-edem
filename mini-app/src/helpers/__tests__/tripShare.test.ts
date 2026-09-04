import { describe, expect, it, vi } from "vitest";

const send = vi.fn();
const openExternalUrl = vi.fn();

vi.mock("@/helpers/bridge", () => ({
  bridge: { send },
  openExternalUrl,
}));

const { buildTripShareUrl, shareTrip } = await import("@/helpers/tripShare");

describe("trip sharing", () => {
  it("builds a route-only hash URL", () => {
    expect(buildTripShareUrl("trip/one", "https://edem.example")).toBe(
      "https://edem.example/#/trips/trip%2Fone",
    );
  });

  it("uses VK share in the VK client", async () => {
    send.mockResolvedValueOnce({});
    await expect(shareTrip("trip-1")).resolves.toBe("shared");
    expect(send).toHaveBeenCalledWith("VKWebAppShare", {
      link: "http://localhost/#/trips/trip-1",
    });
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it("opens the safe route URL when VK share fails", async () => {
    send.mockRejectedValueOnce(new Error("unsupported"));
    await expect(shareTrip("trip-2")).resolves.toBe("opened");
    expect(openExternalUrl).toHaveBeenCalledWith("http://localhost/#/trips/trip-2");
  });
});
