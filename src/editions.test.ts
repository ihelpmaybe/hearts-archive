import { describe, expect, it } from "vitest";
import type { FrontBidEntry } from "./archive";
import {
  bidsAsOfDay,
  layoutEdition,
  listEditionDays,
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
): FrontBidEntry {
  return {
    hash: ("0x" + timeStamp.toString(16).padStart(64, "0")) as `0x${string}`,
    from: "0x1",
    timeStamp,
    manifest: manifest as `0x${string}`,
    valueWei: wei,
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

  it("freezes A1 as of end of day", () => {
    const bids = [
      bid(a.entry.hash, 5n * 10n ** 18n, dayA),
      bid(b.entry.hash, 20n * 10n ** 18n, dayB),
    ];
    expect(bidsAsOfDay(bids, "2026-11-19")).toHaveLength(1);
    const frozen = layoutEdition([a, b], bids, "2026-11-19");
    expect(frozen.lead?.entry.title).toBe("Alpha");
    const live = layoutEdition([a, b], bids, "live");
    expect(live.lead?.entry.title).toBe("Bravo");
  });

  it("lists days newest first", () => {
    const bids = [
      bid(a.entry.hash, 1n, dayA),
      bid(b.entry.hash, 1n, dayB),
    ];
    expect(listEditionDays(bids)).toEqual(["2026-11-20", "2026-11-19"]);
  });
});
