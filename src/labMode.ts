/** Lab seed / Foundry demos — off by default so real users aren’t confused. */

const KEY = "hearts-archive-lab";

function queryLab(): "on" | "off" | null {
  try {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search);
    if (q.get("lab") === "1") return "on";
    if (q.get("lab") === "0") return "off";
    return null;
  } catch {
    return null;
  }
}

/**
 * Lab is on when:
 * - `VITE_LAB_SEED=1`, or
 * - `?lab=1` (sticky in localStorage), or
 * - checkbox turned on (Desk / explicit setLabMode)
 *
 * Press face: sticky localStorage alone is NOT enough — need `?lab=1` or env
 * so a prior Desk session doesn’t poison the public paper.
 */
export function isLabMode(): boolean {
  if (import.meta.env.VITE_LAB_SEED === "1") return true;
  const q = queryLab();
  if (q === "on") {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* */
    }
    return true;
  }
  if (q === "off") {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* */
    }
    return false;
  }
  // Production Press build: ignore sticky lab unless query/env said so.
  if (import.meta.env.PROD && import.meta.env.VITE_ARCHIVE_FACE !== "desk") {
    return false;
  }
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setLabMode(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* */
  }
}

/** True when Lab was opened via ?lab=1 this session (demo path). */
export function labOpenedViaQuery(): boolean {
  return queryLab() === "on" || import.meta.env.VITE_LAB_SEED === "1";
}
