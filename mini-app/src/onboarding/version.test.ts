import { describe, expect, it } from "vitest";

import { ONBOARDING_VERSION, shouldShowOnboarding } from "./version";

describe("shouldShowOnboarding", () => {
  it("пользователь не проходил онбординг (null) -> показать", () => {
    expect(shouldShowOnboarding(null)).toBe(true);
  });

  it("версии нет в объекте пользователя (undefined) -> показать", () => {
    expect(shouldShowOnboarding(undefined)).toBe(true);
  });

  it("сохранённая версия совпадает с текущей -> не показывать", () => {
    expect(shouldShowOnboarding(ONBOARDING_VERSION)).toBe(false);
  });

  it("сохранённая версия отличается от текущей -> показать", () => {
    expect(shouldShowOnboarding("0")).toBe(true);
    expect(shouldShowOnboarding("99")).toBe(true);
  });
});
