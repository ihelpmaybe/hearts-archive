import type { Hash } from "viem";
import type { ArchiveEntry } from "./archive";

const KEY = "pulse-archive-shelf-v1";

export type ShelfEntry = ArchiveEntry & {
  savedAt: number;
};

function readAll(): ShelfEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShelfEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ShelfEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 500)));
}

export function listShelf(): ShelfEntry[] {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function pinToShelf(entry: Omit<ShelfEntry, "savedAt"> & { savedAt?: number }) {
  const rows = readAll().filter((r) => r.hash !== entry.hash);
  rows.unshift({ ...entry, savedAt: entry.savedAt ?? Date.now() });
  writeAll(rows);
}

export function unpinFromShelf(hash: Hash) {
  writeAll(readAll().filter((r) => r.hash !== hash));
}

export function clearShelf() {
  writeAll([]);
}

export function replaceShelf(rows: ShelfEntry[]) {
  writeAll(rows);
}

export function mergeShelfAndRemote(
  shelf: ArchiveEntry[],
  remote: ArchiveEntry[],
): ArchiveEntry[] {
  const map = new Map<string, ArchiveEntry>();
  for (const r of remote) map.set(r.hash, r);
  for (const s of shelf) {
    if (!map.has(s.hash)) map.set(s.hash, s);
  }
  return [...map.values()].sort((a, b) => (b.timeStamp || 0) - (a.timeStamp || 0));
}
