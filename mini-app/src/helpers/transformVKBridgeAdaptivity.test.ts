import { describe, expect, it } from "vitest";
import { transformVKBridgeAdaptivity } from "./transformVKBridgeAdaptivity";

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

  it("forces mobile viewport for force_mobile", () => {
    expect(
      transformVKBridgeAdaptivity({
        type: "force_mobile",
        viewportWidth: 1920,
        viewportHeight: 1080,
      })
    ).toEqual({ viewWidth: 2 });
  });

  it("forces mobile viewport for force_mobile_compact", () => {
    expect(
      transformVKBridgeAdaptivity({
        type: "force_mobile_compact",
        viewportWidth: 1920,
        viewportHeight: 1080,
      })
    ).toEqual({ viewWidth: 2 });
  });

  it("maps adaptive widths to small tablet breakpoint", () => {
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 767, viewportHeight: 1080 })
    ).toEqual({ viewWidth: 3 });
  });

  it("maps adaptive widths to tablet breakpoint", () => {
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 768, viewportHeight: 1080 })
    ).toEqual({ viewWidth: 4 });
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 1023, viewportHeight: 1080 })
    ).toEqual({ viewWidth: 4 });
  });

  it("maps adaptive widths to desktop breakpoint", () => {
    expect(
      transformVKBridgeAdaptivity({ type: "adaptive", viewportWidth: 1024, viewportHeight: 1080 })
    ).toEqual({ viewWidth: 5 });
  });
});
