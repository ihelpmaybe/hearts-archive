import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, faqForFace } from "./faq";

describe("faqForFace", () => {
  it("shows gallery publish answer only on gallery", () => {
    const g = faqForFace("gallery").map((i) => i.id);
    expect(g).toContain("publish");
    expect(g).not.toContain("publish-press");
  });

  it("shows press publish answer on press/studio/desk", () => {
    for (const face of ["press", "studio", "desk"] as const) {
      const ids = faqForFace(face).map((i) => i.id);
      expect(ids).toContain("publish-press");
      expect(ids).not.toContain("publish");
    }
  });

  it("keeps shared items on every face", () => {
    for (const face of ["gallery", "press", "studio", "desk"] as const) {
      const ids = faqForFace(face).map((i) => i.id);
      expect(ids).toContain("what");
      expect(ids).toContain("a1");
      expect(ids).toContain("x");
    }
  });

  it("has unique ids", () => {
    const ids = FAQ_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
