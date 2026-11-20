import { describe, expect, it } from "vitest";
import { softMuteHit } from "./softMute";

describe("softMuteHit", () => {
  it("flags blunt lewd tokens", () => {
    expect(softMuteHit("free porn tips")).toBe(true);
    expect(softMuteHit("NSFW gallery")).toBe(true);
  });

  it("passes ordinary press copy", () => {
    expect(softMuteHit("Foundry lab vs Pulse mainnet")).toBe(false);
    expect(softMuteHit("Security note: never paste seeds")).toBe(false);
  });
});
