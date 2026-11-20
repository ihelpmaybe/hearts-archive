/**
 * Heart’s Archive protocol (PulseChain 369) — wire kind remains pulse-archive
 * Read-compatible with Raven-style manifests; write enriched archive manifests to …feed.
 */
import {
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  formatEther,
  zeroAddress,
} from "viem";

export const APP_NAME = "pulse-archive";
export const APP_VERSION = "0.5.0";
export const CHUNK_BYTES = 20 * 1024;
export const PULSE_CHAIN_ID = 369;
/** Hard cap on original file size before publish (gas / orphan risk). */
export const MAX_PUBLISH_BYTES = 150 * 1024;

/** Mimes that are already packed — gzip usually wastes work. */
export function shouldSkipGzip(mime: string): boolean {
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

/** Shared library inbox — manifests land here for browsing. */
export const ARCHIVE_SINK =
  "0x000000000000000000000000000000000000feed" as const;

export const SCAN_TX = (hash: Hash) =>
  `https://scan.pulsechain.com/tx/${hash}`;
export const SCAN_ADDRESS = (addr: string) =>
  `https://scan.pulsechain.com/address/${addr}`;

export type ChunkPayload = {
  /** Legacy Raven / early Archive — base64 body */
  chunkData?: string;
  /** Prefer — raw bytes as hex (no 0x), ~25–33% less wire than base64+JSON tax still applies but smaller */
  chunkHex?: string;
  mimeType: string;
  parentHash?: number | string;
};

export type DocType =
  | "pdf"
  | "text"
  | "image"
  | "video"
  | "audio"
  | "json"
  | "html"
  | "other";

export type ManifestPayload = {
  mimeType: string;
  chunkHashes: Hash[];
  title?: string;
  tags?: string[];
  note?: string;
  summary?: string;
  kind?: "pulse-archive";
  app?: string;
  appVersion?: string;
  type?: DocType;
  sha256?: string;
  encoding?: "gzip" | "raw";
  replaces?: Hash;
  lang?: string;
  license?: string;
  cw?: boolean;
  originalBytes?: number;
  storedBytes?: number;
};

export type DocMeta = ManifestPayload & {
  chunkHashes: Hash[];
  mimeType: string;
};

export function utf8ToHex(text: string): Hex {
  const bytes = new TextEncoder().encode(text);
  let out = "0x";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out as Hex;
}

export function hexToUtf8(data: Hex | string): string {
  const hex = data.startsWith("0x") ? data.slice(2) : data;
  if (hex.length % 2 !== 0) throw new Error("Odd-length hex calldata");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error("Odd-length chunk hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function decodeChunkPayload(chunk: ChunkPayload): Uint8Array {
  if (chunk.chunkHex) return hexToBytes(chunk.chunkHex);
  if (chunk.chunkData) return base64ToBytes(chunk.chunkData);
  throw new Error("No chunkHex/chunkData");
}

/** Legacy JSON(+base64/hex) or raw binary calldata. */
export function decodeChunkTxInput(input: Hex | string): Uint8Array {
  const hex = input.startsWith("0x") ? input : `0x${input}`;
  try {
    const text = hexToUtf8(hex as Hex);
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{")) {
      return decodeChunkPayload(JSON.parse(trimmed) as ChunkPayload);
    }
  } catch {
    /* raw */
  }
  return hexToBytes(hex);
}

export function docTypeFromMime(mime: string): DocType {
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("json")) return "json";
  if (mime.includes("html")) return "html";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

export function splitBytes(bytes: Uint8Array): Uint8Array[] {
  const parts: Uint8Array[] = [];
  const n = Math.ceil(bytes.length / CHUNK_BYTES) || 1;
  for (let i = 0; i < n; i++) {
    const start = i * CHUNK_BYTES;
    parts.push(bytes.subarray(start, start + CHUNK_BYTES));
  }
  return parts;
}

export function estimateChunks(size: number): number {
  return Math.max(1, Math.ceil(size / CHUNK_BYTES));
}

export function parseRouteHash(hash: string): Hash | null {
  const raw = hash.replace(/^#/, "").trim();
  const m = raw.match(/(0x[a-fA-F0-9]{64})/);
  return m ? (m[1].toLowerCase() as Hash) : null;
}

export function sharePath(manifestHash: Hash): string {
  return `#/${PULSE_CHAIN_ID}/${manifestHash}`;
}

export function shareUrl(manifestHash: Hash): string {
  if (typeof window === "undefined") return sharePath(manifestHash);
  return `${window.location.origin}${window.location.pathname}${sharePath(manifestHash)}`;
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,#]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const dig = await crypto.subtle.digest("SHA-256", asBufferSource(bytes));
  return [...new Uint8Array(dig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return bytes;
  const copy = new Uint8Array(bytes);
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Browser cannot gunzip (no DecompressionStream)");
  }
  const copy = new Uint8Array(bytes);
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type PreparedPublish = {
  mimeType: string;
  type: DocType;
  originalBytes: number;
  storedBytes: number;
  encoding: "gzip" | "raw";
  sha256: string;
  parts: Uint8Array[];
  savedPct: number;
};

export async function preparePublishPayload(file: File): Promise<PreparedPublish> {
  const mimeType = file.type || "application/octet-stream";
  const original = new Uint8Array(await file.arrayBuffer());
  if (original.length > MAX_PUBLISH_BYTES) {
    throw new Error(
      `Too large (${(original.length / 1024).toFixed(0)} KB). Cap is ${MAX_PUBLISH_BYTES / 1024} KB.`,
    );
  }
  const sha256 = await sha256Hex(original);
  let stored: Uint8Array = original;
  let encoding: "gzip" | "raw" = "raw";
  if (!shouldSkipGzip(mimeType)) {
    try {
      const gz = await gzipCompress(original);
      if (gz.length < original.length * 0.98) {
        stored = new Uint8Array(gz);
        encoding = "gzip";
      }
    } catch {
      // keep raw
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

export type ChunkProgress = {
  index: number;
  total: number;
  status: "pending" | "signing" | "confirming" | "done" | "error";
  hash?: Hash;
  error?: string;
};

export function tryParseManifest(input: Hex | string): ManifestPayload | null {
  try {
    if (!input || input === "0x") return null;
    const obj = JSON.parse(hexToUtf8(input)) as ManifestPayload;
    if (!obj?.mimeType || !Array.isArray(obj.chunkHashes) || obj.chunkHashes.length === 0) {
      return null;
    }
    if (
      obj.chunkHashes.some(
        (h) => typeof h !== "string" || !/^0x[a-fA-F0-9]{64}$/i.test(h),
      )
    ) {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

/** On-chain “like” / sign-off — small JSON tx to …feed. */
export type LikePayload = {
  kind: "pulse-archive-like";
  manifest: Hash;
  app?: string;
  appVersion?: string;
};

export function tryParseLike(input: Hex | string): LikePayload | null {
  try {
    if (!input || input === "0x") return null;
    const obj = JSON.parse(hexToUtf8(input)) as Partial<LikePayload>;
    if (obj?.kind !== "pulse-archive-like") return null;
    if (
      typeof obj.manifest !== "string" ||
      !/^0x[a-fA-F0-9]{64}$/i.test(obj.manifest)
    ) {
      return null;
    }
    return {
      kind: "pulse-archive-like",
      manifest: obj.manifest.toLowerCase() as Hash,
      app: obj.app,
      appVersion: obj.appVersion,
    };
  } catch {
    return null;
  }
}

export async function sendLike(opts: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: `0x${string}`;
  manifestHash: Hash;
}): Promise<Hash> {
  const { walletClient, publicClient, account, manifestHash } = opts;
  const payload: LikePayload = {
    kind: "pulse-archive-like",
    app: APP_NAME,
    appVersion: APP_VERSION,
    manifest: manifestHash.toLowerCase() as Hash,
  };
  const data = utf8ToHex(JSON.stringify(payload));
  const hash = await walletClient.sendTransaction({
    account,
    chain: walletClient.chain,
    to: ARCHIVE_SINK,
    value: 0n,
    data,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Like transaction reverted");
  }
  return hash;
}

export type PublishMetaInput = {
  title?: string;
  tags?: string[];
  note?: string;
  summary?: string;
  lang?: string;
  license?: string;
  replaces?: string;
  cw?: boolean;
  type?: DocType;
};

export async function estimatePublishCost(opts: {
  publicClient: PublicClient;
  account: `0x${string}`;
  prepared: PreparedPublish;
  meta: PublishMetaInput;
}): Promise<{ wei: bigint; pls: string; txs: number }> {
  const { publicClient, account, prepared, meta } = opts;
  const sample = prepared.parts[0] ?? new Uint8Array([0]);
  // New chunks = raw bytes as tx data (no JSON/base64 wrapper)
  const chunkData = `0x${bytesToHex(sample)}` as Hex;
  const manifest = buildManifest({
    prepared,
    meta,
    chunkHashes: prepared.parts.map(
      () =>
        "0x0000000000000000000000000000000000000000000000000000000000000001" as Hash,
    ),
  });
  const manifestData = utf8ToHex(JSON.stringify(manifest));

  let gasChunk = 21000n;
  let gasManifest = 21000n;
  try {
    gasChunk = await publicClient.estimateGas({
      account,
      to: zeroAddress,
      data: chunkData,
      value: 0n,
    });
  } catch {
    gasChunk = BigInt(21000 + Math.ceil(chunkData.length / 2) * 16);
  }
  try {
    gasManifest = await publicClient.estimateGas({
      account,
      to: ARCHIVE_SINK,
      data: manifestData,
      value: 0n,
    });
  } catch {
    gasManifest = BigInt(21000 + Math.ceil(manifestData.length / 2) * 16);
  }

  const gasPrice = await publicClient.getGasPrice();
  const txs = prepared.parts.length + 1;
  const wei = gasPrice * (gasChunk * BigInt(prepared.parts.length) + gasManifest);
  return { wei, pls: formatEther(wei), txs };
}

function buildManifest(opts: {
  prepared: PreparedPublish;
  meta: PublishMetaInput;
  chunkHashes: Hash[];
}): ManifestPayload {
  const { prepared, meta, chunkHashes } = opts;
  const replaces = meta.replaces?.trim();
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
    ...(meta.title?.trim() ? { title: meta.title.trim().slice(0, 120) } : {}),
    ...(meta.tags && meta.tags.length ? { tags: meta.tags } : {}),
    ...(meta.note?.trim() ? { note: meta.note.trim().slice(0, 280) } : {}),
    ...(meta.summary?.trim()
      ? { summary: meta.summary.trim().slice(0, 300) }
      : {}),
    ...(meta.lang?.trim() ? { lang: meta.lang.trim().slice(0, 16) } : {}),
    ...(meta.license?.trim()
      ? { license: meta.license.trim().slice(0, 64) }
      : {}),
    ...(replaces && /^0x[a-fA-F0-9]{64}$/i.test(replaces)
      ? { replaces: replaces.toLowerCase() as Hash }
      : {}),
    ...(meta.cw ? { cw: true } : {}),
  };
}

export async function publishPrepared(opts: {
  prepared: PreparedPublish;
  meta: PublishMetaInput;
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: `0x${string}`;
  /** resume: prior progress with hashes for done chunks */
  prior?: ChunkProgress[];
  onProgress?: (chunks: ChunkProgress[]) => void;
}): Promise<{
  manifestHash: Hash;
  chunkHashes: Hash[];
  mimeType: string;
  sha256: string;
  progress: ChunkProgress[];
}> {
  const {
    prepared,
    meta,
    walletClient,
    publicClient,
    account,
    prior,
    onProgress,
  } = opts;

  const progress: ChunkProgress[] =
    prior && prior.length === prepared.parts.length
      ? prior.map((p) => ({ ...p }))
      : prepared.parts.map((_, index) => ({
          index,
          total: prepared.parts.length,
          status: "pending" as const,
        }));
  const bump = () => onProgress?.(progress.map((p) => ({ ...p })));

  const chunkHashes: Hash[] = [];

  for (let i = 0; i < prepared.parts.length; i++) {
    if (progress[i].status === "done" && progress[i].hash) {
      chunkHashes.push(progress[i].hash!);
      continue;
    }
    progress[i].status = "signing";
    progress[i].error = undefined;
    bump();
    const data = `0x${bytesToHex(prepared.parts[i])}` as Hex;
    try {
      const hash = await walletClient.sendTransaction({
        account,
        chain: walletClient.chain,
        to: zeroAddress,
        value: 0n,
        data,
      });
      progress[i].hash = hash;
      progress[i].status = "confirming";
      bump();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error(`Chunk ${i + 1} reverted`);
      }
      chunkHashes.push(hash);
      progress[i].status = "done";
      bump();
    } catch (e) {
      progress[i].status = "error";
      progress[i].error = e instanceof Error ? e.message : String(e);
      bump();
      throw e;
    }
  }

  const manifest = buildManifest({ prepared, meta, chunkHashes });
  const manifestData = utf8ToHex(JSON.stringify(manifest));
  const manifestHash = await walletClient.sendTransaction({
    account,
    chain: walletClient.chain,
    to: ARCHIVE_SINK,
    value: 0n,
    data: manifestData,
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: manifestHash,
  });
  if (receipt.status !== "success") {
    throw new Error("Manifest transaction reverted");
  }

  return {
    manifestHash,
    chunkHashes,
    mimeType: prepared.mimeType,
    sha256: prepared.sha256,
    progress,
  };
}

export async function readDocument(
  publicClient: PublicClient,
  manifestHash: Hash,
): Promise<{ meta: DocMeta; bytes: Uint8Array }> {
  const tx = await publicClient.getTransaction({ hash: manifestHash });
  if (!tx.input || tx.input === "0x") {
    throw new Error("No calldata on that transaction");
  }
  const manifest = tryParseManifest(tx.input);
  if (!manifest) {
    throw new Error("That tx is not a document manifest");
  }

  const pieces: Uint8Array[] = [];
  let total = 0;
  for (const h of manifest.chunkHashes) {
    const cTx = await publicClient.getTransaction({ hash: h as Hash });
    if (!cTx.input || cTx.input === "0x") {
      throw new Error(`Empty chunk tx ${h}`);
    }
    const bytes = decodeChunkTxInput(cTx.input);
    pieces.push(bytes);
    total += bytes.length;
  }

  let out = new Uint8Array(total);
  let offset = 0;
  for (const p of pieces) {
    out.set(p, offset);
    offset += p.length;
  }

  if (manifest.encoding === "gzip") {
    out = new Uint8Array(await gzipDecompress(out));
  }

  if (manifest.sha256) {
    const got = await sha256Hex(out);
    if (got !== manifest.sha256.toLowerCase()) {
      throw new Error(
        `SHA-256 mismatch (got ${got.slice(0, 12)}… want ${manifest.sha256.slice(0, 12)}…)`,
      );
    }
  }

  return {
    meta: {
      ...manifest,
      chunkHashes: manifest.chunkHashes as Hash[],
      mimeType: manifest.mimeType,
    },
    bytes: out,
  };
}

export function makeObjectUrl(bytes: Uint8Array, mimeType: string): string {
  const copy = new Uint8Array(bytes);
  return URL.createObjectURL(new Blob([copy], { type: mimeType }));
}

export function formatCitation(opts: {
  title?: string;
  from?: string;
  postedAt?: number;
  manifestHash: Hash;
  sha256?: string;
}): string {
  const when = opts.postedAt
    ? new Date(opts.postedAt * 1000).toISOString()
    : "unknown-date";
  const title = opts.title?.trim() || "(untitled)";
  const author = opts.from || "unknown";
  const url = shareUrl(opts.manifestHash);
  const lines = [
    `${title}`,
    `Author: ${author}`,
    `Posted: ${when}`,
    `PulseChain manifest: ${opts.manifestHash}`,
    `Explorer: ${SCAN_TX(opts.manifestHash)}`,
    `Open: ${url}`,
  ];
  if (opts.sha256) lines.push(`SHA-256: ${opts.sha256}`);
  return lines.join("\n");
}
