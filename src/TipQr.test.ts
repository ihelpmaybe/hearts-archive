import { describe, expect, it } from "vitest";
import { tipQrPayload } from "./TipQr";

describe("tipQrPayload", () => {
  const addr = "0x1111111111111111111111111111111111111111";

  it("builds address-only EIP-681 on Pulse", () => {
    expect(tipQrPayload(addr)).toBe(`ethereum:${addr}@369`);
  });

  it("includes value wei when amount set", () => {
    expect(tipQrPayload(addr, "1")).toBe(
      `ethereum:${addr}@369?value=1000000000000000000`,
    );
  });

  it("rejects bad address", () => {
    expect(tipQrPayload("not-an-address")).toBeNull();
  });
});
