import type { Hash } from "viem";
import {
  dedupeFrontBids,
  frontBidPrintedDay,
  type ArchiveEntry,
  type FrontBidEntry,
} from "./archive";
import { cardsForEdition, isOpenPrintedDay, layoutEdition } from "./editions";
import type { DocType } from "./protocol";
import type { SeriesCard } from "./series";

/** Desk duel bidders — local A1–A3 / B outbid sim only (same ranking as Press). */
export const DUEL_A = "0xduela0000000000000000000000000000000001";
export const DUEL_B = "0xduelb0000000000000000000000000000000001";
export const DUEL_C = "0xduelc0000000000000000000000000000000001";
export const DUEL_D = "0xdueld0000000000000000000000000000000001";

export type DuelShelfRow = ArchiveEntry & {
  encoding: "raw";
  kind: "pulse-archive";
};

export type DuelSeed = {
  shelfRow: DuelShelfRow;
  bytes: Uint8Array;
};

/** Build a local shelf story for the Desk duel (not on-chain). */
export async function makeDuelStory(
  from: string,
  title: string,
  summary: string,
  body: string,
  sha256HexFn: (bytes: Uint8Array) => Promise<string>,
): Promise<DuelSeed> {
  const now = Math.floor(Date.now() / 1000);
  const bytes = new TextEncoder().encode(body);
  const digest = await sha256HexFn(bytes);
  const manifestHash = (`0x${digest}`) as Hash;
  const shelfRow: DuelShelfRow = {
    hash: manifestHash,
    from,
    timeStamp: now,
    title,
    mimeType: "text/plain;charset=utf-8",
    type: "text" as DocType,
    tags: ["duel"],
    summary,
    sha256: `0x${digest}`,
    encoding: "raw",
    chunkCount: 1,
    kind: "pulse-archive",
    cw: false,
  };
  return { shelfRow, bytes };
}

export function duelBid(
  manifest: string,
  from: string,
  pls: bigint,
  n: number,
  forDay: string,
  t0: number,
): FrontBidEntry {
  return {
    hash: (`0x${"d".repeat(62)}${n.toString(16).padStart(2, "0")}`) as Hash,
    from,
    timeStamp: t0 + n,
    manifest: manifest.toLowerCase() as Hash,
    valueWei: pls * 10n ** 18n,
    forDay,
  };
}

/**
 * Same Press rules: forDay-scoped bids → layoutEdition A1–A3.
 * Returns R1 + R2 front sets and status lines (Desk face only).
 */
export function buildDuelRounds(
  stories: ArchiveEntry[],
  forDay: string,
): {
  forDay: string;
  r1: FrontBidEntry[];
  r2Extra: FrontBidEntry;
  statusR1: string;
  statusR2: string;
  verifyR2Labels: string[];
} {
  if (stories.length < 4) {
    throw new Error("Need four duel stories for A1–A3 + B1");
  }
  if (!isOpenPrintedDay(forDay)) {
    throw new Error("Duel only on an Open edition day");
  }
  const [s1, s2, s3, s4] = stories;
  const t0 = Math.floor(Date.now() / 1000);
  const r1 = [
    duelBid(s1!.hash, DUEL_A, 10n, 1, forDay, t0),
    duelBid(s2!.hash, DUEL_B, 20n, 2, forDay, t0),
    duelBid(s3!.hash, DUEL_C, 30n, 3, forDay, t0),
    duelBid(s4!.hash, DUEL_D, 40n, 4, forDay, t0),
  ];
  const r2Extra = duelBid(s1!.hash, DUEL_A, 100n, 5, forDay, t0);

  const cards: SeriesCard[] = stories.map((entry) => ({
    entry,
    olderCount: 0,
  }));
  const afterR2 = dedupeFrontBids([r2Extra, ...r1]);
  const layout = layoutEdition(cards, afterR2, forDay);
  const verifyR2Labels = layout.aFace.map((s) => s.card.entry.hash.toLowerCase());

  return {
    forDay,
    r1,
    r2Extra,
    statusR1: "Duel R1 · D@40=A1 · C@30=A2 · B@20=A3 · A@10=B1 (same Press ranking)",
    statusR2: "Duel R2 · A@100=A1 · D@40=A2 · C@30=A3 · B@20=B1 — Press parity",
    verifyR2Labels,
  };
}

export function mergeDuelDayBids(
  prev: FrontBidEntry[],
  dayBids: FrontBidEntry[],
  forDay: string,
): FrontBidEntry[] {
  return dedupeFrontBids([
    ...dayBids,
    ...prev.filter((b) => frontBidPrintedDay(b) !== forDay),
  ]);
}

export function storiesForDuelDay(
  libraryCards: SeriesCard[],
  fronts: FrontBidEntry[],
  forDay: string,
): ArchiveEntry[] {
  return cardsForEdition(libraryCards, fronts, forDay).map((c) => c.entry);
}
