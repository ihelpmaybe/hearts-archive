/**
 * One repo, several faces — not several GitHubs.
 *
 * Desk    = develop / local publish / no wallet chrome
 * Press   = injected wallet (MetaMask / Rabby)
 * Gallery = read-only paper + Demo chip (Pages peek + Capacitor phone)
 * Studio  = desktop Trezor Connect publisher
 *
 * Override: VITE_ARCHIVE_FACE=desk|press|gallery|studio
 * Default: vite `dev` → desk, `build` → press
 */
export type ArchiveFace = "desk" | "press" | "gallery" | "studio";

export type WalletMode = "off" | "demo" | "injected" | "trezor";

export function archiveFace(): ArchiveFace {
  const raw = (import.meta.env.VITE_ARCHIVE_FACE || "").toLowerCase();
  if (
    raw === "desk" ||
    raw === "press" ||
    raw === "gallery" ||
    raw === "studio"
  ) {
    return raw;
  }
  return import.meta.env.DEV ? "desk" : "press";
}

export function isDeskFace(): boolean {
  return archiveFace() === "desk";
}

export function isPressFace(): boolean {
  return archiveFace() === "press";
}

export function isGalleryFace(): boolean {
  return archiveFace() === "gallery";
}

export function isStudioFace(): boolean {
  return archiveFace() === "studio";
}

/** Gallery (and Capacitor shell) — Sync/read only; tip QR + copy, no spend. */
export function isReadOnlyFace(): boolean {
  return archiveFace() === "gallery";
}

export function walletMode(): WalletMode {
  const face = archiveFace();
  if (face === "desk") return "off";
  if (face === "gallery") return "demo";
  if (face === "studio") return "trezor";
  return "injected";
}
