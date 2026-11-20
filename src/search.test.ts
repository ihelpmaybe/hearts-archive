import { describe, expect, it } from "vitest";
import type { ArchiveEntry } from "./archive";
import {
  applyDatePreset,
  matchEntry,
  parseQuery,
  sortEntries,
} from "./search";

function entry(partial: Partial<ArchiveEntry> & { hash: string }): ArchiveEntry {
  return {
    from: "0xabc",
    timeStamp: 1_700_000_000,
    title: "Untitled",
    mimeType: "text/plain",
    tags: [],
    chunkCount: 1,
    ...partial,
    hash: partial.hash as `0x${string}`,
  };
}

describe("parseQuery", () => {
  it("parses operators and terms", () => {
    const q = parseQuery("raven tag:hex type:pdf from:0x76 title:poe hello");
    expect(q.tag).toBe("hex");
    expect(q.type).toBe("pdf");
    expect(q.from).toBe("0x76");
    expect(q.title).toBe("poe");
    expect(q.terms).toEqual(["raven", "hello"]);
  });
});

describe("matchEntry", () => {
  const e = entry({
    hash: "0xaaaa",
    title: "The Raven",
    tags: ["poem", "hex"],
    type: "text",
    from: "0x761234",
    sha256: "deadbeef",
  });

  it("matches free text", () => {
    expect(matchEntry(e, parseQuery("raven"))).toBe(true);
    expect(matchEntry(e, parseQuery("missing"))).toBe(false);
  });

  it("matches operators", () => {
    expect(matchEntry(e, parseQuery("tag:poem"))).toBe(true);
    expect(matchEntry(e, parseQuery("type:text"))).toBe(true);
    expect(matchEntry(e, parseQuery("from:0x76"))).toBe(true);
    expect(matchEntry(e, parseQuery("sha:dead"))).toBe(true);
    expect(matchEntry(e, parseQuery("title:raven"))).toBe(true);
  });
});

describe("applyDatePreset / sort", () => {
  it("filters by date", () => {
    const now = 1_700_000_000;
    const fresh = entry({ hash: "0x1", timeStamp: now - 60 });
    const old = entry({ hash: "0x2", timeStamp: now - 40 * 86400 });
    expect(applyDatePreset(fresh, "7d", now)).toBe(true);
    expect(applyDatePreset(old, "7d", now)).toBe(false);
  });

  it("sorts newest first", () => {
    const a = entry({ hash: "0x1", timeStamp: 10, title: "B" });
    const b = entry({ hash: "0x2", timeStamp: 20, title: "A" });
    expect(sortEntries([a, b], "newest").map((x) => x.hash)).toEqual([
      "0x2",
      "0x1",
    ]);
    expect(sortEntries([a, b], "title").map((x) => x.title)).toEqual([
      "A",
      "B",
    ]);
  });
});
