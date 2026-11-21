import type { Hash } from "viem";
import type { ArchiveEntry, FrontBidEntry, LikeEntry } from "./archive";
import type { DocType } from "./protocol";
import { putCachedDoc } from "./cache";
import { upsertCatalog } from "./catalog";

export type LabSeed = {
  generatedAt?: string;
  source?: string;
  note?: string;
  entries?: Array<{
    hash: string;
    from?: string;
    timestamp?: string | null;
    title?: string;
    mimeType?: string;
    type?: string | null;
    tags?: string[];
    summary?: string | null;
    sha256?: string | null;
    encoding?: string | null;
    replaces?: string | null;
    kind?: string | null;
    chunkCount?: number;
    cw?: boolean;
  }>;
  bodies?: Record<string, string>;
  likes?: Array<{
    hash: string;
    from: string;
    manifest: string;
    timeStamp?: number;
  }>;
  fronts?: Array<{
    hash: string;
    from: string;
    manifest: string;
    valueWei: string;
    timeStamp?: number;
  }>;
};

export async function loadLabSeed(): Promise<{
  entries: ArchiveEntry[];
  likes: LikeEntry[];
  fronts: FrontBidEntry[];
  bodies: Map<string, string>;
  meta: { note?: string; generatedAt?: string };
} | null> {
  try {
    const res = await fetch(`/lab-seed.json?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const seed = (await res.json()) as LabSeed;
    if (!Array.isArray(seed.entries) || seed.entries.length === 0) return null;

    const entries: ArchiveEntry[] = seed.entries
      .filter((e) => e.hash && e.mimeType)
      .map((e) => {
        const ts = e.timestamp ? Date.parse(e.timestamp) / 1000 : 0;
        return {
          hash: e.hash.toLowerCase() as Hash,
          from: (e.from || "").toLowerCase(),
          timeStamp: Number.isFinite(ts) ? ts : 0,
          title: e.title?.trim() || "(untitled)",
          mimeType: e.mimeType!,
          type: (e.type as DocType) || undefined,
          tags: e.tags || [],
          summary: e.summary || undefined,
          sha256: e.sha256 || undefined,
          encoding: e.encoding || undefined,
          replaces: e.replaces || undefined,
          chunkCount: e.chunkCount || 1,
          kind: e.kind || "pulse-archive",
          cw: !!e.cw,
        };
      });

    const bodies = new Map<string, string>();
    if (seed.bodies) {
      for (const [h, text] of Object.entries(seed.bodies)) {
        bodies.set(h.toLowerCase(), text);
        const entry = entries.find((e) => e.hash === h.toLowerCase());
        if (!entry) continue;
        const bytes = new TextEncoder().encode(text);
        await putCachedDoc({
          hash: entry.hash,
          mimeType: entry.mimeType,
          title: entry.title,
          tags: entry.tags,
          summary: entry.summary,
          type: entry.type,
          sha256: entry.sha256,
          encoding: entry.encoding,
          replaces: entry.replaces,
          cw: entry.cw,
          from: entry.from,
          postedAt: entry.timeStamp || undefined,
          chunkCount: entry.chunkCount,
          bytes: bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
          savedAt: Date.now(),
        });
      }
    }

    await upsertCatalog(entries);

    const likes: LikeEntry[] = (seed.likes || []).map((l) => ({
      hash: l.hash.toLowerCase() as Hash,
      from: l.from.toLowerCase(),
      timeStamp: l.timeStamp || 0,
      manifest: l.manifest.toLowerCase() as Hash,
    }));

    // No fake A1 — Open stays empty until a real / local-test bid.
    const fronts: FrontBidEntry[] = (seed.fronts || [])
      .map((f) => {
        try {
          return {
            hash: f.hash.toLowerCase() as Hash,
            from: f.from.toLowerCase(),
            timeStamp: f.timeStamp || 0,
            manifest: f.manifest.toLowerCase() as Hash,
            valueWei: BigInt(f.valueWei),
          };
        } catch {
          return null;
        }
      })
      .filter((f): f is FrontBidEntry => !!f && f.valueWei > 0n);

    return {
      entries,
      likes,
      fronts,
      bodies,
      meta: { note: seed.note, generatedAt: seed.generatedAt },
    };
  } catch {
    return null;
  }
}
