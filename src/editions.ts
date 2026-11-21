import {
  frontBidPrintedDay,
  type FrontBidEntry,
} from "./archive";
import { layoutPressPage, type PressLayout } from "./frontPage";
import type { SeriesCard } from "./series";

/**
 * Max days ahead you may schedule A1 / open publish (UTC).
 * Tx lands at **today’s** tip; too far ahead and Sync can’t see it when the paper day arrives.
 */
export const OPEN_HORIZON_DAYS = 30;

/**
 * Max days Sync will walk back (UTC).
 * Must be ≥ schedule horizon: post today for +30d, user returns day 59 → still inside 60d.
 * Daily users barely pay — known-tx streak stops at the tip.
 */
export const SYNC_LOOKBACK_DAYS = OPEN_HORIZON_DAYS * 2;

/**
 * How far back Sync should walk (unix sec).
 * Gone 29 days → ~29 days. Cold / ancient → SYNC_LOOKBACK_DAYS max.
 * Overlaps last Sync by 2 minutes so we don’t miss a race.
 */
export function syncLookbackCutoffUnix(opts?: {
  lastSyncMs?: number | null;
  nowSec?: number;
  lookbackDays?: number;
}): number {
  const lookbackDays = opts?.lookbackDays ?? SYNC_LOOKBACK_DAYS;
  const now = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const earliest = now - lookbackDays * 86400;
  const last = opts?.lastSyncMs;
  if (!last || last <= 0) return earliest;
  const since = Math.floor(last / 1000) - 120;
  return Math.max(earliest, since);
}

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

export function utcDayStartSec(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 1000);
}

export function utcTodayKey(): string {
  return utcDayKey(Math.floor(Date.now() / 1000));
}

/** Shift a YYYY-MM-DD key by whole UTC days. */
export function shiftUtcDay(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = Date.UTC(y!, m! - 1, d! + deltaDays);
  return utcDayKey(Math.floor(t / 1000));
}

/**
 * Edition view:
 * - `"open"` = tomorrow’s paper (alias)
 * - future `YYYY-MM-DD` = that open paper (≤ today+OPEN_HORIZON_DAYS)
 * - today/past `YYYY-MM-DD` = that day’s closed final
 */
export type EditionView = "open" | string;

/** Calendar day shown in the dateline. */
export function editionCursor(edition: EditionView): string {
  if (edition === "open" || edition === "live") {
    return shiftUtcDay(utcTodayKey(), 1);
  }
  return edition;
}

export function isOpenEdition(edition: EditionView): boolean {
  if (edition === "open" || edition === "live") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edition)) return false;
  return edition > utcTodayKey();
}

export function maxOpenEditionDay(todayKey = utcTodayKey()): string {
  return shiftUtcDay(todayKey, OPEN_HORIZON_DAYS);
}

/**
 * Schedulable open printed day: after today and within OPEN_HORIZON_DAYS.
 * (Display of older scheduled bids can still use isOpenEdition.)
 */
export function isOpenPrintedDay(
  dayKey: string,
  todayKey = utcTodayKey(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return false;
  if (dayKey <= todayKey) return false;
  return dayKey <= maxOpenEditionDay(todayKey);
}

/** Open days you can pick in the UI (tomorrow … horizon). */
export function listOpenEditionDays(
  horizon = OPEN_HORIZON_DAYS,
  todayKey = utcTodayKey(),
): string[] {
  const out: string[] = [];
  for (let i = 1; i <= horizon; i++) {
    out.push(shiftUtcDay(todayKey, i));
  }
  return out;
}

/**
 * Bids that claim printed day P and were placed before P starts
 * (paper freezes at prior UTC midnight).
 */
export function bidsForPrintedDay(
  bids: FrontBidEntry[],
  printedDayKey: string,
): FrontBidEntry[] {
  const start = utcDayStartSec(printedDayKey);
  return bids.filter((b) => {
    if (frontBidPrintedDay(b) !== printedDayKey) return false;
    return b.timeStamp > 0 && b.timeStamp < start;
  });
}

/** @deprecated alias — bids as of end of day (legacy helper). */
export function bidsAsOfDay(
  bids: FrontBidEntry[],
  dayKey: string,
): FrontBidEntry[] {
  const end = utcDayEndSec(dayKey);
  return bids.filter((b) => b.timeStamp > 0 && b.timeStamp < end);
}

/** Bids placed on that UTC calendar day only (legacy). */
export function bidsOnDay(
  bids: FrontBidEntry[],
  dayKey: string,
): FrontBidEntry[] {
  return bids.filter((b) => utcDayKey(b.timeStamp) === dayKey);
}

/**
 * Printed paper for calendar day D = bids that claim D
 * (legacy bids filed on D−1 count via printed-day derivation).
 */
export function printedBidsForDay(
  bids: FrontBidEntry[],
  printedDayKey: string,
): FrontBidEntry[] {
  return bidsForPrintedDay(bids, printedDayKey);
}

/**
 * Open paper for printed day P (default = tomorrow).
 * Any bid claiming P placed before P starts.
 */
export function openEditionBids(
  bids: FrontBidEntry[],
  printedDayKey = shiftUtcDay(utcTodayKey(), 1),
): FrontBidEntry[] {
  return bidsForPrintedDay(bids, printedDayKey);
}

/** Distinct UTC days that have at least one front bid, newest first. */
export function listEditionDays(bids: FrontBidEntry[], limit = 14): string[] {
  const printed = new Set<string>();
  for (const b of bids) {
    const p = frontBidPrintedDay(b);
    if (p) printed.add(p);
  }
  printed.add(utcTodayKey());
  printed.add(shiftUtcDay(utcTodayKey(), 1)); // always offer tomorrow
  return [...printed]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, limit);
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
 * Stories that belong on this edition’s face — not the whole archive.
 * Open P = bids claiming P and/or stories filed on the day before P.
 * Final D = same freeze set.
 */
export function cardsForEdition(
  cards: SeriesCard[],
  bids: FrontBidEntry[],
  edition: EditionView,
): SeriesCard[] {
  const printed = editionCursor(edition);
  const dayBids = bidsForPrintedDay(bids, printed);
  const bidManifests = new Set(dayBids.map((b) => b.manifest.toLowerCase()));
  const fileDay = shiftUtcDay(printed, -1);
  return cards.filter((c) => {
    const h = c.entry.hash.toLowerCase();
    if (bidManifests.has(h)) return true;
    return utcDayKey(c.entry.timeStamp) === fileDay;
  });
}

/**
 * Open = future printed days (A1 still racing).
 * Dated ≤ today = closed final.
 */
export function layoutEdition(
  cards: SeriesCard[],
  bids: FrontBidEntry[],
  edition: EditionView,
): PressLayout {
  const printed = editionCursor(edition);
  const dayBids = bidsForPrintedDay(bids, printed);
  const scoped = cardsForEdition(cards, bids, edition);
  return layoutPressPage(scoped, dayBids, {
    requireBidForLead: isOpenEdition(edition),
  });
}
