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
    expect(normalizeHandle("@@writer")).toBe("writer");
    expect(displayHandle("writer")).toBe("@writer");
    expect(telegramUrl("@writer")).toBe("https://t.me/writer");
    expect(twitterUrl("writer")).toBe("https://x.com/writer");
  });

  it("picks first preferred tip token", () => {
    expect(preferredTipTokenId("HEX, PLS", ["PLS", "HEX", "INC"])).toBe(
      "HEX",
    );
    expect(preferredTipTokenId("nope", ["PLS"])).toBeNull();
  });
});
