import { describe, expect, it } from "vitest";
import { packArticle, unpackArticle } from "./articleFormat";

describe("articleFormat", () => {
  it("packs picture above body", () => {
    const raw = packArticle("@@@\n###", "Hello press.");
    const parts = unpackArticle(raw);
    expect(parts.picture).toBe("@@@\n###");
    expect(parts.body).toBe("Hello press.");
  });

  it("legacy text is all body", () => {
    expect(unpackArticle("just a note")).toEqual({
      picture: "",
      body: "just a note",
    });
  });

  it("picture-only still packs", () => {
    const raw = packArticle("XXX", "");
    expect(unpackArticle(raw).picture).toBe("XXX");
    expect(unpackArticle(raw).body).toBe("");
  });
});
