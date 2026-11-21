import { afterEach, describe, expect, it, vi } from "vitest";

describe("archiveFace", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("honors VITE_ARCHIVE_FACE over DEV", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ARCHIVE_FACE", "press");
    const { archiveFace, isPressFace, isDeskFace } = await import("./archiveFace");
    expect(archiveFace()).toBe("press");
    expect(isPressFace()).toBe(true);
    expect(isDeskFace()).toBe(false);
  });

  it("defaults to desk in DEV when unset", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ARCHIVE_FACE", "");
    const { archiveFace } = await import("./archiveFace");
    expect(archiveFace()).toBe("desk");
  });

  it("defaults to press in production when unset", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_ARCHIVE_FACE", "");
    const { archiveFace } = await import("./archiveFace");
    expect(archiveFace()).toBe("press");
  });
});
