import { describe, expect, it } from "vitest";
import { normalizeTypeCut, typeCutColumns } from "./typeCut";

describe("typeCut normalize", () => {
  it("normalizes jagged lines to one width", () => {
    const raw = "aaaa\nbb\ncccccccccc\nddd";
    const out = normalizeTypeCut(raw);
    const lines = out.split("\n");
    expect(lines.every((l) => l.length === lines[0]!.length)).toBe(true);
    expect(typeCutColumns(out)).toBe(lines[0]!.length);
  });

  it("trims empty outer lines", () => {
    expect(normalizeTypeCut("\n\nabc\ndef\n\n")).toBe("abc\ndef");
  });
});
