import { describe, expect, it } from "vitest";
import type { FrontBidEntry } from "./archive";
import {
  formatFrontPriceHint,
  formatPls,
  frontBidStats,
  layoutPressPage,
} from "./frontPage";
import type { SeriesCard } from "./series";

function card(hash: string, title: string, time = 1): SeriesCard {
  return {
    entry: {
      hash: hash as `0x${string}`,
      from: "0xabc",
      timeStamp: time,
      title,
      mimeType: "text/plain",
      type: "text",
      tags: [],
      chunkCount: 1,
    },
    olderCount: 0,
  };
}

describe("press layout", () => {
  const a = card("0x" + "a".repeat(64), "Alpha", 3);
  const b = card("0x" + "b".repeat(64), "Bravo", 2);
  const c = card("0x" + "c".repeat(64), "Charlie", 1);
  const d = card("0x" + "d".repeat(64), "Delta", 0);

  it("puts highest PLS bid on the lead headline", () => {
    const bids: FrontBidEntry[] = [
      {
        hash: "0x1" as `0x${string}`,
        from: "0x1",
        timeStamp: 1,
        manifest: b.entry.hash,
        valueWei: 5n * 10n ** 18n,
      },
      {
        hash: "0x2" as `0x${string}`,
        from: "0x2",
        timeStamp: 2,
        manifest: a.entry.hash,
        valueWei: 12n * 10n ** 18n,
      },
    ];
    const layout = layoutPressPage([a, b, c, d], bids);
    expect(layout.lead?.entry.title).toBe("Alpha");
    expect(layout.front?.valueWei).toBe(12n * 10n ** 18n);
    expect(layout.secondary).toHaveLength(2);
    expect(layout.briefs.length).toBeGreaterThanOrEqual(1);
  });

  it("open paper does not invent A1 without a bid", () => {
    const empty = layoutPressPage([a, b, c, d], [], {
      requireBidForLead: true,
    });
    expect(empty.lead).toBeNull();
    expect(empty.front).toBeNull();
    const fallback = layoutPressPage([a, b, c, d], []);
    expect(fallback.lead?.entry.title).toBe("Alpha");
  });

  it("formats PLS", () => {
    expect(formatPls(10n * 10n ** 18n)).toBe("10");
    expect(formatPls(15n * 10n ** 17n)).toBe("1.5");
  });

  it("summarizes A1 current + average", () => {
    const bids: FrontBidEntry[] = [
      {
        hash: "0x1" as `0x${string}`,
        from: "0x1",
        timeStamp: 1,
        manifest: ("0x" + "a".repeat(64)) as `0x${string}`,
        valueWei: 10n * 10n ** 18n,
      },
      {
        hash: "0x2" as `0x${string}`,
        from: "0x2",
        timeStamp: 2,
        manifest: ("0x" + "b".repeat(64)) as `0x${string}`,
        valueWei: 20n * 10n ** 18n,
      },
    ];
    const stats = frontBidStats(bids);
    expect(stats.currentWei).toBe(20n * 10n ** 18n);
    expect(stats.avgWei).toBe(15n * 10n ** 18n);
    expect(stats.count).toBe(2);
    expect(formatFrontPriceHint(stats)).toContain("avg 15 PLS");
    expect(formatFrontPriceHint(stats)).toMatch(/PLS only/i);
    expect(formatFrontPriceHint(stats)).toMatch(/Tip the writer anything/i);
    expect(formatFrontPriceHint(frontBidStats([]))).toMatch(/A1 open/i);
  });
});
