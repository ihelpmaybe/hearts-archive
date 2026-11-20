import type { ArchiveEntry } from "./archive";

/** Collapse `replaces` chains so Library shows the tip (+ optional older). */
export function seriesMeta(entries: ArchiveEntry[]): {
  olderOf: Map<string, ArchiveEntry[]>;
  versionOf: Map<string, number>;
} {
  const byHash = new Map(
    entries.map((e) => [e.hash.toLowerCase(), e] as const),
  );
  const superseded = new Set<string>();
  for (const e of entries) {
    const r = e.replaces?.toLowerCase();
    if (r && byHash.has(r)) superseded.add(r);
  }
  const olderOf = new Map<string, ArchiveEntry[]>();
  const versionOf = new Map<string, number>();
  for (const e of entries) {
    if (superseded.has(e.hash.toLowerCase())) continue;
    const chain: ArchiveEntry[] = [];
    let cur = e.replaces?.toLowerCase();
    const seen = new Set<string>();
    while (cur && byHash.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      chain.push(byHash.get(cur)!);
      cur = byHash.get(cur)!.replaces?.toLowerCase();
    }
    if (chain.length) {
      const tip = e.hash.toLowerCase();
      olderOf.set(tip, chain);
      versionOf.set(tip, chain.length + 1);
    }
  }
  return { olderOf, versionOf };
}

export type SeriesCard = {
  entry: ArchiveEntry;
  version?: number;
  olderCount: number;
};

export function collapseSeriesCards(
  rows: ArchiveEntry[],
  expanded: Set<string>,
): SeriesCard[] {
  const { olderOf, versionOf } = seriesMeta(rows);
  const inRows = new Set(rows.map((e) => e.hash.toLowerCase()));
  const hide = new Set<string>();
  for (const [tip, olders] of olderOf) {
    if (!inRows.has(tip) || expanded.has(tip)) continue;
    for (const o of olders) {
      if (inRows.has(o.hash.toLowerCase())) hide.add(o.hash.toLowerCase());
    }
  }
  return rows
    .filter((e) => !hide.has(e.hash.toLowerCase()))
    .map((e) => {
      const tip = e.hash.toLowerCase();
      const olderCount =
        olderOf.get(tip)?.filter((o) => inRows.has(o.hash.toLowerCase()))
          .length || 0;
      return {
        entry: e,
        version: versionOf.get(tip),
        olderCount,
      };
    });
}
