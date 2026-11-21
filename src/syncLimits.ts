import { SYNC_LOOKBACK_DAYS, syncLookbackCutoffUnix } from "./editions";

/** How deep Sync walks the explorer — spam-safe caps + early stop when warm. */
export type SyncLimits = {
  cold: boolean;
  lookbackDays: number;
  cutoff: number;
  maxItems: number;
  maxPages: number;
  /** Warm Sync: stop after this many consecutive already-known txs. */
  stopAfterKnown: number;
  pageGapMs: number;
};

export function computeSyncLimits(lastSyncMs: number | null | undefined): SyncLimits {
  const cold = !lastSyncMs;
  // Cold: tip-only window (not a 60d crawl). Warm: full schedule lookback.
  const lookbackDays = cold ? 3 : SYNC_LOOKBACK_DAYS;
  const cutoff = syncLookbackCutoffUnix({
    lastSyncMs: lastSyncMs || null,
    lookbackDays,
  });
  const gapSec = Math.max(0, Math.floor(Date.now() / 1000) - cutoff);
  const gapDays = Math.min(
    lookbackDays,
    Math.max(1, Math.ceil(gapSec / 86400)),
  );
  // Cold empty paper: walk enough pages to find real manifests under junk.
  // Warm: scale with absence, hard-cap so a grief flood can't hang the tab.
  const maxItems = cold
    ? 200
    : Math.min(400, Math.max(80, gapDays * 20));
  const maxPages = cold
    ? 8
    : Math.min(12, Math.max(3, Math.ceil(maxItems / 50)));
  return {
    cold,
    lookbackDays,
    cutoff,
    maxItems,
    maxPages,
    stopAfterKnown: cold ? 0 : 8,
    pageGapMs: cold ? 200 : 350,
  };
}
