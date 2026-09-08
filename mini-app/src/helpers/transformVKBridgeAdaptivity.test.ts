import { describe, expect, it } from "vitest";
import { ViewHeight, ViewWidth } from "@vkontakte/vkui";
import { transformVKBridgeAdaptivity } from "./transformVKBridgeAdaptivity";

// Брейкпоинты VKUI (lib/adaptivity/breakpoints): ширина 320/768/1024/1280
// (SMALL_MOBILE < 320 ≤ MOBILE ≤ 768 < SMALL_TABLET ≤ 1024 < TABLET ≤
// 1280 < DESKTOP), высота 415/720 (EXTRA_SMALL < 415 ≤ SMALL ≤ 720 < MEDIUM).
describe("transformVKBridgeAdaptivity", () => {
  it("returns empty props when bridge reports no adaptivity", () => {
    expect(
      transformVKBridgeAdaptivity({
        type: null,
        viewportWidth: 0,
        viewportHeight: 0,
      })
    ).toEqual({});
  });

  it("forces mobile viewport with regular density for force_mobile", () => {
    expect(
      transformVKBridgeAdaptivity({
        type: "force_mobile",
        viewportWidth: 1920,
        viewportHeight: 1080,
      })
    ).toEqual({ viewWidth: ViewWidth.MOBILE, density: "regular" });
  });

  it("forces mobile viewport with compact density for force_mobile_compact", () => {
    expect(
      transformVKBridgeAdaptivity({
        type: "force_mobile_compact",
        viewportWidth: 1920,
        viewportHeight: 1080,
      })
    ).toEqual({ viewWidth: ViewWidth.MOBILE, density: "compact" });
  });

  it("maps sub-small-tablet adaptive width to mobile (was small tablet before)", () => {
    // 767 < 768 (SMALL_TABLET) — официальный хелпер даёт MOBILE,
    // ручные пороги раньше ошибочно давали SMALL_TABLET.
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 767, viewportHeight: 1080 })
    ).toEqual({ viewWidth: ViewWidth.MOBILE, viewHeight: ViewHeight.MEDIUM });
  });

  it("maps small-mobile width below 320px", () => {
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 319, viewportHeight: 414 })
    ).toEqual({ viewWidth: ViewWidth.SMALL_MOBILE, viewHeight: ViewHeight.EXTRA_SMALL });
  });

  it("maps adaptive widths to small tablet breakpoint", () => {
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 768, viewportHeight: 1080 })
    ).toEqual({ viewWidth: ViewWidth.SMALL_TABLET, viewHeight: ViewHeight.MEDIUM });
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 1023, viewportHeight: 1080 })
    ).toEqual({ viewWidth: ViewWidth.SMALL_TABLET, viewHeight: ViewHeight.MEDIUM });
  });

  it("maps adaptive widths to tablet breakpoint (1024–1279)", () => {
    // 1024 раньше ошибочно давал DESKTOP; TABLET — только с 1024 до 1279.
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 1024, viewportHeight: 1080 })
    ).toEqual({ viewWidth: ViewWidth.TABLET, viewHeight: ViewHeight.MEDIUM });
  });

  it("maps adaptive widths to desktop breakpoint from 1280", () => {
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 1280, viewportHeight: 1080 })
    ).toEqual({ viewWidth: ViewWidth.DESKTOP, viewHeight: ViewHeight.MEDIUM });
  });

  it("maps viewport height breakpoints", () => {
    // 414 < 415 → EXTRA_SMALL; 415..719 → SMALL; ≥ 720 → MEDIUM.
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 500, viewportHeight: 415 })
    ).toEqual({ viewWidth: ViewWidth.MOBILE, viewHeight: ViewHeight.SMALL });
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 500, viewportHeight: 719 })
    ).toEqual({ viewWidth: ViewWidth.MOBILE, viewHeight: ViewHeight.SMALL });
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 500, viewportHeight: 720 })
    ).toEqual({ viewWidth: ViewWidth.MOBILE, viewHeight: ViewHeight.MEDIUM });
  });
});
