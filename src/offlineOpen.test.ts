import { describe, expect, it } from "vitest";
import { offlineOpenHint } from "./offlineOpen";

describe("offline deep-link", () => {
  it("allows silent local open when cached", () => {
    expect(
      offlineOpenHint({ hasCache: true, online: false, rpcReady: false }),
    ).toBeNull();
  });

  it("explains offline miss in plain English", () => {
    expect(
      offlineOpenHint({ hasCache: false, online: false, rpcReady: false }),
    ).toMatch(/Offline and no local copy/);
  });

  it("explains missing RPC when online", () => {
    expect(
      offlineOpenHint({ hasCache: false, online: true, rpcReady: false }),
    ).toMatch(/RPC not ready/);
  });
});
