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

  it("recognizes gallery + studio + wallet modes", async () => {
    vi.stubEnv("VITE_ARCHIVE_FACE", "gallery");
    const g = await import("./archiveFace");
    expect(g.isGalleryFace()).toBe(true);
    expect(g.isReadOnlyFace()).toBe(true);
    expect(g.walletMode()).toBe("demo");

    vi.resetModules();
    vi.stubEnv("VITE_ARCHIVE_FACE", "studio");
    const s = await import("./archiveFace");
    expect(s.isStudioFace()).toBe(true);
    expect(s.walletMode()).toBe("trezor");
    expect(s.isReadOnlyFace()).toBe(false);
  });

  it("forces gallery on github.io even if env says press", async () => {
    vi.stubEnv("VITE_ARCHIVE_FACE", "press");
    vi.stubGlobal("window", {
      location: { hostname: "ihelpmaybe.github.io" },
    });
    const { archiveFace, isGalleryFace, walletMode } = await import(
      "./archiveFace"
    );
    expect(archiveFace()).toBe("gallery");
    expect(isGalleryFace()).toBe(true);
    expect(walletMode()).toBe("demo");
  });
});
