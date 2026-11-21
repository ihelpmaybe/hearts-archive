import type { FrontBidEntry } from "./archive";
import type { SeriesCard } from "./series";

export type PressLayout = {
  lead: SeriesCard | null;
  secondary: SeriesCard[];
  briefs: SeriesCard[];
  /** Winning front bid (may point at lead). */
  front: FrontBidEntry | null;
  /** Flat order for keyboard nav. */
  flat: SeriesCard[];
};

export type PressLayoutOpts = {
  /**
   * Open / unpublished paper: never invent an A1 from “first card”.
   * No qualifying bid → lead stays empty.
   */
  requireBidForLead?: boolean;
};

/**
 * Newspaper hierarchy: highest PLS front-bid is the lead headline;
 * remaining stories fill secondary then briefs.
 */
export function layoutPressPage(
  cards: SeriesCard[],
  bids: FrontBidEntry[],
  opts?: PressLayoutOpts,
): PressLayout {
  if (!cards.length) {
    return { lead: null, secondary: [], briefs: [], front: null, flat: [] };
  }

  const byHash = new Map(
    cards.map((c) => [c.entry.hash.toLowerCase(), c] as const),
  );
  const eligible = bids
    .filter((b) => byHash.has(b.manifest.toLowerCase()))
    .sort((a, b) => {
      if (b.valueWei !== a.valueWei) return b.valueWei > a.valueWei ? 1 : -1;
      return b.timeStamp - a.timeStamp;
    });

  const front = eligible[0] || null;
  const leadHash = front?.manifest.toLowerCase() || null;
  const lead = leadHash
    ? byHash.get(leadHash) || null
    : opts?.requireBidForLead
      ? null
      : cards[0];
  const leadKey = lead?.entry.hash.toLowerCase() || "";

  const rest = cards
    .filter((c) => c.entry.hash.toLowerCase() !== leadKey)
    .sort((a, b) => {
      const ba = bids.find(
        (x) => x.manifest.toLowerCase() === a.entry.hash.toLowerCase(),
      );
      const bb = bids.find(
        (x) => x.manifest.toLowerCase() === b.entry.hash.toLowerCase(),
      );
      const va = ba?.valueWei ?? 0n;
      const vb = bb?.valueWei ?? 0n;
      if (vb !== va) return vb > va ? 1 : -1;
      return (b.entry.timeStamp || 0) - (a.entry.timeStamp || 0);
    });

  const secondary = rest.slice(0, 2);
  const briefs = rest.slice(2);
  const flat = lead ? [lead, ...rest] : rest;
  return { lead, secondary, briefs, front, flat };
}

export function formatPls(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return whole.toString();
  const s = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${s.slice(0, 4)}`;
}

export type FrontBidStats = {
  /** Current A1 (highest bid), if any. */
  currentWei: bigint | null;
  /** PLS needed to take A1 (current + 1 wei, or 1 wei if open). */
  takeWei: bigint;
  /** Mean of best-per-manifest bids. */
  avgWei: bigint | null;
  /** How many distinct stories have a front bid. */
  count: number;
};

/** Current A1 + average front-page bid (best bid per story). */
export function frontBidStats(bids: FrontBidEntry[]): FrontBidStats {
  const ranked = [...bids].sort((a, b) => {
    if (b.valueWei !== a.valueWei) return b.valueWei > a.valueWei ? 1 : -1;
    return b.timeStamp - a.timeStamp;
  });
  // Prefer caller already deduped; still collapse by manifest here.
  const best = new Map<string, FrontBidEntry>();
  for (const b of ranked) {
    const key = b.manifest.toLowerCase();
    if (!best.has(key)) best.set(key, b);
  }
  const values = [...best.values()].map((b) => b.valueWei);
  const count = values.length;
  if (!count) {
    return { currentWei: null, takeWei: 1n, avgWei: null, count: 0 };
  }
  const currentWei = values.reduce((a, b) => (b > a ? b : a), 0n);
  const sum = values.reduce((a, b) => a + b, 0n);
  const avgWei = sum / BigInt(count);
  return {
    currentWei,
    takeWei: currentWei + 1n,
    avgWei,
    count,
  };
}

/** One-line Write hint: open A1 for a printed day (bid only — not gas). */
export function formatFrontPriceHint(
  stats: FrontBidStats,
  forDayLabel = "Open",
): string {
  if (stats.count === 0 || stats.currentWei == null || stats.avgWei == null) {
    return `${forDayLabel} A1 open — PLS only (not gas · rebid until that day’s UTC midnight). Tip the writer anything.`;
  }
  return `${forDayLabel} A1 ${formatPls(stats.currentWei)} PLS · avg ${formatPls(stats.avgWei)} PLS (${stats.count}) — PLS only, not gas · rebid until that day’s UTC midnight. Tip the writer anything.`;
}
