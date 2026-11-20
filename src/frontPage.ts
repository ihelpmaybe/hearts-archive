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

/**
 * Newspaper hierarchy: highest PLS front-bid is the lead headline;
 * remaining stories fill secondary then briefs.
 */
export function layoutPressPage(
  cards: SeriesCard[],
  bids: FrontBidEntry[],
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
  const lead = leadHash ? byHash.get(leadHash) || null : cards[0];
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
