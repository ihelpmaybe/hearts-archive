import { describe, expect, it } from "vitest";
import type { ArchiveEntry } from "./archive";
import { shiftUtcDay, utcTodayKey } from "./editions";
import { buildDuelRounds } from "./deskDuel";

function story(n: number): ArchiveEntry {
  const h = `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`;
  return {
    hash: h,
    from: `0xduel${n}`,
    timeStamp: Math.floor(Date.now() / 1000) - 60,
    title: `S${n}`,
    mimeType: "text/plain",
    tags: ["duel"],
    chunkCount: 1,
  };
}

describe("deskDuel Press parity", () => {
  it("R2 cascade puts story0 on A1 like Press layoutEdition", () => {
    const forDay = shiftUtcDay(utcTodayKey(), 1);
    const stories = [story(1), story(2), story(3), story(4)];
    const rounds = buildDuelRounds(stories, forDay);
    expect(rounds.verifyR2Labels[0]).toBe(stories[0]!.hash.toLowerCase());
    expect(rounds.verifyR2Labels).toHaveLength(3);
  });
});
