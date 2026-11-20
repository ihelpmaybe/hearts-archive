import { createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

export const ARCHIVE_SINK =
  "0x000000000000000000000000000000000000feed";
export const CHUNK_BYTES = 20 * 1024;
export const MAX_PUBLISH_BYTES = 150 * 1024;
export const APP_NAME = "pulse-archive";
export const APP_VERSION = "0.5.0";

export function shouldSkipGzip(mime) {
  const m = mime.toLowerCase();
  return (
    m.startsWith("image/") ||
    m.startsWith("video/") ||
    m.startsWith("audio/") ||
    m.includes("zip") ||
    m.includes("gzip") ||
    m.includes("pdf") ||
    m.includes("ogg") ||
    m.includes("wasm")
  );
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

export function utf8ToHex(text) {
  return `0x${Buffer.from(text, "utf8").toString("hex")}`;
}

export function hexToUtf8(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(h, "hex").toString("utf8");
}

export function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

export function hexToBytes(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(h, "hex");
}

export function docTypeFromMime(mime) {
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("json")) return "json";
  if (mime.includes("html")) return "html";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

export function splitBytes(bytes) {
  const parts = [];
  const n = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
  for (let i = 0; i < n; i++) {
    parts.push(bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
  }
  return parts;
}

export function preparePayload(bytes, mimeType) {
  const original = Buffer.from(bytes);
  if (original.length > MAX_PUBLISH_BYTES) {
    throw new Error(
      `Too large (${(original.length / 1024).toFixed(0)} KB). Cap is ${MAX_PUBLISH_BYTES / 1024} KB.`,
    );
  }
  const sha256 = sha256Hex(original);
  let stored = original;
  let encoding = "raw";
  if (!shouldSkipGzip(mimeType)) {
    try {
      const gz = gzipSync(original, { level: 9 });
      if (gz.length < original.length * 0.98) {
        stored = gz;
        encoding = "gzip";
      }
    } catch {
      /* raw */
    }
  }
  const savedPct =
    original.length === 0
      ? 0
      : Math.max(0, Math.round((1 - stored.length / original.length) * 100));
  return {
    mimeType,
    type: docTypeFromMime(mimeType),
    originalBytes: original.length,
    storedBytes: stored.length,
    encoding,
    sha256,
    parts: splitBytes(stored),
    savedPct,
  };
}

export function buildManifest({ prepared, meta, chunkHashes }) {
  const replaces = meta.replaces?.trim?.() || meta.replaces;
  return {
    kind: "pulse-archive",
    app: APP_NAME,
    appVersion: APP_VERSION,
    mimeType: prepared.mimeType,
    type: meta.type || prepared.type,
    encoding: prepared.encoding,
    sha256: prepared.sha256,
    originalBytes: prepared.originalBytes,
    storedBytes: prepared.storedBytes,
    chunkHashes,
    ...(meta.title ? { title: String(meta.title).slice(0, 120) } : {}),
    ...(meta.tags?.length ? { tags: meta.tags } : {}),
    ...(meta.note ? { note: String(meta.note).slice(0, 280) } : {}),
    ...(meta.summary ? { summary: String(meta.summary).slice(0, 300) } : {}),
    ...(meta.lang ? { lang: String(meta.lang).slice(0, 16) } : {}),
    ...(meta.license ? { license: String(meta.license).slice(0, 64) } : {}),
    ...(replaces && /^0x[a-fA-F0-9]{64}$/i.test(replaces)
      ? { replaces: replaces.toLowerCase() }
      : {}),
    ...(meta.cw ? { cw: true } : {}),
  };
}

/** Legacy JSON+base64 (Raven / early sim). */
export function chunkCalldataLegacy(part, mimeType) {
  return utf8ToHex(
    JSON.stringify({
      chunkData: bytesToBase64(part),
      mimeType,
    }),
  );
}

/** App v0.4+ write path — raw bytes as tx data. */
export function chunkCalldataRaw(part) {
  return `0x${bytesToHex(part)}`;
}

/** Default write = raw (matches app). */
export function chunkCalldata(part) {
  return chunkCalldataRaw(part);
}

export function manifestCalldata(manifest) {
  return utf8ToHex(JSON.stringify(manifest));
}

export function likeCalldata(manifestHash) {
  return utf8ToHex(
    JSON.stringify({
      kind: "pulse-archive-like",
      app: APP_NAME,
      appVersion: APP_VERSION,
      manifest: String(manifestHash).toLowerCase(),
    }),
  );
}

export function tryParseLike(input) {
  try {
    if (!input || input === "0x") return null;
    const obj = JSON.parse(hexToUtf8(input));
    if (obj?.kind !== "pulse-archive-like") return null;
    if (
      typeof obj.manifest !== "string" ||
      !/^0x[a-fA-F0-9]{64}$/i.test(obj.manifest)
    ) {
      return null;
    }
    return {
      kind: "pulse-archive-like",
      manifest: obj.manifest.toLowerCase(),
      app: obj.app,
      appVersion: obj.appVersion,
    };
  } catch {
    return null;
  }
}

export function tryParseManifest(input) {
  try {
    if (!input || input === "0x") return null;
    const obj = JSON.parse(hexToUtf8(input));
    if (
      !obj?.mimeType ||
      !Array.isArray(obj.chunkHashes) ||
      obj.chunkHashes.length === 0
    ) {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export function decodeChunkTxInput(input) {
  const hex = input.startsWith("0x") ? input : `0x${input}`;
  try {
    const text = hexToUtf8(hex);
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{")) {
      const chunk = JSON.parse(trimmed);
      if (chunk.chunkHex) return hexToBytes(`0x${chunk.chunkHex}`);
      if (chunk.chunkData) return Buffer.from(chunk.chunkData, "base64");
      throw new Error("No chunk data");
    }
  } catch {
    /* raw */
  }
  return hexToBytes(hex);
}

export function readDocumentFromChain(publicClientGetTx, manifestHash) {
  // publicClientGetTx(hash) => { input }
  return (async () => {
    const tx = await publicClientGetTx(manifestHash);
    const manifest = tryParseManifest(tx.input);
    if (!manifest) throw new Error("not a manifest");
    const pieces = [];
    for (const h of manifest.chunkHashes) {
      const cTx = await publicClientGetTx(h);
      pieces.push(decodeChunkTxInput(cTx.input));
    }
    let out = Buffer.concat(pieces.map((p) => Buffer.from(p)));
    if (manifest.encoding === "gzip") {
      out = gunzipSync(out);
    }
    const got = sha256Hex(out);
    if (manifest.sha256 && got !== manifest.sha256.toLowerCase()) {
      throw new Error(`sha mismatch got=${got} want=${manifest.sha256}`);
    }
    return { manifest, bytes: out };
  })();
}

export function fakeJpeg(size) {
  const buf = Buffer.alloc(size);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  randomBytes(size - 4).copy(buf, 4);
  return buf;
}

export function estimateGasFromCalldata(dataHex) {
  const bytes = Math.max(0, (dataHex.length - 2) / 2);
  return 21000 + Math.ceil(bytes) * 16;
}
