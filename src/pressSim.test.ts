/**
 * Heavy layout / bid sims — catch A1–A3 / B–D edge bugs before the face.
 */
import { describe, expect, it } from "vitest";
import type { FrontBidEntry } from "./archive";
import { dedupeFrontBids } from "./archive";
import {
  FRONT_A_COUNT,
  SECTION_PAGE_SIZE,
  groupInsideByLetter,
  insideSlotLabel,
  layoutPressPage,
} from "./frontPage";
import {
  bidsForPrintedDay,
  cardsForEdition,
  layoutEdition,
  shiftUtcDay,
  utcTodayKey,
} from "./editions";
import type { SeriesCard } from "./series";

function card(i: number, title?: string): SeriesCard {
  const hex = i.toString(16).padStart(64, "0");
  return {
    entry: {
      hash: (`0x${hex}`) as `0x${string}`,
      from: `0xauthor${i}`,
      timeStamp: 1_700_000_000 + i,
      title: title || `Story ${i}`,
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
  pls: number,
  n: number,
  forDay?: string,
): FrontBidEntry {
  return {
    hash: (`0x${"f".repeat(62)}${n.toString(16).padStart(2, "0")}`) as `0x${string}`,
    from: `0xbidder${n}`,
    timeStamp: 1_700_000_000 + n,
    manifest: manifest.toLowerCase() as `0x${string}`,
    valueWei: BigInt(pls) * 10n ** 18n,
    forDay,
  };
}

describe("press sims", () => {
  it("100 stories · 5 bids → A1–A3 + B then C", () => {
    const cards = Array.from({ length: 100 }, (_, i) => card(i));
    const bids = [90, 80, 70, 60, 50].map((pls, i) =>
      bid(cards[i]!.entry.hash, pls, i + 1),
    );
    const layout = layoutPressPage(cards, bids, { requireBidForLead: true });
    expect(layout.aFace.map((s) => s.label)).toEqual(["A1", "A2", "A3"]);
    expect(layout.aFace[0]?.card.entry.title).toBe("Story 0");
    expect(layout.inside).toHaveLength(97);
    expect(layout.inside[0]?.label).toBe("B1");
    // bid rank 4 (60 PLS) should be B1
    expect(layout.inside[0]?.card.entry.title).toBe("Story 3");
    expect(layout.inside[0]?.bid?.valueWei).toBe(60n * 10n ** 18n);
    const bands = groupInsideByLetter(layout.inside);
    expect(bands[0]?.letter).toBe("B");
    expect(bands[0]?.slots).toHaveLength(SECTION_PAGE_SIZE);
    expect(bands[1]?.letter).toBe("C");
    // 97 = 8×12 + 1 → B…I full, then J1
    expect(bands.at(-1)?.letter).toBe("J");
    expect(bands.at(-1)?.slots).toHaveLength(1);
    expect(layout.flat).toHaveLength(100);
    // no duplicate hashes on face
    const hashes = layout.flat.map((c) => c.entry.hash.toLowerCase());
    expect(new Set(hashes).size).toBe(100);
  });

  it("tie bids: newer timestamp wins the higher A slot", () => {
    const a = card(1, "Old");
    const b = card(2, "New");
    const bids = [
      bid(a.entry.hash, 10, 1),
      { ...bid(b.entry.hash, 10, 2), timeStamp: 9_999_999_999 },
    ];
    const layout = layoutPressPage([a, b], bids, { requireBidForLead: true });
    expect(layout.aFace[0]?.card.entry.title).toBe("New");
    expect(layout.aFace[1]?.card.entry.title).toBe("Old");
  });

  it("dedupe keeps highest PLS per manifest·day then ranks A", () => {
    const a = card(1, "Alpha");
    const day = "2030-01-15";
    const bids = dedupeFrontBids([
      bid(a.entry.hash, 5, 1, day),
      bid(a.entry.hash, 40, 2, day),
      bid(a.entry.hash, 12, 3, day),
    ]);
    expect(bids).toHaveLength(1);
    expect(bids[0]?.valueWei).toBe(40n * 10n ** 18n);
    const layout = layoutPressPage([a], bids, { requireBidForLead: true });
    expect(layout.aFace[0]?.bid?.valueWei).toBe(40n * 10n ** 18n);
  });

  it("open edition: unbid stories never sit on A", () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(i));
    const bids = [bid(cards[7]!.entry.hash, 3, 1)];
    const layout = layoutPressPage(cards, bids, { requireBidForLead: true });
    expect(layout.aFace).toHaveLength(1);
    expect(layout.aFace[0]?.card.entry.title).toBe("Story 7");
    expect(layout.inside.every((s) => s.label.startsWith("B"))).toBe(true);
    expect(layout.inside.some((s) => s.card.entry.title === "Story 0")).toBe(
      true,
    );
  });

  it("outbid cascade: A1→A2→A3→B1", () => {
    const cards = [card(1, "A"), card(2, "B"), card(3, "C"), card(4, "D")];
    let bids = [
      bid(cards[0]!.entry.hash, 10, 1),
      bid(cards[1]!.entry.hash, 20, 2),
      bid(cards[2]!.entry.hash, 30, 3),
      bid(cards[3]!.entry.hash, 40, 4),
    ];
    let L = layoutPressPage(cards, bids, { requireBidForLead: true });
    expect(L.aFace.map((s) => s.card.entry.title)).toEqual(["D", "C", "B"]);
    expect(L.inside[0]?.card.entry.title).toBe("A");
    expect(L.inside[0]?.label).toBe("B1");

    // A jumps to 100 → becomes A1; D drops to A2
    bids = [...bids, bid(cards[0]!.entry.hash, 100, 5)];
    L = layoutPressPage(cards, bids, { requireBidForLead: true });
    expect(L.aFace.map((s) => s.card.entry.title)).toEqual(["A", "D", "C"]);
    expect(L.inside[0]?.card.entry.title).toBe("B");
  });

  it("edition freeze: future paper only counts bids for that forDay", () => {
    const today = utcTodayKey();
    const open = shiftUtcDay(today, 1);
    const other = shiftUtcDay(today, 2);
    const cards = [card(1, "Mine"), card(2, "Theirs")];
    // File “today” so both are edition-eligible via fileDay = open-1
    cards[0]!.entry.timeStamp = Math.floor(Date.now() / 1000) - 60;
    cards[1]!.entry.timeStamp = Math.floor(Date.now() / 1000) - 30;
    const bids = [
      bid(cards[0]!.entry.hash, 10, 1, open),
      bid(cards[1]!.entry.hash, 50, 2, other), // wrong paper
    ];
    const now = Math.floor(Date.now() / 1000);
    bids[0]!.timeStamp = now;
    bids[1]!.timeStamp = now;
    const dayBids = bidsForPrintedDay(bids, open);
    expect(dayBids).toHaveLength(1);
    const scoped = cardsForEdition(cards, bids, open);
    const layout = layoutEdition(cards, bids, open);
    expect(layout.aFace).toHaveLength(1);
    expect(layout.lead?.entry.title).toBe("Mine");
    // Rival may still appear inside if filed on fileDay
    expect(scoped.length).toBeGreaterThanOrEqual(1);
  });

  it("slot labels never skip or collide through B→C and past Z", () => {
    const labels = Array.from({ length: SECTION_PAGE_SIZE + 3 }, (_, i) =>
      insideSlotLabel(i),
    );
    expect(labels[0]).toBe("B1");
    expect(labels[SECTION_PAGE_SIZE - 1]).toBe("B12");
    expect(labels[SECTION_PAGE_SIZE]).toBe("C1");
    expect(new Set(labels).size).toBe(labels.length);
    expect(FRONT_A_COUNT).toBe(3);
    // page 25 (after B–Z) → AA1 — old code collapsed everything onto Z
    const aa = insideSlotLabel(25 * SECTION_PAGE_SIZE);
    expect(aa).toBe("AA1");
    const z12 = insideSlotLabel(24 * SECTION_PAGE_SIZE + 11);
    expect(z12).toBe("Z12");
  });

  it("zero cards / empty bids stay safe", () => {
    expect(layoutPressPage([], [], { requireBidForLead: true }).flat).toEqual(
      [],
    );
    expect(
      layoutPressPage([card(1)], [], { requireBidForLead: true }).aFace,
    ).toEqual([]);
  });
});
