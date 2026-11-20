import type { Hash } from "viem";
import type { LikeEntry } from "./archive";
import { dedupeLikes } from "./archive";

const DB_NAME = "pulse-archive-likes";
const STORE = "likes";
const DB_VERSION = 1;
const MAX_LIKES = 8000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "hash" });
        store.createIndex("manifest", "manifest", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("likes db open failed"));
  });
}

export async function listCachedLikes(): Promise<LikeEntry[]> {
  try {
    const db = await openDb();
    const all = await new Promise<LikeEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as LikeEntry[]) || []);
      req.onerror = () => reject(req.error);
    });
    return dedupeLikes(all);
  } catch {
    return [];
  }
}

export async function upsertCachedLikes(likes: LikeEntry[]): Promise<void> {
  if (!likes.length) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const l of likes) {
        store.put({
          ...l,
          hash: l.hash.toLowerCase() as Hash,
          manifest: l.manifest.toLowerCase() as Hash,
          from: l.from.toLowerCase(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await trimLikes(db);
  } catch {
    /* best-effort */
  }
}

async function trimLikes(db: IDBDatabase): Promise<void> {
  const all = await new Promise<LikeEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as LikeEntry[]) || []);
    req.onerror = () => reject(req.error);
  });
  if (all.length <= MAX_LIKES) return;
  const sorted = [...all].sort((a, b) => (a.timeStamp || 0) - (b.timeStamp || 0));
  const drop = sorted.slice(0, all.length - MAX_LIKES);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const d of drop) tx.objectStore(STORE).delete(d.hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
