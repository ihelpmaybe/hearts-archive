import type { FrontBidEntry } from "./archive";
import type { SeriesCard } from "./series";

/** Paid front face — only these letters sit above the fold as A. */
export const FRONT_A_COUNT = 3;
/** Stories per inside letter (B1–B12, then C1…). */
export const SECTION_PAGE_SIZE = 12;

export type PressSlot = {
  /** A1 · A2 · A3 · B1 · C4 … */
  label: string;
  card: SeriesCard;
  bid: FrontBidEntry | null;
};

export type PressLayout = {
  lead: SeriesCard | null;
  /** A2 + A3 (compat / column face). */
  secondary: SeriesCard[];
  /** @deprecated use `inside` — kept as alias of inside cards. */
  briefs: SeriesCard[];
  /** A1 bid. */
  front: FrontBidEntry | null;
  /** A2 bid. */
  a2: FrontBidEntry | null;
  /** A3 bid. */
  a3: FrontBidEntry | null;
  /** Ordered A1–A3 face slots (bid-backed on Open). */
  aFace: PressSlot[];
  /** B1+ … then C… D… after the A front is full. */
  inside: PressSlot[];
  /** Flat order for keyboard nav. */
  flat: SeriesCard[];
};

export type PressLayoutOpts = {
  /**
   * Open / unpublished paper: never invent an A1 from “first card”.
   * No qualifying bid → lead stays empty. A2/A3 also require bids.
   */
  requireBidForLead?: boolean;
};

/**
 * B=0 → "B" … Z=24 → "Z", then AA, AB… (no silent Z collision on huge papers).
 */
export function sectionLetter(pageIndex: number): string {
  const i = Math.max(0, pageIndex);
  if (i < 25) return String.fromCharCode(66 + i); // B–Z
  const o = i - 25;
  const hi = Math.floor(o / 26);
  const lo = o % 26;
  return `${String.fromCharCode(65 + hi)}${String.fromCharCode(65 + lo)}`;
}

/** 0-based rank after A front → B1, B2, … B12, C1, … AA1… */
export function insideSlotLabel(index0: number): string {
  const page = Math.floor(index0 / SECTION_PAGE_SIZE);
  const n = (index0 % SECTION_PAGE_SIZE) + 1;
  return `${sectionLetter(page)}${n}`;
}

function bestBidsByManifest(
  cards: SeriesCard[],
  bids: FrontBidEntry[],
): Map<string, FrontBidEntry> {
  const byHash = new Set(cards.map((c) => c.entry.hash.toLowerCase()));
  const best = new Map<string, FrontBidEntry>();
  for (const b of bids) {
    const key = b.manifest.toLowerCase();
    if (!byHash.has(key)) continue;
    const prev = best.get(key);
    if (
      !prev ||
      b.valueWei > prev.valueWei ||
      (b.valueWei === prev.valueWei && b.timeStamp > prev.timeStamp)
    ) {
      best.set(key, b);
    }
  }
  return best;
}

function rankCards(
  cards: SeriesCard[],
  best: Map<string, FrontBidEntry>,
): SeriesCard[] {
  return [...cards].sort((a, b) => {
    const ba = best.get(a.entry.hash.toLowerCase());
    const bb = best.get(b.entry.hash.toLowerCase());
    const va = ba?.valueWei ?? 0n;
    const vb = bb?.valueWei ?? 0n;
    if (vb !== va) return vb > va ? 1 : -1;
    return (b.entry.timeStamp || 0) - (a.entry.timeStamp || 0);
  });
}

/**
 * A1–A3 = top three paid bids (front).
 * Rank 4+ → B1…B12, then C1…, D1… (SECTION_PAGE_SIZE each).
 * Unbid stories never take A on an Open paper; they fill B+ after paid ranks.
 */
export function layoutPressPage(
  cards: SeriesCard[],
  bids: FrontBidEntry[],
  opts?: PressLayoutOpts,
): PressLayout {
  const empty: PressLayout = {
    lead: null,
    secondary: [],
    briefs: [],
    front: null,
    a2: null,
    a3: null,
    aFace: [],
    inside: [],
    flat: [],
  };
  if (!cards.length) return empty;

  const byHash = new Map(
    cards.map((c) => [c.entry.hash.toLowerCase(), c] as const),
  );
  const best = bestBidsByManifest(cards, bids);
  const rankedBids = [...best.values()].sort((a, b) => {
    if (b.valueWei !== a.valueWei) return b.valueWei > a.valueWei ? 1 : -1;
    return b.timeStamp - a.timeStamp;
  });

  const aFace: PressSlot[] = [];
  for (let i = 0; i < FRONT_A_COUNT; i++) {
    const bid = rankedBids[i];
    if (!bid) break;
    const card = byHash.get(bid.manifest.toLowerCase());
    if (!card) continue;
    aFace.push({ label: `A${i + 1}`, card, bid });
  }

  // Closed final with zero bids: still show a chronological A1 so the paper isn’t blank
  if (!aFace.length && !opts?.requireBidForLead) {
    const fallback = rankCards(cards, best)[0];
    if (fallback) {
      aFace.push({
        label: "A1",
        card: fallback,
        bid: best.get(fallback.entry.hash.toLowerCase()) || null,
      });
    }
  }

  const aKeys = new Set(
    aFace.map((s) => s.card.entry.hash.toLowerCase()),
  );
  const rest = rankCards(
    cards.filter((c) => !aKeys.has(c.entry.hash.toLowerCase())),
    best,
  );
  const inside: PressSlot[] = rest.map((card, i) => ({
    label: insideSlotLabel(i),
    card,
    bid: best.get(card.entry.hash.toLowerCase()) || null,
  }));

  const lead = aFace[0]?.card || null;
  const secondary = aFace.slice(1).map((s) => s.card);
  const briefs = inside.map((s) => s.card);
  const flat = [...aFace, ...inside].map((s) => s.card);

  return {
    lead,
    secondary,
    briefs,
    front: aFace[0]?.bid || null,
    a2: aFace[1]?.bid || null,
    a3: aFace[2]?.bid || null,
    aFace,
    inside,
    flat,
  };
}

/** Group B1… / C1… bands for the face. */
export function groupInsideByLetter(
  inside: PressSlot[],
): { letter: string; slots: PressSlot[] }[] {
  const map = new Map<string, PressSlot[]>();
  for (const s of inside) {
    const letter = s.label.replace(/\d+$/, "") || "B";
    const row = map.get(letter);
    if (row) row.push(s);
    else map.set(letter, [s]);
  }
  return [...map.entries()].map(([letter, slots]) => ({ letter, slots }));
}

export function formatPls(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return whole.toString();
  const s = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${s.slice(0, 4)}`;
}

export type FrontBidStats = {
  currentWei: bigint | null;
  takeWei: bigint;
  avgWei: bigint | null;
  count: number;
};

/** Current A1 + average front-page bid (best bid per story). */
export function frontBidStats(bids: FrontBidEntry[]): FrontBidStats {
  const ranked = [...bids].sort((a, b) => {
    if (b.valueWei !== a.valueWei) return b.valueWei > a.valueWei ? 1 : -1;
    return b.timeStamp - a.timeStamp;
  });
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

export function formatFrontPriceHint(
  stats: FrontBidStats,
  forDayLabel = "Open",
): string {
  if (stats.count === 0 || stats.currentWei == null || stats.avgWei == null) {
    return `${forDayLabel} A1–A3 open — bid PLS to own the lead (not gas). Rebid until that day’s UTC midnight. Like ≠ tip ≠ bid.`;
  }
  return `${forDayLabel} A1 ${formatPls(stats.currentWei)} PLS · need >${formatPls(stats.takeWei - 1n)} to take lead · avg ${formatPls(stats.avgWei)} (${stats.count}) · top 3 = A1–A3 · next B1+ · PLS only`;
}
