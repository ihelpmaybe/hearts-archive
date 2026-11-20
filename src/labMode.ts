/** Lab seed / Foundry demos — off by default so real users aren’t confused. */

const KEY = "hearts-archive-lab";

export function isLabMode(): boolean {
  if (import.meta.env.VITE_LAB_SEED === "1") return true;
  try {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    if (q.get("lab") === "1") {
      localStorage.setItem(KEY, "1");
      return true;
    }
    if (q.get("lab") === "0") {
      localStorage.removeItem(KEY);
      return false;
    }
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
