/**
 * One repo, two faces — not two GitHubs.
 *
 * Desk  = develop / local publish / no wallet chrome
 * Press = what people use — Connect, chain Publish, Like, Tip, A1
 *
 * Override: VITE_ARCHIVE_FACE=desk|press
 * Default: vite `dev` → desk, `build` → press
 */
export type ArchiveFace = "desk" | "press";

export function archiveFace(): ArchiveFace {
  const raw = (import.meta.env.VITE_ARCHIVE_FACE || "").toLowerCase();
  if (raw === "desk" || raw === "press") return raw;
  return import.meta.env.DEV ? "desk" : "press";
}

export function isDeskFace(): boolean {
  return archiveFace() === "desk";
}

export function isPressFace(): boolean {
  return archiveFace() === "press";
}
