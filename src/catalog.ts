import type { Hash } from "viem";
import type { ArchiveEntry } from "./archive";

const DB_NAME = "pulse-archive-catalog";
const STORE = "entries";
const DB_VERSION = 1;
const MAX_ENTRIES = 5000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "hash" });
        store.createIndex("sha256", "sha256", { unique: false });
        store.createIndex("timeStamp", "timeStamp", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("catalog open failed"));
  });
}

export async function upsertCatalog(entries: ArchiveEntry[]): Promise<void> {
  if (!entries.length) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const e of entries) {
        store.put({ ...e, hash: e.hash.toLowerCase() as Hash });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await trimCatalog(db);
  } catch {
    /* best-effort */
  }
}

async function trimCatalog(db: IDBDatabase): Promise<void> {
  const all = await new Promise<ArchiveEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as ArchiveEntry[]) || []);
    req.onerror = () => reject(req.error);
  });
  if (all.length <= MAX_ENTRIES) return;
  const sorted = [...all].sort((a, b) => (a.timeStamp || 0) - (b.timeStamp || 0));
  const drop = sorted.slice(0, all.length - MAX_ENTRIES);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const d of drop) tx.objectStore(STORE).delete(d.hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listCatalog(): Promise<ArchiveEntry[]> {
  try {
    const db = await openDb();
    const all = await new Promise<ArchiveEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as ArchiveEntry[]) || []);
      req.onerror = () => reject(req.error);
    });
    return all.sort((a, b) => (b.timeStamp || 0) - (a.timeStamp || 0));
  } catch {
    return [];
  }
}

export async function findCatalogBySha256(
  sha256: string,
): Promise<ArchiveEntry | null> {
  const want = sha256.toLowerCase();
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const idx = tx.objectStore(STORE).index("sha256");
      const req = idx.get(want);
      req.onsuccess = () => resolve((req.result as ArchiveEntry) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
