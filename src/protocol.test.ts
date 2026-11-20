import { describe, expect, it } from "vitest";
import {
  APP_VERSION,
  MAX_PUBLISH_BYTES,
  bytesToHex,
  decodeChunkPayload,
  decodeChunkTxInput,
  docTypeFromMime,
  hexToBytes,
  parseRouteHash,
  parseTags,
  shouldSkipGzip,
  splitBytes,
  tryParseLike,
  utf8ToHex,
  CHUNK_BYTES,
} from "./protocol";

describe("shouldSkipGzip", () => {
  it("skips packed media", () => {
    expect(shouldSkipGzip("image/jpeg")).toBe(true);
    expect(shouldSkipGzip("video/mp4")).toBe(true);
    expect(shouldSkipGzip("audio/mpeg")).toBe(true);
    expect(shouldSkipGzip("application/pdf")).toBe(true);
    expect(shouldSkipGzip("application/zip")).toBe(true);
  });

  it("allows text", () => {
    expect(shouldSkipGzip("text/plain")).toBe(false);
    expect(shouldSkipGzip("application/json")).toBe(false);
  });
});

describe("chunk codecs", () => {
  it("hex roundtrips", () => {
    const src = new Uint8Array([0, 1, 255, 16, 32]);
    expect([...hexToBytes(bytesToHex(src))]).toEqual([...src]);
  });

  it("decodes legacy base64 JSON", () => {
    const raw = new Uint8Array([72, 105]); // Hi
    const b64 = btoa(String.fromCharCode(...raw));
    const json = JSON.stringify({ chunkData: b64, mimeType: "text/plain" });
    const hex = ("0x" +
      [...new TextEncoder().encode(json)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")) as `0x${string}`;
    expect([...decodeChunkTxInput(hex)]).toEqual([...raw]);
  });

  it("decodes raw calldata", () => {
    const raw = new Uint8Array([9, 8, 7, 6]);
    const hex = (`0x${bytesToHex(raw)}`) as `0x${string}`;
    expect([...decodeChunkTxInput(hex)]).toEqual([...raw]);
  });

  it("decodeChunkPayload requires data", () => {
    expect(() => decodeChunkPayload({ mimeType: "text/plain" })).toThrow();
  });
});

describe("helpers", () => {
  it("parses route hash", () => {
    const h =
      "0x99dc0376f563ea78ecd5a6faff167d732cc5ae528b47e4121f074128a97e537d";
    expect(parseRouteHash(`#/369/${h}`)).toBe(h.toLowerCase());
    expect(parseRouteHash("nope")).toBeNull();
  });

  it("parses tags", () => {
    expect(parseTags("Hex, #Meta,  ")).toEqual(["hex", "meta"]);
  });

  it("doc types", () => {
    expect(docTypeFromMime("image/png")).toBe("image");
    expect(docTypeFromMime("text/plain")).toBe("text");
  });

  it("splits chunks", () => {
    const big = new Uint8Array(CHUNK_BYTES + 10);
    expect(splitBytes(big)).toHaveLength(2);
    expect(splitBytes(new Uint8Array(0))).toHaveLength(1);
  });

  it("exports caps", () => {
    expect(MAX_PUBLISH_BYTES).toBe(150 * 1024);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("likes", () => {
  it("parses like calldata", () => {
    const manifest =
      "0x99dc0376f563ea78ecd5a6faff167d732cc5ae528b47e4121f074128a97e537d";
    const data = utf8ToHex(
      JSON.stringify({
        kind: "pulse-archive-like",
        manifest,
        app: "pulse-archive",
      }),
    );
    const like = tryParseLike(data);
    expect(like?.manifest).toBe(manifest.toLowerCase());
    expect(like?.kind).toBe("pulse-archive-like");
  });

  it("rejects docs as likes", () => {
    const data = utf8ToHex(
      JSON.stringify({
        mimeType: "text/plain",
        chunkHashes: [
          "0x99dc0376f563ea78ecd5a6faff167d732cc5ae528b47e4121f074128a97e537d",
        ],
      }),
    );
    expect(tryParseLike(data)).toBeNull();
  });
});
