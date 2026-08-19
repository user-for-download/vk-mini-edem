import { afterEach, describe, expect, it, vi } from "vitest";
import { bridge, triggerHaptic } from "./bridge";

afterEach(() => vi.restoreAllMocks());

describe("triggerHaptic", () => {
  function mockSupport(value: boolean) {
    Object.defineProperty(bridge, "supportsAsync", {
      configurable: true,
      value: vi.fn().mockResolvedValue(value),
    });
  }

  it("sends supported haptic feedback", async () => {
    mockSupport(true);
    const send = vi.spyOn(bridge, "send").mockResolvedValue({ result: true });

    await expect(triggerHaptic("medium")).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith("VKWebAppTapticImpactOccurred", { style: "medium" });
  });

  it("does nothing when haptics are unsupported", async () => {
    mockSupport(false);
    const send = vi.spyOn(bridge, "send");

    await expect(triggerHaptic()).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails safely when the bridge rejects the call", async () => {
    mockSupport(true);
    vi.spyOn(bridge, "send").mockRejectedValue(new Error("bridge unavailable"));

    await expect(triggerHaptic("heavy")).resolves.toBe(false);
  });
});
