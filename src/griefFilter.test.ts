import { describe, expect, it } from "vitest";
import { isDustFrontWei, MIN_FRONT_WEI } from "./griefFilter";

describe("griefFilter", () => {
  it("treats sub-0.001 PLS as dust", () => {
    expect(isDustFrontWei(0n)).toBe(true);
    expect(isDustFrontWei(MIN_FRONT_WEI - 1n)).toBe(true);
    expect(isDustFrontWei(MIN_FRONT_WEI)).toBe(false);
    expect(isDustFrontWei(10n ** 18n)).toBe(false);
  });
});
