import type { Hash } from "viem";
import type { DocType } from "./protocol";

const DB_NAME = "pulse-archive-cache";
const STORE = "docs";
const DB_VERSION = 1;
/** Keep opened docs offline so re-reads skip RPC. */
const MAX_DOCS = 500;

export type CachedDoc = {
  hash: Hash;
  mimeType: string;
  title?: string;
  tags?: string[];
  note?: string;
  summary?: string;
  type?: DocType;
  sha256?: string;
  encoding?: string;
  replaces?: string;
  cw?: boolean;
  from?: string;
  postedAt?: number;
  chunkCount: number;
  bytes: ArrayBuffer;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "hash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function getCachedDoc(hash: Hash): Promise<CachedDoc | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(hash.toLowerCase());
      req.onsuccess = () => resolve((req.result as CachedDoc) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function putCachedDoc(doc: CachedDoc): Promise<void> {
  try {
    const db = await openDb();
    const row = { ...doc, hash: doc.hash.toLowerCase() as Hash, savedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await trimCache(db);
  } catch {
    // cache is best-effort
  }
}

async function trimCache(db: IDBDatabase): Promise<void> {
  const all = await new Promise<CachedDoc[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as CachedDoc[]) || []);
    req.onerror = () => reject(req.error);
  });
  if (all.length <= MAX_DOCS) return;
  const sorted = [...all].sort((a, b) => a.savedAt - b.savedAt);
  const drop = sorted.slice(0, all.length - MAX_DOCS);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const d of drop) tx.objectStore(STORE).delete(d.hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listCachedSummaries(): Promise<
  { hash: Hash; title: string; mimeType: string; savedAt: number }[]
> {
  try {
    const db = await openDb();
    const all = await new Promise<CachedDoc[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as CachedDoc[]) || []);
      req.onerror = () => reject(req.error);
    });
    return all
      .map((d) => ({
        hash: d.hash,
        title: d.title?.trim() || "(untitled)",
        mimeType: d.mimeType,
        savedAt: d.savedAt,
      }))
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, 12);
  } catch {
    return [];
  }
}
