import type { Hash, Hex } from "viem";
import {
  ARCHIVE_SINK,
  tryParseFrontBid,
  tryParseLike,
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

export type LikeEntry = {
  hash: Hash;
  from: string;
  timeStamp: number;
  manifest: Hash;
};

/** PLS deposited with a front-page claim for a manifest. */
export type FrontBidEntry = {
  hash: Hash;
  from: string;
  timeStamp: number;
  manifest: Hash;
  valueWei: bigint;
};

type V2Tx = {
  hash: string;
  timestamp?: string | null;
  result?: string | null;
  status?: string | null;
  raw_input?: string | null;
  value?: string | { value?: string } | null;
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

function txValueWei(tx: V2Tx): bigint {
  const raw =
    typeof tx.value === "string"
      ? tx.value
      : tx.value && typeof tx.value === "object"
        ? tx.value.value
        : undefined;
  if (!raw) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
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
  opts?: {
    pageSize?: number;
    maxItems?: number;
    maxPages?: number;
    /** Stop after this many consecutive txs already in local catalog (incremental Sync). */
    stopAfterKnown?: number;
    knownHashes?: Set<string>;
    /** Pause between pages — kinder to explorer. */
    pageGapMs?: number;
  },
): Promise<V2Tx[]> {
  const pageSize = opts?.pageSize ?? 50;
  const maxItems = opts?.maxItems ?? 500;
  const maxPages = opts?.maxPages ?? 20;
  const stopAfterKnown = opts?.stopAfterKnown ?? 0;
  const known = opts?.knownHashes;
  const pageGapMs = opts?.pageGapMs ?? 120;
  const out: V2Tx[] = [];
  const seen = new Set<string>();
  let pageParams: PageParams | null = null;
  let knownStreak = 0;

  for (let page = 0; page < maxPages && out.length < maxItems; page++) {
    if (page > 0 && pageGapMs > 0) {
      await new Promise((r) => setTimeout(r, pageGapMs));
    }
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
      if (known && stopAfterKnown > 0) {
        if (known.has(h)) {
          knownStreak += 1;
          if (knownStreak >= stopAfterKnown) {
            return out;
          }
        } else {
          knownStreak = 0;
        }
      }
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

export function collectLikes(rows: V2Tx[]): LikeEntry[] {
  const out: LikeEntry[] = [];
  for (const tx of rows) {
    if (tx.result === "error" || tx.status === "error") continue;
    if (!tx.raw_input || tx.raw_input === "0x") continue;
    const like = tryParseLike(tx.raw_input as Hex);
    if (!like) continue;
    const ts = tx.timestamp ? Date.parse(tx.timestamp) / 1000 : 0;
    out.push({
      hash: tx.hash.toLowerCase() as Hash,
      from: fromHash(tx),
      timeStamp: Number.isFinite(ts) ? ts : 0,
      manifest: like.manifest,
    });
  }
  return out;
}

/** Unique likes per (manifest, from) — latest wins. */
export function dedupeLikes(likes: LikeEntry[]): LikeEntry[] {
  const seen = new Set<string>();
  const out: LikeEntry[] = [];
  const sorted = [...likes].sort((a, b) => b.timeStamp - a.timeStamp);
  for (const l of sorted) {
    const key = `${l.manifest}:${l.from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

export function countLikesByManifest(likes: LikeEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of dedupeLikes(likes)) {
    map.set(l.manifest, (map.get(l.manifest) || 0) + 1);
  }
  return map;
}

export function hasLiked(
  likes: LikeEntry[],
  manifest: string,
  from: string,
): boolean {
  const m = manifest.toLowerCase();
  const a = from.toLowerCase();
  return dedupeLikes(likes).some((l) => l.manifest === m && l.from === a);
}

export function collectFrontBids(rows: V2Tx[]): FrontBidEntry[] {
  const out: FrontBidEntry[] = [];
  for (const tx of rows) {
    if (tx.result === "error" || tx.status === "error") continue;
    if (!tx.raw_input || tx.raw_input === "0x") continue;
    const bid = tryParseFrontBid(tx.raw_input as Hex);
    if (!bid) continue;
    const valueWei = txValueWei(tx);
    if (valueWei <= 0n) continue;
    const ts = tx.timestamp ? Date.parse(tx.timestamp) / 1000 : 0;
    out.push({
      hash: tx.hash.toLowerCase() as Hash,
      from: fromHash(tx),
      timeStamp: Number.isFinite(ts) ? ts : 0,
      manifest: bid.manifest,
      valueWei,
    });
  }
  return out;
}

/** One winning bid per manifest — highest PLS, newer wins ties. */
export function dedupeFrontBids(bids: FrontBidEntry[]): FrontBidEntry[] {
  const best = new Map<string, FrontBidEntry>();
  for (const b of bids) {
    const key = b.manifest.toLowerCase();
    const prev = best.get(key);
    if (
      !prev ||
      b.valueWei > prev.valueWei ||
      (b.valueWei === prev.valueWei && b.timeStamp > prev.timeStamp)
    ) {
      best.set(key, b);
    }
  }
  return [...best.values()].sort((a, b) => {
    if (b.valueWei !== a.valueWei) return b.valueWei > a.valueWei ? 1 : -1;
    return b.timeStamp - a.timeStamp;
  });
}

/** Absolute front-page winner across all bids. */
export function winningFrontBid(
  bids: FrontBidEntry[],
): FrontBidEntry | null {
  const ranked = dedupeFrontBids(bids);
  return ranked[0] || null;
}

export function bidForManifest(
  bids: FrontBidEntry[],
  manifest: string,
): FrontBidEntry | null {
  const m = manifest.toLowerCase();
  return (
    dedupeFrontBids(bids).find((b) => b.manifest.toLowerCase() === m) || null
  );
}

export async function listSinkBundle(opts?: {
  maxItems?: number;
  onlyArchiveKind?: boolean;
  knownHashes?: Set<string>;
  /** Default 8 — stop paging once we hit a streak of txs already cached. */
  stopAfterKnown?: number;
}): Promise<{
  entries: ArchiveEntry[];
  likes: LikeEntry[];
  fronts: FrontBidEntry[];
}> {
  const rows = await fetchAddressTxsPaged(ARCHIVE_SINK, {
    pageSize: 50,
    maxItems: opts?.maxItems ?? 500,
    maxPages: 20,
    knownHashes: opts?.knownHashes,
    stopAfterKnown: opts?.stopAfterKnown ?? (opts?.knownHashes ? 8 : 0),
  });
  return {
    entries: collectManifests(rows, {
      onlyArchiveKind: opts?.onlyArchiveKind,
    }),
    likes: collectLikes(rows),
    fronts: collectFrontBids(rows),
  };
}

export async function listArchiveFromSink(opts?: {
  maxItems?: number;
  onlyArchiveKind?: boolean;
}): Promise<ArchiveEntry[]> {
  const { entries } = await listSinkBundle(opts);
  return entries;
}

export async function listArchiveFromAuthor(
  author: `0x${string}`,
  opts?: { maxItems?: number; knownHashes?: Set<string> },
): Promise<ArchiveEntry[]> {
  const rows = await fetchAddressTxsPaged(author, {
    pageSize: 50,
    maxItems: opts?.maxItems ?? 500,
    maxPages: 20,
    knownHashes: opts?.knownHashes,
    stopAfterKnown: opts?.knownHashes ? 8 : 0,
  });
  return collectManifests(rows, { onlyFrom: author });
}
