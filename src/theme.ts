/** Drop-in theme packs — CSS vars only. No custom engine. */

export type ThemePack = {
  id: string;
  name: string;
  tagline?: string;
  eyebrow?: string;
  swatch?: string;
  fonts?: { display?: string; body?: string; google?: string };
  vars: Record<string, string>;
};

export type ThemeIndex = {
  schema?: string;
  default?: string;
  packs: string[];
};

const STORAGE_KEY = "hearts-archive-theme";
const FONT_LINK_ID = "ha-theme-fonts";

const STORAGE_KEY_V2 = "hearts-archive-theme-v2";

export function getStoredThemeId(fallback = "press"): string {
  try {
    return (
      localStorage.getItem(STORAGE_KEY_V2) ||
      localStorage.getItem(STORAGE_KEY) ||
      fallback
    );
  } catch {
    return fallback;
  }
}

export function storeThemeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY_V2, id);
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* */
  }
}

export async function fetchThemeIndex(): Promise<ThemeIndex> {
  const res = await fetch(`/themes/index.json?ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`theme index ${res.status}`);
  return (await res.json()) as ThemeIndex;
}

export async function fetchThemePack(id: string): Promise<ThemePack> {
  const res = await fetch(`/themes/${encodeURIComponent(id)}.json?ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`theme ${id}: ${res.status}`);
  return (await res.json()) as ThemePack;
}

function ensureGoogleFont(google?: string) {
  const existing = document.getElementById(FONT_LINK_ID);
  if (!google) {
    existing?.remove();
    return;
  }
  const href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
  if (existing instanceof HTMLLinkElement) {
    if (existing.href !== href) existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** Apply pack to <html> via data-theme + CSS custom properties. */
export function applyThemePack(pack: ThemePack) {
  const root = document.documentElement;
  root.setAttribute("data-theme", pack.id);
  for (const [key, value] of Object.entries(pack.vars || {})) {
    if (!key.startsWith("--")) continue;
    root.style.setProperty(key, value);
  }
  if (pack.vars["--font-body"]) {
    root.style.setProperty("font-family", pack.vars["--font-body"]);
  }
  ensureGoogleFont(pack.fonts?.google);
  storeThemeId(pack.id);
}

export async function loadAndApplyTheme(id?: string): Promise<ThemePack> {
  const index = await fetchThemeIndex().catch(() => ({
    default: "press",
    packs: ["press"],
  }));
  const wanted = id || getStoredThemeId(index.default || "press");
  const pick = index.packs.includes(wanted)
    ? wanted
    : index.default || index.packs[0] || "press";
  const pack = await fetchThemePack(pick);
  applyThemePack(pack);
  return pack;
}

export async function listThemeSummaries(): Promise<
  { id: string; name: string; swatch?: string; tagline?: string }[]
> {
  const index = await fetchThemeIndex();
  const out = [];
  for (const id of index.packs) {
    try {
      const p = await fetchThemePack(id);
      out.push({
        id: p.id,
        name: p.name,
        swatch: p.swatch,
        tagline: p.tagline,
      });
    } catch {
      /* skip broken pack */
    }
  }
  return out;
}
