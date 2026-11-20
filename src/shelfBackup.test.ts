import { describe, expect, it, beforeEach } from "vitest";
import {
  applyLocalBackup,
  buildLocalBackup,
  type LocalBackup,
} from "./shelfBackup";
import { clearShelf, listShelf, pinToShelf } from "./shelf";

function mockStorage() {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
}

const sample = {
  hash: ("0x" + "ab".repeat(32)) as `0x${string}`,
  from: "0xabc",
  timeStamp: 100,
  title: "backup demo",
  mimeType: "text/plain",
  type: "text" as const,
  tags: ["lab"],
  chunkCount: 1,
  kind: "pulse-archive",
};

describe("shelf backup round-trip", () => {
  beforeEach(() => {
    mockStorage();
  });

  it("export → wipe → import restores shelf", async () => {
    pinToShelf(sample);
    expect(listShelf()).toHaveLength(1);

    const backup = await buildLocalBackup();
    expect(backup.kind).toBe("hearts-archive-backup");
    expect(backup.shelf).toHaveLength(1);

    clearShelf();
    expect(listShelf()).toHaveLength(0);

    const n = await applyLocalBackup(backup as LocalBackup);
    expect(n.shelf).toBe(1);
    expect(listShelf()[0]?.title).toBe("backup demo");
  });

  it("rejects foreign JSON", async () => {
    await expect(applyLocalBackup({ kind: "nope" })).rejects.toThrow(
      /backup/i,
    );
  });
});
