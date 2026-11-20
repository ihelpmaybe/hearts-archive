import type { Hash } from "viem";
import type { ChunkProgress } from "./protocol";

const KEY = "pulse-archive-incomplete-v1";

export type IncompletePublish = {
  id: string;
  title: string;
  sha256: string;
  mimeType: string;
  encoding: "gzip" | "raw";
  originalBytes: number;
  storedBytes: number;
  partsCount: number;
  progress: ChunkProgress[];
  tagsRaw: string;
  note: string;
  summary: string;
  lang: string;
  license: string;
  replaces: string;
  cw: boolean;
  savedAt: number;
};

export function loadIncomplete(): IncompletePublish | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IncompletePublish;
  } catch {
    return null;
  }
}

export function saveIncomplete(
  row: Omit<IncompletePublish, "savedAt" | "id"> & { id?: string },
) {
  const full: IncompletePublish = {
    ...row,
    id: row.id || `inc-${Date.now()}`,
    savedAt: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(full));
  return full;
}

export function clearIncomplete() {
  localStorage.removeItem(KEY);
}

export function incompleteDoneCount(row: IncompletePublish): number {
  return row.progress.filter((c) => c.status === "done" && c.hash).length;
}

export function incompleteChunkHashes(row: IncompletePublish): Hash[] {
  return row.progress
    .filter((c) => c.status === "done" && c.hash)
    .map((c) => c.hash as Hash);
}
