import type { Hash } from "viem";
import { dedupeFrontBids, type FrontBidEntry } from "./archive";

const KEY = "hearts-archive-fronts-v1";

type StoredFront = Omit<FrontBidEntry, "valueWei"> & { valueWei: string };

function readAll(): FrontBidEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredFront[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => {
        try {
          return {
            hash: r.hash as Hash,
            from: r.from || "",
            timeStamp: Number(r.timeStamp) || 0,
            manifest: r.manifest as Hash,
            valueWei: BigInt(r.valueWei || "0"),
            ...(r.forDay ? { forDay: r.forDay } : {}),
          } satisfies FrontBidEntry;
        } catch {
          return null;
        }
      })
      .filter((b): b is FrontBidEntry => !!b && b.valueWei > 0n);
  } catch {
    return [];
  }
}

function writeAll(rows: FrontBidEntry[]) {
  const packed: StoredFront[] = dedupeFrontBids(rows)
    .slice(0, 500)
    .map((b) => ({
      hash: b.hash,
      from: b.from,
      timeStamp: b.timeStamp,
      manifest: b.manifest,
      valueWei: b.valueWei.toString(),
      ...(b.forDay ? { forDay: b.forDay } : {}),
    }));
  localStorage.setItem(KEY, JSON.stringify(packed));
}

export function loadLocalFronts(): FrontBidEntry[] {
  return readAll();
}

export function saveLocalFronts(rows: FrontBidEntry[]) {
  writeAll(rows);
}

export function clearLocalFronts() {
  localStorage.removeItem(KEY);
}
