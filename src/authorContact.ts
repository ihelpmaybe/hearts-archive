/** Author contact + tip prefs on the manifest (plain strings). */

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/g, "").slice(0, 64);
}

export function displayHandle(raw?: string): string {
  const h = normalizeHandle(raw || "");
  return h ? `@${h}` : "";
}

export function telegramUrl(handle?: string): string | null {
  const h = normalizeHandle(handle || "");
  return h ? `https://t.me/${encodeURIComponent(h)}` : null;
}

export function twitterUrl(handle?: string): string | null {
  const h = normalizeHandle(handle || "");
  return h ? `https://x.com/${encodeURIComponent(h)}` : null;
}

/** First matching tip preset id from a prefs string like "HEX, PLS, INC". */
export function preferredTipTokenId(
  tipPrefs: string | undefined,
  presetIds: string[],
): string | null {
  if (!tipPrefs?.trim()) return null;
  const parts = tipPrefs
    .split(/[,/|]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  for (const p of parts) {
    const hit = presetIds.find((id) => id.toUpperCase() === p);
    if (hit) return hit;
  }
  return null;
}
