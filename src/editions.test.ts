import { describe, expect, it } from "vitest";
import type { FrontBidEntry } from "./archive";
import {
  bidsAsOfDay,
  editionCursor,
  isOpenEdition,
  layoutEdition,
  listEditionDays,
  isOpenPrintedDay,
  listOpenEditionDays,
  maxOpenEditionDay,
  openEditionBids,
  OPEN_HORIZON_DAYS,
  printedBidsForDay,
  shiftUtcDay,
  SYNC_LOOKBACK_DAYS,
  syncLookbackCutoffUnix,
  utcDayKey,
} from "./editions";
import type { SeriesCard } from "./series";

function card(hash: string, title: string): SeriesCard {
  return {
    entry: {
      hash: hash as `0x${string}`,
      from: "0xabc",
      timeStamp: 1,
      title,
      mimeType: "text/plain",
      type: "text",
      tags: [],
      chunkCount: 1,
    },
    olderCount: 0,
  };
}

function bid(
  manifest: string,
  wei: bigint,
  timeStamp: number,
  forDay?: string,
): FrontBidEntry {
  return {
    hash: ("0x" + timeStamp.toString(16).padStart(64, "0")) as `0x${string}`,
    from: "0x1",
    timeStamp,
    manifest: manifest as `0x${string}`,
    valueWei: wei,
    ...(forDay ? { forDay } : {}),
  };
}

describe("editions", () => {
  const a = card("0x" + "a".repeat(64), "Alpha");
  const b = card("0x" + "b".repeat(64), "Bravo");

  // 2026-11-19 12:00 UTC and 2026-11-20 12:00 UTC
  const dayA = Math.floor(Date.UTC(2026, 10, 19, 12, 0, 0) / 1000);
  const dayB = Math.floor(Date.UTC(2026, 10, 20, 12, 0, 0) / 1000);

  it("keys UTC days", () => {
    expect(utcDayKey(dayA)).toBe("2026-11-19");
    expect(utcDayKey(dayB)).toBe("2026-11-20");
  });

  it("today’s final paper locks at prior midnight", () => {
    const bids = [
      bid(a.entry.hash, 5n * 10n ** 18n, dayA),
      bid(b.entry.hash, 20n * 10n ** 18n, dayB),
    ];
    // Printed 2026-11-20 = legacy bids filed 2026-11-19 → Alpha
    expect(printedBidsForDay(bids, "2026-11-20")).toHaveLength(1);
    const printed = layoutEdition([a, b], bids, "2026-11-20");
    expect(printed.lead?.entry.title).toBe("Alpha");
  });

  it("open edition uses printed-day bids (legacy = bid day + 1)", () => {
    const bids = [
      bid(a.entry.hash, 5n * 10n ** 18n, dayA),
      bid(b.entry.hash, 20n * 10n ** 18n, dayB),
    ];
    // Bid on Nov 20 → claims Nov 21 paper
    expect(openEditionBids(bids, "2026-11-21")).toHaveLength(1);
    expect(openEditionBids(bids, "2026-11-21")[0]!.valueWei).toBe(
      20n * 10n ** 18n,
    );
    expect(isOpenEdition("open")).toBe(true);
    expect(isOpenEdition("2026-11-19")).toBe(false);
    expect(bidsAsOfDay(bids, "2026-11-19")).toHaveLength(1);
  });

  it("forDay within horizon; year-ahead not schedulable", () => {
    const now = Math.floor(Date.now() / 1000);
    const today = utcDayKey(now);
    const plus3 = shiftUtcDay(today, 3);
    const fresh = card("0x" + "c".repeat(64), "Fresh");
    fresh.entry.timeStamp = now;
    const bids = [bid(fresh.entry.hash, 25n * 10n ** 18n, now, plus3)];
    const open = layoutEdition([fresh], bids, plus3);
    expect(isOpenEdition(plus3)).toBe(true);
    expect(isOpenPrintedDay(plus3)).toBe(true);
    expect(isOpenPrintedDay(today)).toBe(false);
    expect(open.lead?.entry.title).toBe("Fresh");
    expect(listOpenEditionDays()).toHaveLength(OPEN_HORIZON_DAYS);
    expect(maxOpenEditionDay(today)).toBe(
      shiftUtcDay(today, OPEN_HORIZON_DAYS),
    );
    const far = shiftUtcDay(today, 400);
    expect(isOpenPrintedDay(far, today)).toBe(false);
    // Chain may still hold a far bid; Sync tip is why we refuse to schedule it
    const farBid = [bid(fresh.entry.hash, 1n * 10n ** 18n, now, far)];
    expect(openEditionBids(farBid, far)).toHaveLength(1);
  });

  it("open with no matching bids has empty A1 (not Final’s lead)", () => {
    const bids = [bid(a.entry.hash, 5n * 10n ** 18n, dayA)];
    const open = layoutEdition([a, b], bids, "open");
    if (utcDayKey(dayA) !== utcDayKey(Math.floor(Date.now() / 1000))) {
      // tomorrow’s paper unless dayA+1 is tomorrow
      const tomorrow = shiftUtcDay(utcDayKey(Math.floor(Date.now() / 1000)), 1);
      if (shiftUtcDay(utcDayKey(dayA), 1) !== tomorrow) {
        expect(open.lead).toBeNull();
        expect(open.front).toBeNull();
      }
    }
    const printed = layoutEdition(
      [a, b],
      bids,
      shiftUtcDay(utcDayKey(dayA), 1),
    );
    expect(printed.lead?.entry.title).toBe("Alpha");
  });

  it("does not paint the same new story on Final and Open", () => {
    const now = Math.floor(Date.now() / 1000);
    const today = utcDayKey(now);
    const tomorrow = shiftUtcDay(today, 1);
    const fresh = card("0x" + "c".repeat(64), "Fresh");
    fresh.entry.timeStamp = now;
    const bids = [
      bid(a.entry.hash, 5n * 10n ** 18n, dayA),
      bid(fresh.entry.hash, 25n * 10n ** 18n, now, tomorrow),
    ];
    const open = layoutEdition([a, b, fresh], bids, tomorrow);
    const finalToday = layoutEdition([a, b, fresh], bids, today);
    expect(open.lead?.entry.title).toBe("Fresh");
    expect(
      finalToday.flat.some((c) => c.entry.hash === fresh.entry.hash),
    ).toBe(false);
  });

  it("lists printed days newest first", () => {
    const bids = [
      bid(a.entry.hash, 1n, dayA),
      bid(b.entry.hash, 1n, dayB),
    ];
    const days = listEditionDays(bids);
    expect(days[0]).toBeTruthy();
    expect(days).toContain("2026-11-20");
    expect(days).toContain("2026-11-21");
  });

  it("shifts UTC days; open cursor is tomorrow", () => {
    expect(shiftUtcDay("2026-11-20", -1)).toBe("2026-11-19");
    expect(shiftUtcDay("2026-11-19", 1)).toBe("2026-11-20");
    expect(editionCursor("open")).toBe(
      shiftUtcDay(utcDayKey(Math.floor(Date.now() / 1000)), 1),
    );
    expect(editionCursor("2026-11-19")).toBe("2026-11-19");
  });

  it("sync lookback matches gap since last Sync, capped at 2× schedule", () => {
    const now = Math.floor(Date.UTC(2026, 10, 20, 12, 0, 0) / 1000);
    expect(SYNC_LOOKBACK_DAYS).toBe(OPEN_HORIZON_DAYS * 2);

    const cold = syncLookbackCutoffUnix({ lastSyncMs: null, nowSec: now });
    expect(now - cold).toBe(SYNC_LOOKBACK_DAYS * 86400);

    const dayAgoMs = (now - 86400) * 1000;
    const gap = syncLookbackCutoffUnix({ lastSyncMs: dayAgoMs, nowSec: now });
    // ~1 day + 2 min overlap
    expect(now - gap).toBeGreaterThanOrEqual(86400);
    expect(now - gap).toBeLessThanOrEqual(86400 + 120);

    // Posted day 0 for +30d; return day 59 → still inside 60d lookback
    const ago59Ms = (now - 59 * 86400) * 1000;
    const late = syncLookbackCutoffUnix({ lastSyncMs: ago59Ms, nowSec: now });
    expect(now - late).toBeGreaterThanOrEqual(59 * 86400);
    expect(now - late).toBeLessThanOrEqual(SYNC_LOOKBACK_DAYS * 86400);

    const yearAgoMs = (now - 400 * 86400) * 1000;
    const capped = syncLookbackCutoffUnix({
      lastSyncMs: yearAgoMs,
      nowSec: now,
    });
    expect(now - capped).toBe(SYNC_LOOKBACK_DAYS * 86400);
  });
});
