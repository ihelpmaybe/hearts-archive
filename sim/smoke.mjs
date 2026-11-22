/**
 * Smoke the v0.4 fixes (no chain required except optional explorer ping).
 */
import {
  preparePayload,
  shouldSkipGzip,
  MAX_PUBLISH_BYTES,
  bytesToBase64,
  fakeJpeg,
  utf8ToHex,
  buildManifest,
  chunkCalldata,
  ARCHIVE_SINK,
} from "./protocol-node.mjs";
import { createHash, randomBytes } from "node:crypto";

// bytesToHex local (sim chunk path uses base64 historically; app uses hex)
function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`ok  ${name}`);
  else {
    fails += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// gzip skip
ok("skip jpeg gzip", shouldSkipGzip("image/jpeg"));
ok("skip mp4 gzip", shouldSkipGzip("video/mp4"));
ok("allow text gzip", !shouldSkipGzip("text/plain"));

const jpeg = fakeJpeg(40_000);
const jpegPrep = preparePayload(jpeg, "image/jpeg");
ok("jpeg stays raw", jpegPrep.encoding === "raw");

const text = Buffer.from("hello archive\n".repeat(2000), "utf8");
const textPrep = preparePayload(text, "text/plain");
ok("text may gzip", textPrep.encoding === "gzip" || textPrep.savedPct >= 0);
ok("text shrinks or equal", textPrep.storedBytes <= textPrep.originalBytes);

// size cap
let threw = false;
try {
  preparePayload(randomBytes(MAX_PUBLISH_BYTES + 1), "application/octet-stream");
} catch {
  threw = true;
}
ok("size cap throws", threw);

// raw calldata smaller than JSON+base64 wrapper
const sample = textPrep.parts[0];
const b64Json = JSON.stringify({
  chunkData: bytesToBase64(sample),
  mimeType: "text/plain",
});
const b64Wire = Buffer.byteLength(b64Json, "utf8");
const rawWire = sample.length;
ok(
  "raw chunk smaller than json+base64",
  rawWire < b64Wire,
  `raw=${rawWire} b64json=${b64Wire}`,
);

// roundtrip hex
const back = Buffer.from(bytesToHex(sample), "hex");
ok("hex roundtrip", Buffer.compare(back, Buffer.from(sample)) === 0);

// manifest builds
const manifest = buildManifest({
  prepared: textPrep,
  meta: { title: "smoke", tags: ["test"] },
  chunkHashes: [
    "0x" + createHash("sha256").update("x").digest("hex"),
  ],
});
ok("manifest kind", manifest.kind === "pulse-archive");
ok("sink const", ARCHIVE_SINK.endsWith("feed"));

// explorer paging shape (live) — soft: Scan blips must not fail CI/check
function soft(name, detail = "") {
  console.log(`skip ${name}${detail ? ` — ${detail}` : ""}`);
}
try {
  const url = `https://api.scan.pulsechain.com/api/v2/addresses/${ARCHIVE_SINK}/transactions?limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    soft("explorer HTTP", String(res.status));
  } else {
    ok("explorer HTTP", true);
    const body = await res.json();
    ok("explorer items array", Array.isArray(body.items));
    ok(
      "explorer next_page_params key",
      body.next_page_params === null ||
        typeof body.next_page_params === "object",
    );
  }
} catch (e) {
  soft(
    "explorer reachable",
    e instanceof Error ? e.message : String(e),
  );
}

// unused import guard
void chunkCalldata;
void utf8ToHex;

if (fails) {
  console.error(`\n${fails} smoke failure(s)`);
  process.exit(1);
}
console.log("\nsmoke clean");
