import { describe, expect, it } from "vitest";
import { imageDataToTypeCut } from "./typeCut";

function solid(
  w: number,
  h: number,
  rgb: [number, number, number],
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("imageDataToTypeCut", () => {
  it("fills dark image with phrase letters", () => {
    const out = imageDataToTypeCut(solid(20, 20, [0, 0, 0]), {
      width: 40,
      phrase: "AB",
      threshold: 0.9,
    });
    expect(out).toMatch(/A/);
    expect(out).toMatch(/B/);
    expect(out.split("\n")[0]!.length).toBeLessThanOrEqual(40);
  });

  it("leaves light image mostly blank", () => {
    const out = imageDataToTypeCut(solid(20, 20, [255, 255, 255]), {
      width: 40,
      phrase: "HELLO",
      threshold: 0.5,
    });
    expect(out.trim()).toBe("");
  });
});
