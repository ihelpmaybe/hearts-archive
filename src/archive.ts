import type { Hash, Hex } from "viem";
import {
  ARCHIVE_SINK,
  tryParseManifest,
  type DocType,
  type ManifestPayload,
} from "./protocol";

export type ArchiveEntry = {
  hash: Hash;
  from: string;
  timeStamp: number;
  title: string;
  mimeType: string;
  type?: DocType;
  tags: string[];
  note?: string;
  summary?: string;
  sha256?: string;
  encoding?: string;
  replaces?: string;
  chunkCount: number;
  kind?: string;
  cw?: boolean;
};

type V2Tx = {
  hash: string;
  timestamp?: string | null;
  result?: string | null;
  status?: string | null;
  raw_input?: string | null;
  from?: { hash?: string } | string | null;
  to?: { hash?: string } | string | null;
};

type PageParams = Record<string, string | number | boolean | null | undefined>;

function explorerV2Base(): string {
  if (typeof window !== "undefined" && window.location.port === "5177") {
    return "/pulse-api/v2";
  }
  return (
    (import.meta.env.VITE_PULSE_EXPLORER_V2 as string | undefined) ||
    "https://api.scan.pulsechain.com/api/v2"
  );
}

function fromHash(tx: V2Tx): string {
  if (!tx.from) return "";
  if (typeof tx.from === "string") return tx.from.toLowerCase();
  return (tx.from.hash || "").toLowerCase();
}

function pageQuery(params?: PageParams | null): string {
  if (!params) return "";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `&${s}` : "";
}

async function fetchAddressTxPage(
  address: string,
  opts: { limit: number; pageParams?: PageParams | null },
): Promise<{ items: V2Tx[]; next: PageParams | null }> {
  const url = `${explorerV2Base()}/addresses/${address}/transactions?limit=${opts.limit}${pageQuery(opts.pageParams)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Explorer HTTP ${res.status}`);
    const body = (await res.json()) as {
      items?: V2Tx[];
      next_page_params?: PageParams | null;
      message?: string;
    };
    if (!Array.isArray(body.items)) {
      throw new Error(body.message || "Explorer returned no txs");
    }
    return {
      items: body.items,
      next: body.next_page_params ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Page through Blockscout until maxItems or no next page. */
export async function fetchAddressTxsPaged(
  address: string,
  opts?: { pageSize?: number; maxItems?: number; maxPages?: number },
): Promise<V2Tx[]> {
  const pageSize = opts?.pageSize ?? 50;
  const maxItems = opts?.maxItems ?? 500;
  const maxPages = opts?.maxPages ?? 20;
  const out: V2Tx[] = [];
  const seen = new Set<string>();
  let pageParams: PageParams | null = null;

  for (let page = 0; page < maxPages && out.length < maxItems; page++) {
    const { items, next } = await fetchAddressTxPage(address, {
      limit: pageSize,
      pageParams,
    });
    if (!items.length) break;
    for (const tx of items) {
      const h = (tx.hash || "").toLowerCase();
      if (!h || seen.has(h)) continue;
      seen.add(h);
      out.push(tx);
      if (out.length >= maxItems) break;
    }
    if (!next) break;
    pageParams = next;
  }
  return out;
}

function entryFromManifest(tx: V2Tx, manifest: ManifestPayload): ArchiveEntry {
  const ts = tx.timestamp ? Date.parse(tx.timestamp) / 1000 : 0;
  return {
    hash: tx.hash.toLowerCase() as Hash,
    from: fromHash(tx),
    timeStamp: Number.isFinite(ts) ? ts : 0,
    title: manifest.title?.trim() || "(untitled)",
    mimeType: manifest.mimeType,
    type: manifest.type,
    tags: manifest.tags ?? [],
    note: manifest.note,
    summary: manifest.summary,
    sha256: manifest.sha256,
    encoding: manifest.encoding,
    replaces: manifest.replaces,
    chunkCount: manifest.chunkHashes.length,
    kind: manifest.kind,
    cw: manifest.cw,
  };
}

function collectManifests(
  rows: V2Tx[],
  opts?: { onlyFrom?: string; onlyArchiveKind?: boolean },
): ArchiveEntry[] {
  const out: ArchiveEntry[] = [];
  for (const tx of rows) {
    if (tx.result === "error" || tx.status === "error") continue;
    if (!tx.raw_input || tx.raw_input === "0x") continue;
    if (opts?.onlyFrom && fromHash(tx) !== opts.onlyFrom.toLowerCase()) continue;
    const manifest = tryParseManifest(tx.raw_input as Hex);
    if (!manifest) continue;
    if (opts?.onlyArchiveKind && manifest.kind !== "pulse-archive") continue;
    out.push(entryFromManifest(tx, manifest));
  }
  return out;
}

/** Prefer newest per sha256 when present. */
export function dedupeBySha256(entries: ArchiveEntry[]): ArchiveEntry[] {
  const seen = new Set<string>();
  const out: ArchiveEntry[] = [];
  const sorted = [...entries].sort((a, b) => b.timeStamp - a.timeStamp);
  for (const e of sorted) {
    const key = e.sha256 ? `sha:${e.sha256}` : `hash:${e.hash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export async function listArchiveFromSink(opts?: {
  maxItems?: number;
  onlyArchiveKind?: boolean;
}): Promise<ArchiveEntry[]> {
  const rows = await fetchAddressTxsPaged(ARCHIVE_SINK, {
    pageSize: 50,
    maxItems: opts?.maxItems ?? 500,
    maxPages: 20,
  });
  return collectManifests(rows, { onlyArchiveKind: opts?.onlyArchiveKind });
}

export async function listArchiveFromAuthor(
  author: `0x${string}`,
  opts?: { maxItems?: number },
): Promise<ArchiveEntry[]> {
  const rows = await fetchAddressTxsPaged(author, {
    pageSize: 50,
    maxItems: opts?.maxItems ?? 500,
    maxPages: 20,
  });
  return collectManifests(rows, { onlyFrom: author });
}
