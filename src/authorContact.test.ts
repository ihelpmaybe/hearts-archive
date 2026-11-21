import { describe, expect, it } from "vitest";
import {
  displayHandle,
  normalizeHandle,
  preferredTipTokenId,
  telegramUrl,
  twitterUrl,
} from "./authorContact";

describe("authorContact", () => {
  it("normalizes handles", () => {
    expect(normalizeHandle("@@pump")).toBe("pump");
    expect(displayHandle("pump")).toBe("@pump");
    expect(telegramUrl("@pump")).toBe("https://t.me/pump");
    expect(twitterUrl("pump")).toBe("https://x.com/pump");
  });

  it("picks first preferred tip token", () => {
    expect(preferredTipTokenId("HEX, PLS", ["PLS", "HEX", "INC"])).toBe(
      "HEX",
    );
    expect(preferredTipTokenId("nope", ["PLS"])).toBeNull();
  });
});
