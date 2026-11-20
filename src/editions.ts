import type { FrontBidEntry } from "./archive";
import { layoutPressPage, type PressLayout } from "./frontPage";
import type { SeriesCard } from "./series";

/** UTC calendar day key YYYY-MM-DD */
export function utcDayKey(unixSec: number): string {
  if (!unixSec || unixSec <= 0) return "";
  const d = new Date(unixSec * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function utcDayEndSec(dayKey: string): number {
  // Exclusive end = start of next UTC day
  const [y, m, d] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d! + 1) / 1000);
}

export function utcTodayKey(): string {
  return utcDayKey(Math.floor(Date.now() / 1000));
}

/** Bids that existed at end of that UTC day (timeStamp < next midnight). */
export function bidsAsOfDay(
  bids: FrontBidEntry[],
  dayKey: string,
): FrontBidEntry[] {
  const end = utcDayEndSec(dayKey);
  return bids.filter((b) => b.timeStamp > 0 && b.timeStamp < end);
}

/** Distinct UTC days that have at least one front bid, newest first. */
export function listEditionDays(bids: FrontBidEntry[], limit = 14): string[] {
  const set = new Set<string>();
  for (const b of bids) {
    const k = utcDayKey(b.timeStamp);
    if (k) set.add(k);
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, limit);
}

export function formatEditionLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Live = all bids. Dated = bids as of end of that UTC day.
 * Lead story must still exist in the card set.
 */
export function layoutEdition(
  cards: SeriesCard[],
  bids: FrontBidEntry[],
  dayKey: string | "live",
): PressLayout {
  if (dayKey === "live") return layoutPressPage(cards, bids);
  return layoutPressPage(cards, bidsAsOfDay(bids, dayKey));
}
