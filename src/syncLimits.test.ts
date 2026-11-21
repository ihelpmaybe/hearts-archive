import { describe, expect, it } from "vitest";
import { computeSyncLimits } from "./syncLimits";

describe("computeSyncLimits", () => {
  it("cold Sync walks more pages than the old tip-only 2", () => {
    const c = computeSyncLimits(null);
    expect(c.cold).toBe(true);
    expect(c.maxPages).toBeGreaterThanOrEqual(6);
    expect(c.stopAfterKnown).toBe(0);
  });

  it("warm Sync early-stops on known streak", () => {
    const c = computeSyncLimits(Date.now() - 3600_000);
    expect(c.cold).toBe(false);
    expect(c.stopAfterKnown).toBe(8);
    expect(c.maxPages).toBeGreaterThanOrEqual(3);
  });
});
