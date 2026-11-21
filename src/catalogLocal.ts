import type { Hash } from "viem";
import type { ArchiveEntry } from "./archive";
import type { DocType } from "./protocol";
import { publicUrl } from "./publicUrl";

type CatalogFile = {
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
    kind?: string | null;
    chunkCount?: number;
    cw?: boolean;
  }>;
};

/** Optional static file from `npm run catalog` → public/catalog.json */
export async function loadLocalCatalog(): Promise<ArchiveEntry[]> {
  try {
    const res = await fetch(`${publicUrl("catalog.json")}?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as CatalogFile;
    if (!Array.isArray(body.entries)) return [];
    return body.entries
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
          chunkCount: e.chunkCount || 1,
          kind: e.kind || undefined,
          cw: !!e.cw,
        } satisfies ArchiveEntry;
      });
  } catch {
    return [];
  }
}
