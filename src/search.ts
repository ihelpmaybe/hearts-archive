import type { ArchiveEntry } from "./archive";
import { getCachedDoc } from "./cache";
import type { Hash } from "viem";

export type SearchScope = "all" | "local";
export type SearchSort = "newest" | "oldest" | "title" | "author";
export type DatePreset = "all" | "7d" | "30d";

export type ParsedQuery = {
  terms: string[];
  tag?: string;
  type?: string;
  from?: string;
  sha?: string;
  title?: string;
  raw: string;
};

/** Supports free text + operators: tag:x type:pdf from:0x sha:ab title:word */
export function parseQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = { terms: [], raw };
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  for (const p of parts) {
    const m = /^(tag|type|from|sha|title):(.+)$/i.exec(p);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].toLowerCase();
      if (key === "tag") out.tag = val.replace(/^#/, "");
      if (key === "type") out.type = val;
      if (key === "from") out.from = val;
      if (key === "sha") out.sha = val.replace(/^0x/, "");
      if (key === "title") out.title = val;
      continue;
    }
    out.terms.push(p.toLowerCase());
  }
  return out;
}

function haystack(e: ArchiveEntry, body?: string): string {
  return [
    e.title,
    e.summary ?? "",
    e.note ?? "",
    e.mimeType,
    e.type ?? "",
    e.tags.join(" "),
    e.from,
    e.sha256 ?? "",
    e.hash,
    body ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function matchEntry(
  e: ArchiveEntry,
  q: ParsedQuery,
  opts?: { bodyByHash?: Map<string, string> },
): boolean {
  if (q.tag && !e.tags.some((t) => t.includes(q.tag!))) return false;
  if (q.type && (e.type || "other") !== q.type) return false;
  if (q.from && !e.from.includes(q.from)) return false;
  if (q.sha) {
    const sha = (e.sha256 || "").toLowerCase();
    if (!sha.includes(q.sha)) return false;
  }
  if (q.title && !e.title.toLowerCase().includes(q.title)) return false;

  if (q.terms.length === 0) return true;
  const body = opts?.bodyByHash?.get(e.hash.toLowerCase());
  const hay = haystack(e, body);
  return q.terms.every((t) => hay.includes(t));
}

export function applyDatePreset(
  e: ArchiveEntry,
  preset: DatePreset,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (preset === "all") return true;
  if (!e.timeStamp) return false;
  const window = preset === "7d" ? 7 * 86400 : 30 * 86400;
  return e.timeStamp >= nowSec - window;
}

export function sortEntries(
  rows: ArchiveEntry[],
  sort: SearchSort,
): ArchiveEntry[] {
  const copy = [...rows];
  if (sort === "newest") {
    copy.sort((a, b) => (b.timeStamp || 0) - (a.timeStamp || 0));
  } else if (sort === "oldest") {
    copy.sort((a, b) => (a.timeStamp || 0) - (b.timeStamp || 0));
  } else if (sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "author") {
    copy.sort((a, b) => a.from.localeCompare(b.from) || b.timeStamp - a.timeStamp);
  }
  return copy;
}

/** Best-effort plain text from cached bytes for local full-text search. */
export async function extractCachedText(
  hash: Hash,
): Promise<string | null> {
  const doc = await getCachedDoc(hash);
  if (!doc) return null;
  const mime = doc.mimeType || "";
  if (
    !mime.startsWith("text/") &&
    !mime.includes("json") &&
    !mime.includes("javascript") &&
    !mime.includes("xml")
  ) {
    return null;
  }
  try {
    const text = new TextDecoder().decode(doc.bytes);
    return text.slice(0, 80_000);
  } catch {
    return null;
  }
}

export async function buildBodyIndex(
  hashes: Hash[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    hashes.slice(0, 60).map(async (h) => {
      const t = await extractCachedText(h);
      if (t) map.set(h.toLowerCase(), t.toLowerCase());
    }),
  );
  return map;
}
