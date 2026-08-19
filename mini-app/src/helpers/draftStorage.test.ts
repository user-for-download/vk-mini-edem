import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDraft, readDraft, writeDraft } from "./draftStorage";

function installStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("draft storage", () => {
  it("persists and clears JSON drafts under a namespaced key", () => {
    installStorage();
    writeDraft("trip:1", { city: "Москва" });
    expect(readDraft("trip:1")).toEqual({ city: "Москва" });
    clearDraft("trip:1");
    expect(readDraft("trip:1")).toBeNull();
  });

  it("fails safely when WebView storage is unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
        removeItem: () => {
          throw new Error("denied");
        },
      },
    });
    expect(() => writeDraft("trip:1", {})).not.toThrow();
    expect(readDraft("trip:1")).toBeNull();
    expect(() => clearDraft("trip:1")).not.toThrow();
  });
});
