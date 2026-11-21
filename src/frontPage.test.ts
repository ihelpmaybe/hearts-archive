import { describe, expect, it } from "vitest";
import type { FrontBidEntry } from "./archive";
import {
  FRONT_A_COUNT,
  SECTION_PAGE_SIZE,
  formatFrontPriceHint,
  formatPls,
  frontBidStats,
  groupInsideByLetter,
  insideSlotLabel,
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

function bid(
  manifest: string,
  wei: bigint,
  n: number,
): FrontBidEntry {
  return {
    hash: (`0x${"e".repeat(63)}${n}`) as `0x${string}`,
    from: `0x${n}`,
    timeStamp: n,
    manifest: manifest as `0x${string}`,
    valueWei: wei,
  };
}

describe("press layout", () => {
  const a = card("0x" + "a".repeat(64), "Alpha", 3);
  const b = card("0x" + "b".repeat(64), "Bravo", 2);
  const c = card("0x" + "c".repeat(64), "Charlie", 1);
  const d = card("0x" + "d".repeat(64), "Delta", 0);

  it("puts top three bids on A1–A3", () => {
    const bids = [
      bid(b.entry.hash, 5n * 10n ** 18n, 1),
      bid(a.entry.hash, 12n * 10n ** 18n, 2),
      bid(c.entry.hash, 8n * 10n ** 18n, 3),
    ];
    const layout = layoutPressPage([a, b, c, d], bids);
    expect(layout.aFace.map((s) => s.label)).toEqual(["A1", "A2", "A3"]);
    expect(layout.lead?.entry.title).toBe("Alpha");
    expect(layout.aFace[1]?.card.entry.title).toBe("Charlie");
    expect(layout.aFace[2]?.card.entry.title).toBe("Bravo");
    expect(layout.a3?.valueWei).toBe(5n * 10n ** 18n);
    expect(layout.inside[0]?.label).toBe("B1");
    expect(layout.inside[0]?.card.entry.title).toBe("Delta");
  });

  it("outbid flips A1 and demotes prior lead toward A2/A3", () => {
    const round1 = [
      bid(a.entry.hash, 10n * 10n ** 18n, 1),
      bid(b.entry.hash, 25n * 10n ** 18n, 2),
    ];
    const mid = layoutPressPage([a, b, c], round1);
    expect(mid.lead?.entry.title).toBe("Bravo");
    expect(mid.a2?.manifest).toBe(a.entry.hash);
    expect(mid.aFace[1]?.label).toBe("A2");

    const round2 = [
      ...round1,
      bid(a.entry.hash, 40n * 10n ** 18n, 3),
    ];
    const end = layoutPressPage([a, b, c], round2);
    expect(end.lead?.entry.title).toBe("Alpha");
    expect(end.a2?.manifest).toBe(b.entry.hash);
  });

  it("open paper does not invent A1 without a bid", () => {
    const empty = layoutPressPage([a, b, c, d], [], {
      requireBidForLead: true,
    });
    expect(empty.lead).toBeNull();
    expect(empty.aFace).toHaveLength(0);
    const fallback = layoutPressPage([a, b, c, d], []);
    expect(fallback.lead?.entry.title).toBe("Alpha");
  });

  it("labels B then C after the A front fills", () => {
    expect(FRONT_A_COUNT).toBe(3);
    expect(insideSlotLabel(0)).toBe("B1");
    expect(insideSlotLabel(SECTION_PAGE_SIZE - 1)).toBe("B12");
    expect(insideSlotLabel(SECTION_PAGE_SIZE)).toBe("C1");

    const many = Array.from({ length: 20 }, (_, i) =>
      card("0x" + i.toString(16).padStart(64, "0"), `S${i}`, 100 - i),
    );
    const bids = many.slice(0, 5).map((m, i) =>
      bid(m.entry.hash, BigInt(50 - i) * 10n ** 18n, i + 1),
    );
    const layout = layoutPressPage(many, bids, { requireBidForLead: true });
    expect(layout.aFace).toHaveLength(3);
    expect(layout.inside[0]?.label).toBe("B1");
    const bands = groupInsideByLetter(layout.inside);
    expect(bands[0]?.letter).toBe("B");
    // 20 − 3 A = 17 inside → B1–B12 + C1–C5
    expect(layout.inside).toHaveLength(17);
    expect(layout.inside[11]?.label).toBe("B12");
    expect(layout.inside[12]?.label).toBe("C1");
    expect(bands.some((b) => b.letter === "C")).toBe(true);
  });

  it("formats PLS", () => {
    expect(formatPls(10n * 10n ** 18n)).toBe("10");
    expect(formatPls(15n * 10n ** 17n)).toBe("1.5");
  });

  it("summarizes A1 current + average", () => {
    const bids: FrontBidEntry[] = [
      bid("0x" + "a".repeat(64), 10n * 10n ** 18n, 1),
      bid("0x" + "b".repeat(64), 20n * 10n ** 18n, 2),
    ];
    const stats = frontBidStats(bids);
    expect(stats.currentWei).toBe(20n * 10n ** 18n);
    expect(stats.avgWei).toBe(15n * 10n ** 18n);
    expect(formatFrontPriceHint(stats)).toMatch(/A1–A3|top 3/i);
    expect(formatFrontPriceHint(frontBidStats([]))).toMatch(/A1–A3 open/i);
  });
});
