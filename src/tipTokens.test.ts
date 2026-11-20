import { describe, expect, it } from "vitest";
import {
  TIP_PRESETS,
  loadRecentTipTokens,
  rememberTipToken,
} from "./tipTokens";

describe("tip presets", () => {
  it("uses Pulse pHEX / INC addresses (not Ethereum HEX)", () => {
    const hex = TIP_PRESETS.find((t) => t.id === "HEX");
    const inc = TIP_PRESETS.find((t) => t.id === "INC");
    const ehex = TIP_PRESETS.find((t) => t.id === "eHEX");
    expect(hex?.address?.toLowerCase()).toBe(
      "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39",
    );
    expect(inc?.address?.toLowerCase()).toBe(
      "0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d",
    );
    expect(ehex?.address?.toLowerCase()).toBe(
      "0x57fde0a71132198bbec939b98976993d8d89d225",
    );
    // Classic ETH HEX must not be the Pulse tip target
    expect(hex?.address?.toLowerCase()).not.toBe(
      "0x2b591e99afe9f83e28fa1776971e1219904ea658",
    );
  });

  it("remembers last custom tip tokens", () => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, String(v));
      },
      removeItem: (k) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };
    rememberTipToken("0x1111111111111111111111111111111111111111");
    rememberTipToken("0x2222222222222222222222222222222222222222");
    rememberTipToken("0x3333333333333333333333333333333333333333");
    rememberTipToken("0x4444444444444444444444444444444444444444");
    const recent = loadRecentTipTokens();
    expect(recent).toHaveLength(3);
    expect(recent[0]).toBe("0x4444444444444444444444444444444444444444");
  });
});
