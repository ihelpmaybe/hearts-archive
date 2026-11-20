import type { ArchiveEntry } from "./archive";
import { listCatalog, upsertCatalog } from "./catalog";
import { listShelf, pinToShelf, type ShelfEntry } from "./shelf";

export type LocalBackup = {
  kind: "hearts-archive-backup";
  version: 1;
  exportedAt: number;
  shelf: ShelfEntry[];
  catalog: ArchiveEntry[];
};

export async function buildLocalBackup(): Promise<LocalBackup> {
  const shelf = listShelf();
  const catalog = await listCatalog();
  return {
    kind: "hearts-archive-backup",
    version: 1,
    exportedAt: Date.now(),
    shelf,
    catalog,
  };
}

export async function applyLocalBackup(
  raw: unknown,
): Promise<{ shelf: number; catalog: number }> {
  const data = raw as Partial<LocalBackup>;
  if (data?.kind !== "hearts-archive-backup" || data.version !== 1) {
    throw new Error("Not a Heart’s Archive backup file");
  }
  const shelf = Array.isArray(data.shelf) ? data.shelf : [];
  const catalog = Array.isArray(data.catalog) ? data.catalog : [];
  for (const row of shelf) {
    if (row?.hash) pinToShelf(row);
  }
  if (catalog.length) await upsertCatalog(catalog);
  return { shelf: shelf.length, catalog: catalog.length };
}

export function downloadBackupJson(backup: LocalBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hearts-archive-backup-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
