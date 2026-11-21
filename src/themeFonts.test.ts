import { describe, expect, it } from "vitest";
import { FONT_PRESETS } from "./theme";

/** Pull quoted family names from a CSS font-family stack. */
function quotedFamilies(stack: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stack))) out.push(m[1]!);
  return out;
}

/** Google CSS2 query uses + for spaces in family names. */
function googleMentions(google: string, family: string): boolean {
  const token = family.replace(/ /g, "+");
  return google.includes(token);
}

describe("FONT_PRESETS", () => {
  it("keeps unique ids and required roles", () => {
    const ids = FONT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of FONT_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.faces.split("·").length).toBeGreaterThanOrEqual(2);
      expect(p.vars["--font-nameplate"]).toBeTruthy();
      expect(p.vars["--font-display"]).toBeTruthy();
      expect(p.vars["--font-body"]).toBeTruthy();
      expect(p.vars["--font-ui"]).toBeTruthy();
    }
  });

  it("loads every quoted family via the google string (when present)", () => {
    for (const p of FONT_PRESETS) {
      if (!p.fonts.google) continue;
      const stacks = [
        p.vars["--font-nameplate"],
        p.vars["--font-display"],
        p.vars["--font-body"],
        p.vars["--font-ui"],
      ].filter(Boolean) as string[];
      for (const stack of stacks) {
        for (const family of quotedFamilies(stack)) {
          // System fallbacks are not on Google
          if (
            /Segoe UI|Arial|Impact|Georgia|Times|system-ui|ui-monospace|monospace|Avenir/i.test(
              family,
            )
          ) {
            continue;
          }
          expect(
            googleMentions(p.fonts.google, family),
            `${p.id}: "${family}" missing from google query`,
          ).toBe(true);
        }
      }
    }
  });
});
