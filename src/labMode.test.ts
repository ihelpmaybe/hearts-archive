import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

describe("labMode", () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    vi.stubGlobal("window", {
      location: { search: "" },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("Press prod ignores sticky lab without ?lab=1", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ARCHIVE_FACE", "press");
    vi.stubEnv("VITE_LAB_SEED", "");
    store.set("hearts-archive-lab", "1");
    const { isLabMode } = await import("./labMode");
    expect(isLabMode()).toBe(false);
  });

  it("Desk honors sticky lab", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ARCHIVE_FACE", "desk");
    store.set("hearts-archive-lab", "1");
    const { isLabMode } = await import("./labMode");
    expect(isLabMode()).toBe(true);
  });
});
