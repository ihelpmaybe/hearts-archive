/** Drop-in theme packs — CSS vars only. No custom engine. */

import { publicUrl } from "./publicUrl";

export type ThemePack = {
  id: string;
  name: string;
  tagline?: string;
  eyebrow?: string;
  swatch?: string;
  fonts?: { display?: string; body?: string; google?: string };
  vars: Record<string, string>;
  /** User-made pack saved in this browser */
  local?: boolean;
};

export type ThemeIndex = {
  schema?: string;
  default?: string;
  packs: string[];
};

const FONT_LINK_ID = "ha-theme-fonts";
/** v5 — display: Venus · Light · Dark · Pulse (ids: venus/press/operator/pulse). */
const STORAGE_KEY = "hearts-archive-theme-v5";
const LOCAL_THEMES_KEY = "hearts-archive-themes-local-v1";

/** GitHub issue for community theme drops (same pack JSON). */
export const THEME_SUBMIT_REPO =
  "https://github.com/ihelpmaybe/hearts-archive/issues/new";

/** Colors creators edit — plain labels, not CSS jargon. */
export const THEME_COLOR_FIELDS: {
  key: string;
  label: string;
  hint: string;
  group: "paper" | "ink" | "accent" | "status";
}[] = [
  { key: "--bg", label: "Page", hint: "Background behind the paper", group: "paper" },
  { key: "--panel", label: "Surface", hint: "Cards and panels", group: "paper" },
  { key: "--panel-2", label: "Surface 2", hint: "Slightly raised / inset", group: "paper" },
  { key: "--line", label: "Rules", hint: "Lines, borders, rules", group: "paper" },
  { key: "--text", label: "Ink", hint: "Headlines and body", group: "ink" },
  { key: "--muted", label: "Quiet ink", hint: "Bylines, meta, hints", group: "ink" },
  { key: "--accent", label: "Accent", hint: "Links, kickers, focus", group: "accent" },
  { key: "--accent-hot", label: "Accent bright", hint: "Hover / emphasis", group: "accent" },
  { key: "--gold", label: "Gold", hint: "Ornament / highlight", group: "accent" },
  { key: "--ok", label: "OK", hint: "Success / on Pulse", group: "status" },
  { key: "--warn", label: "Warn", hint: "Caution", group: "status" },
  { key: "--bad", label: "Bad", hint: "Errors / wrong network", group: "status" },
];

export const THEME_COLOR_KEYS = THEME_COLOR_FIELDS.map((f) => f.key);

export const THEME_COLOR_GROUPS: {
  id: "paper" | "ink" | "accent" | "status";
  title: string;
  blurb: string;
}[] = [
  { id: "paper", title: "Paper", blurb: "Background, surfaces, rules" },
  { id: "ink", title: "Ink", blurb: "Reading text" },
  { id: "accent", title: "Accent", blurb: "Brand color on the face" },
  { id: "status", title: "Status", blurb: "Wallet and system messages" },
];

/**
 * Font packs for Make Theme.
 * Role map (must stay consistent):
 *   --font-nameplate = masthead title
 *   --font-display   = A1 / section heads
 *   --font-body      = article text
 *   --font-ui        = rail / chrome
 * `faces` string order: Nameplate · Heads · Body
 */
export const FONT_PRESETS: {
  id: string;
  label: string;
  /** Nameplate · Heads · Body */
  faces: string;
  fonts: NonNullable<ThemePack["fonts"]>;
  vars: Partial<Record<string, string>>;
}[] = [
  {
    id: "newsprint",
    label: "Newsprint",
    faces: "Playfair · Oswald · Newsreader",
    fonts: {
      display: "Oswald",
      body: "Newsreader",
      google:
        "Oswald:wght@500;600;700&family=Playfair+Display:wght@700;900&family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700&family=Libre+Franklin:wght@400;500;600",
    },
    vars: {
      "--font-nameplate": '"Playfair Display", Georgia, serif',
      "--font-display": '"Oswald", "Arial Narrow", Impact, sans-serif',
      "--font-body": '"Newsreader", Georgia, serif',
      "--font-ui": '"Libre Franklin", "Segoe UI", sans-serif',
    },
  },
  {
    id: "broadsheet",
    label: "Broadsheet",
    faces: "Libre Baskerville · Baskerville · Source Serif",
    fonts: {
      display: "Libre Baskerville",
      body: "Source Serif 4",
      google:
        "Libre+Baskerville:wght@400;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Libre+Franklin:wght@400;500;600",
    },
    vars: {
      "--font-nameplate": '"Libre Baskerville", Georgia, serif',
      "--font-display": '"Libre Baskerville", Georgia, serif',
      "--font-body": '"Source Serif 4", Georgia, serif',
      "--font-ui": '"Libre Franklin", "Segoe UI", sans-serif',
    },
  },
  {
    id: "magazine",
    label: "Magazine",
    faces: "Playfair · Playfair · Lora",
    fonts: {
      display: "Playfair Display",
      body: "Lora",
      google:
        "Playfair+Display:ital,wght@0,600;0,700;0,900;1,400&family=Lora:wght@400;500;600;700&family=Karla:wght@400;500;600",
    },
    vars: {
      "--font-nameplate": '"Playfair Display", Georgia, serif',
      "--font-display": '"Playfair Display", Georgia, serif',
      "--font-body": '"Lora", Georgia, serif',
      "--font-ui": '"Karla", "Segoe UI", sans-serif',
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    faces: "Cormorant · Cormorant · EB Garamond",
    fonts: {
      display: "Cormorant Garamond",
      body: "EB Garamond",
      google:
        "Cormorant+Garamond:wght@500;600;700&family=EB+Garamond:wght@400;500;600;700&family=Jost:wght@400;500;600",
    },
    vars: {
      "--font-nameplate": '"Cormorant Garamond", Georgia, serif',
      "--font-display": '"Cormorant Garamond", Georgia, serif',
      "--font-body": '"EB Garamond", Georgia, serif',
      "--font-ui": '"Jost", "Segoe UI", sans-serif',
    },
  },
  {
    id: "condensed",
    label: "Condensed",
    faces: "Bebas Neue · Bebas Neue · Newsreader",
    fonts: {
      display: "Bebas Neue",
      body: "Newsreader",
      google:
        "Bebas+Neue&family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700&family=Barlow+Condensed:wght@400;500;600",
    },
    vars: {
      "--font-nameplate": '"Bebas Neue", "Arial Narrow", sans-serif',
      "--font-display": '"Bebas Neue", "Arial Narrow", sans-serif',
      "--font-body": '"Newsreader", Georgia, serif',
      "--font-ui": '"Barlow Condensed", "Segoe UI", sans-serif',
    },
  },
  {
    id: "tabloid",
    label: "Tabloid",
    faces: "Anton · Anton · Roboto Slab",
    fonts: {
      display: "Anton",
      body: "Roboto Slab",
      google:
        "Anton&family=Roboto+Slab:wght@400;500;600;700&family=Roboto:wght@400;500;700",
    },
    vars: {
      "--font-nameplate": '"Anton", Impact, sans-serif',
      "--font-display": '"Anton", Impact, sans-serif',
      "--font-body": '"Roboto Slab", Georgia, serif',
      "--font-ui": '"Roboto", "Segoe UI", sans-serif',
    },
  },
  {
    id: "desk",
    label: "Desk",
    faces: "Plex Serif · Plex Sans · Plex Sans",
    fonts: {
      display: "IBM Plex Sans",
      body: "IBM Plex Sans",
      google:
        "IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@600;700",
    },
    vars: {
      "--font-nameplate": '"IBM Plex Serif", Georgia, serif',
      "--font-display": '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
      "--font-body": '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
      "--font-ui": '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    },
  },
  {
    id: "humanist",
    label: "Humanist",
    faces: "Source Serif · Source Sans · Source Serif",
    fonts: {
      display: "Source Sans 3",
      body: "Source Serif 4",
      google:
        "Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700",
    },
    vars: {
      "--font-nameplate": '"Source Serif 4", Georgia, serif',
      "--font-display": '"Source Sans 3", "Segoe UI", sans-serif',
      "--font-body": '"Source Serif 4", Georgia, serif',
      "--font-ui": '"Source Sans 3", "Segoe UI", sans-serif',
    },
  },
  {
    id: "modern",
    label: "Modern",
    faces: "Instrument Serif · Figtree · Figtree",
    fonts: {
      display: "Figtree",
      body: "Figtree",
      google: "Instrument+Serif&family=Figtree:wght@400;500;600;700",
    },
    vars: {
      "--font-nameplate": '"Instrument Serif", Georgia, serif',
      "--font-display": '"Figtree", "Segoe UI", sans-serif',
      "--font-body": '"Figtree", "Segoe UI", sans-serif',
      "--font-ui": '"Figtree", "Segoe UI", sans-serif',
    },
  },
  {
    id: "venus",
    label: "Display",
    faces: "Fraunces · Syne · DM Sans",
    fonts: {
      display: "Syne",
      body: "DM Sans",
      google:
        "Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700;9..144,900",
    },
    vars: {
      "--font-nameplate": '"Fraunces", Georgia, serif',
      "--font-display": '"Syne", "Avenir Next", sans-serif',
      "--font-body": '"DM Sans", "Segoe UI", sans-serif',
      "--font-ui": '"DM Sans", "Segoe UI", sans-serif',
    },
  },
  {
    id: "pulse",
    label: "Pulse",
    faces: "Orbitron · Space Grotesk · Plex Sans",
    fonts: {
      display: "Space Grotesk",
      body: "IBM Plex Sans",
      google:
        "Orbitron:wght@600;700&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600",
    },
    vars: {
      "--font-nameplate": '"Orbitron", "Space Grotesk", sans-serif',
      "--font-display": '"Space Grotesk", "Segoe UI", system-ui, sans-serif',
      "--font-body": '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
      "--font-ui": '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    },
  },
  {
    id: "mono",
    label: "Mono",
    faces: "Plex Mono · Plex Mono · Plex Sans",
    fonts: {
      display: "IBM Plex Mono",
      body: "IBM Plex Sans",
      google:
        "IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600",
    },
    vars: {
      "--font-nameplate": '"IBM Plex Mono", ui-monospace, monospace',
      "--font-display": '"IBM Plex Mono", ui-monospace, monospace',
      "--font-body": '"IBM Plex Sans", "Segoe UI", sans-serif',
      "--font-ui": '"IBM Plex Sans", "Segoe UI", sans-serif',
    },
  },
  {
    id: "system",
    label: "System",
    faces: "Georgia · Segoe UI · Segoe UI",
    fonts: {
      display: "Segoe UI",
      body: "Segoe UI",
    },
    vars: {
      "--font-nameplate": 'Georgia, "Times New Roman", serif',
      "--font-display": '"Segoe UI", system-ui, sans-serif',
      "--font-body": '"Segoe UI", system-ui, sans-serif',
      "--font-ui": '"Segoe UI", system-ui, sans-serif',
    },
  },
];

export function slugifyThemeId(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return s || `theme-${Date.now().toString(36)}`;
}

export function listLocalThemes(): ThemePack[] {
  try {
    const raw = localStorage.getItem(LOCAL_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ThemePack[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && typeof p.id === "string" && p.vars);
  } catch {
    return [];
  }
}

export function saveLocalTheme(pack: ThemePack): ThemePack {
  const next: ThemePack = { ...pack, local: true };
  const all = listLocalThemes().filter((p) => p.id !== next.id);
  all.unshift(next);
  localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(all.slice(0, 24)));
  return next;
}

export function deleteLocalTheme(id: string) {
  const all = listLocalThemes().filter((p) => p.id !== id);
  localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(all));
}

export function getLocalTheme(id: string): ThemePack | null {
  return listLocalThemes().find((p) => p.id === id) || null;
}

export function downloadThemePack(pack: ThemePack) {
  const clean: ThemePack = {
    id: pack.id,
    name: pack.name,
    tagline: pack.tagline,
    eyebrow: pack.eyebrow,
    swatch: pack.swatch,
    fonts: pack.fonts,
    vars: pack.vars,
  };
  const blob = new Blob([JSON.stringify(clean, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pack.id || "theme"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function themeSubmitUrl(pack: ThemePack): string {
  const title = `Theme: ${pack.name}`;
  const body = [
    `I'd like to submit a theme for Heart's Archive.`,
    "",
    `**Name:** ${pack.name}`,
    `**Tagline:** ${pack.tagline || "—"}`,
    `**Id:** \`${pack.id}\``,
    "",
    "A `.json` pack was downloaded from Make theme — happy to attach it here or paste below.",
    "",
    "<details><summary>Pack JSON</summary>",
    "",
    "```json",
    JSON.stringify(
      {
        id: pack.id,
        name: pack.name,
        tagline: pack.tagline,
        eyebrow: pack.eyebrow,
        swatch: pack.swatch,
        fonts: pack.fonts,
        vars: pack.vars,
      },
      null,
      2,
    ),
    "```",
    "",
    "</details>",
  ].join("\n");
  const u = new URL(THEME_SUBMIT_REPO);
  u.searchParams.set("title", title);
  u.searchParams.set("body", body.slice(0, 5500));
  return u.toString();
}

/** Snapshot current CSS vars into a starter pack. */
export function snapshotThemeFromDom(base?: Partial<ThemePack>): ThemePack {
  const cs = getComputedStyle(document.documentElement);
  const vars: Record<string, string> = {};
  for (const key of THEME_COLOR_KEYS) {
    const v = cs.getPropertyValue(key).trim();
    if (v) vars[key] = v.startsWith("#") || v.startsWith("rgb") ? v : v;
  }
  // Soft line from accent if missing
  if (!vars["--line-soft"] && vars["--line"]) {
    vars["--line-soft"] = vars["--line"];
  }
  vars["--bg-glow"] =
    cs.getPropertyValue("--bg-glow").trim() || "none";
  vars["--line-soft"] =
    cs.getPropertyValue("--line-soft").trim() || "rgba(0,0,0,0.18)";
  vars["--accent-dim"] =
    cs.getPropertyValue("--accent-dim").trim() || vars["--panel-2"] || "#222";
  vars["--radius"] = cs.getPropertyValue("--radius").trim() || "0px";
  for (const fk of [
    "--font-display",
    "--font-body",
    "--font-ui",
    "--font-nameplate",
  ]) {
    const v = cs.getPropertyValue(fk).trim();
    if (v) vars[fk] = v;
  }
  const name = base?.name || "My theme";
  const id = base?.id || slugifyThemeId(name);
  return {
    id,
    name,
    tagline: base?.tagline || "Custom · local",
    eyebrow: base?.eyebrow || `Heart’s Archive · ${name}`,
    swatch: vars["--accent"] || "#888888",
    fonts: base?.fonts,
    vars: { ...vars, ...(base?.vars || {}) },
    local: true,
  };
}

export function getStoredThemeId(fallback = "venus"): string {
  try {
    return (
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("hearts-archive-theme-v4") ||
      fallback
    );
  } catch {
    return fallback;
  }
}

export function storeThemeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* */
  }
}

export async function fetchThemeIndex(): Promise<ThemeIndex> {
  const res = await fetch(`${publicUrl("themes/index.json")}?ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`theme index ${res.status}`);
  return (await res.json()) as ThemeIndex;
}

export async function fetchThemePack(id: string): Promise<ThemePack> {
  const res = await fetch(
    `${publicUrl(`themes/${encodeURIComponent(id)}.json`)}?ts=${Date.now()}`,
    { cache: "no-store" },
  );
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
    default: "venus",
    packs: ["venus"],
  }));
  const wanted = id || getStoredThemeId(index.default || "venus");
  const local = getLocalTheme(wanted);
  if (local) {
    applyThemePack(local);
    return local;
  }
  const pick = index.packs.includes(wanted)
    ? wanted
    : index.default || index.packs[0] || "venus";
  const pack = await fetchThemePack(pick);
  applyThemePack(pack);
  return pack;
}

export async function listThemeSummaries(): Promise<
  {
    id: string;
    name: string;
    swatch?: string;
    tagline?: string;
    local?: boolean;
  }[]
> {
  const index = await fetchThemeIndex().catch(() => ({
    packs: [] as string[],
  }));
  const out: {
    id: string;
    name: string;
    swatch?: string;
    tagline?: string;
    local?: boolean;
  }[] = [];
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
  for (const p of listLocalThemes()) {
    if (out.some((x) => x.id === p.id)) continue;
    out.push({
      id: p.id,
      name: p.name,
      swatch: p.swatch,
      tagline: p.tagline,
      local: true,
    });
  }
  return out;
}

/** Built-in pack or local user pack. */
export async function resolveThemePack(id: string): Promise<ThemePack> {
  const local = getLocalTheme(id);
  if (local) return local;
  return fetchThemePack(id);
}
