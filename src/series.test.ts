import { describe, expect, it } from "vitest";
import { collapseSeriesCards, seriesMeta } from "./series";
import type { ArchiveEntry } from "./archive";

function entry(
  hash: string,
  replaces?: string,
  title = hash.slice(0, 8),
): ArchiveEntry {
  return {
    hash: hash as `0x${string}`,
    from: "0xabc",
    timeStamp: 1,
    title,
    mimeType: "text/plain",
    type: "text",
    tags: [],
    chunkCount: 1,
    kind: "pulse-archive",
    replaces,
  };
}

describe("series collapse", () => {
  const a = entry("0x" + "a".repeat(64), undefined, "v1");
  const b = entry("0x" + "b".repeat(64), a.hash, "v2");
  const c = entry("0x" + "c".repeat(64), b.hash, "v3");

  it("marks tip version and older chain", () => {
    const { olderOf, versionOf } = seriesMeta([a, b, c]);
    expect(versionOf.get(c.hash)).toBe(3);
    expect(olderOf.get(c.hash)?.map((e) => e.hash)).toEqual([b.hash, a.hash]);
  });

  it("hides older until expanded", () => {
    const collapsed = collapseSeriesCards([c, b, a], new Set());
    expect(collapsed.map((x) => x.entry.hash)).toEqual([c.hash]);
    expect(collapsed[0].olderCount).toBe(2);
    const open = collapseSeriesCards([c, b, a], new Set([c.hash]));
    expect(open.map((x) => x.entry.hash)).toEqual([c.hash, b.hash, a.hash]);
  });
});
