/**
 * Build a static catalog JSON from the …feed inbox (Blockscout v2).
 * Usage: node scripts/build-catalog.mjs
 * Writes: public/catalog.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SINK = "0x000000000000000000000000000000000000feed";
const API = "https://api.scan.pulsechain.com/api/v2";
const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "public", "catalog.json");

function hexToUtf8(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

function tryManifest(input) {
  try {
    const obj = JSON.parse(hexToUtf8(input));
    if (!obj?.mimeType || !Array.isArray(obj.chunkHashes) || !obj.chunkHashes.length) {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

const res = await fetch(`${API}/addresses/${SINK}/transactions?limit=100`);
if (!res.ok) throw new Error(`Explorer HTTP ${res.status}`);
const body = await res.json();
const items = Array.isArray(body.items) ? body.items : [];

const entries = [];
for (const tx of items) {
  if (!tx.raw_input || tx.raw_input === "0x") continue;
  const m = tryManifest(tx.raw_input);
  if (!m) continue;
  entries.push({
    hash: String(tx.hash).toLowerCase(),
    from: (tx.from?.hash || tx.from || "").toLowerCase(),
    timestamp: tx.timestamp || null,
    title: m.title || "(untitled)",
    mimeType: m.mimeType,
    type: m.type || null,
    tags: m.tags || [],
    summary: m.summary || null,
    sha256: m.sha256 || null,
    encoding: m.encoding || null,
    kind: m.kind || null,
    chunkCount: m.chunkHashes.length,
    cw: !!m.cw,
  });
}

mkdirSync(dirname(outPath), { recursive: true });
const catalog = {
  generatedAt: new Date().toISOString(),
  sink: SINK,
  chainId: 369,
  count: entries.length,
  entries,
};
writeFileSync(outPath, JSON.stringify(catalog, null, 2));
console.log(`Wrote ${entries.length} entries → ${outPath}`);
