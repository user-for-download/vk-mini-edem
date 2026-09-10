import { describe, expect, it } from "vitest";
import { ONBOARDING_VERSION, shouldShowOnboarding } from "./version";

describe("Telegram onboarding versions", () => {
  it.each([null, undefined, "1", "future"]) ("shows for %s", (version) => {
    expect(shouldShowOnboarding(version)).toBe(true);
  });
  it("does not show after the current version is persisted", () => {
    expect(shouldShowOnboarding(ONBOARDING_VERSION)).toBe(false);
  });
});
