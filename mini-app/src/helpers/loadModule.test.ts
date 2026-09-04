import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLazyModule, loadModule, MODULE_LOAD_ERROR_EVENT } from "./loadModule";

describe("module loading", () => {
  const dispatchEvent = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    dispatchEvent.mockReset();
  });

  it("returns a successfully loaded module", async () => {
    await expect(loadModule(async () => ({ value: 1 }))).resolves.toEqual({ value: 1 });
  });

  it("notifies the application and returns null on failure", async () => {
    vi.stubGlobal("dispatchEvent", dispatchEvent);

    await expect(loadModule(async () => Promise.reject(new Error("chunk failed")))).resolves.toBeNull();
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: MODULE_LOAD_ERROR_EVENT }),
    );
  });

  it("rejects lazy modules after notifying the application", async () => {
    vi.stubGlobal("dispatchEvent", dispatchEvent);
    await expect(
      loadLazyModule(async () => Promise.reject(new Error("chunk failed"))),
    ).rejects.toThrow("Application module failed to load");
  });
});
