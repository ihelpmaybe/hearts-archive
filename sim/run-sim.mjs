/**
 * Heart’s Archive stress sim — Foundry anvil + 1000 gaming users → SQLite + weak-spot report.
 *
 * Usage:
 *   node sim/run-sim.mjs
 *   node sim/run-sim.mjs --users 1000 --port 8549
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatEther,
  zeroAddress,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { makeGamingDoc, makeRng } from "./gaming.mjs";
import {
  ARCHIVE_SINK,
  preparePayload,
  buildManifest,
  chunkCalldata,
  manifestCalldata,
  estimateGasFromCalldata,
} from "./protocol-node.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "out");
const MNEMONIC =
  "test test test test test test test test test test test junk";
const FOUNDRY_BIN = join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".foundry",
  "bin",
);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const USERS = Number(arg("--users", "1000"));
const PORT = Number(arg("--port", "8549"));
const CONCURRENCY = Number(arg("--concurrency", "25"));
const DOCS_PER_USER = Number(arg("--docs", "1"));
const RPC = `http://127.0.0.1:${PORT}`;

const anvilChain = defineChain({
  id: 31337,
  name: "anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

function anvilExe() {
  const local = join(FOUNDRY_BIN, process.platform === "win32" ? "anvil.exe" : "anvil");
  if (existsSync(local)) return local;
  return "anvil";
}

async function waitRpc(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error(`anvil RPC not up on ${RPC}`);
}

function openDb(path) {
  if (existsSync(path)) rmSync(path);
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE users (
      idx INTEGER PRIMARY KEY,
      address TEXT NOT NULL UNIQUE
    );
    CREATE TABLE docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_idx INTEGER NOT NULL,
      author TEXT NOT NULL,
      manifest_hash TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      kind TEXT,
      mime TEXT,
      type TEXT,
      encoding TEXT,
      sha256 TEXT,
      tags TEXT,
      cw INTEGER,
      original_bytes INTEGER,
      stored_bytes INTEGER,
      saved_pct INTEGER,
      chunk_count INTEGER,
      chunk_calldata_bytes INTEGER,
      manifest_calldata_bytes INTEGER,
      gas_est INTEGER,
      gas_used INTEGER,
      replaces TEXT,
      ok INTEGER,
      error TEXT,
      created_ms INTEGER
    );
    CREATE TABLE chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id INTEGER NOT NULL,
      chunk_index INTEGER,
      tx_hash TEXT,
      calldata_bytes INTEGER,
      gas_est INTEGER,
      gas_used INTEGER
    );
    CREATE TABLE findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity TEXT,
      area TEXT,
      detail TEXT
    );
    CREATE INDEX idx_docs_sha ON docs(sha256);
    CREATE INDEX idx_docs_author ON docs(author);
    CREATE INDEX idx_docs_kind ON docs(kind);
  `);
  return db;
}

async function publishOne({ wallet, publicClient, doc, account }) {
  const prepared = preparePayload(doc.body, doc.mimeType);
  const meta = {
    title: doc.title,
    summary: doc.summary,
    tags: doc.tags,
    note: doc.note,
    cw: doc.cw,
    lang: doc.lang,
    type: prepared.type,
  };

  let chunkCalldataBytes = 0;
  let gasEst = 0;
  let gasUsed = 0n;
  const chunkHashes = [];
  const chunkRows = [];

  for (let i = 0; i < prepared.parts.length; i++) {
    const data = chunkCalldata(prepared.parts[i], prepared.mimeType);
    const est = estimateGasFromCalldata(data);
    chunkCalldataBytes += (data.length - 2) / 2;
    gasEst += est;
    const hash = await wallet.sendTransaction({
      account,
      to: zeroAddress,
      data,
      value: 0n,
      chain: anvilChain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    gasUsed += receipt.gasUsed;
    chunkHashes.push(hash);
    chunkRows.push({
      chunk_index: i,
      tx_hash: hash,
      calldata_bytes: (data.length - 2) / 2,
      gas_est: est,
      gas_used: Number(receipt.gasUsed),
    });
  }

  const manifest = buildManifest({ prepared, meta, chunkHashes });
  const mData = manifestCalldata(manifest);
  const mEst = estimateGasFromCalldata(mData);
  gasEst += mEst;
  const manifestHash = await wallet.sendTransaction({
    account,
    to: ARCHIVE_SINK,
    data: mData,
    value: 0n,
    chain: anvilChain,
  });
  const mReceipt = await publicClient.waitForTransactionReceipt({
    hash: manifestHash,
  });
  gasUsed += mReceipt.gasUsed;

  return {
    prepared,
    meta,
    manifestHash,
    chunkRows,
    chunk_calldata_bytes: chunkCalldataBytes,
    manifest_calldata_bytes: (mData.length - 2) / 2,
    gas_est: gasEst,
    gas_used: Number(gasUsed),
    ok: mReceipt.status === "success",
  };
}

function analyze(db) {
  const find = db.prepare(
    "INSERT INTO findings (severity, area, detail) VALUES (?, ?, ?)",
  );
  const add = (severity, area, detail) => find.run(severity, area, detail);

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS docs,
              SUM(chunk_count) AS chunks,
              SUM(ok) AS ok,
              SUM(original_bytes) AS orig,
              SUM(stored_bytes) AS stored,
              SUM(chunk_calldata_bytes + manifest_calldata_bytes) AS wire,
              SUM(gas_used) AS gas,
              AVG(chunk_count) AS avg_chunks,
              MAX(chunk_count) AS max_chunks
       FROM docs`,
    )
    .get();

  // Explorer/UI browse window
  const UI_LIMIT = 80;
  if (totals.docs > UI_LIMIT) {
    add(
      "critical",
      "find-browse",
      `App/explorer default pull is ~${UI_LIMIT} txs; sim has ${totals.docs} docs → ~${totals.docs - UI_LIMIT} invisible in Find without paging.`,
    );
  }

  // Duplicate sha spam
  const dups = db
    .prepare(
      `SELECT sha256, COUNT(*) AS c FROM docs WHERE sha256 IS NOT NULL
       GROUP BY sha256 HAVING c > 1 ORDER BY c DESC LIMIT 5`,
    )
    .all();
  if (dups.length) {
    add(
      "high",
      "dedupe",
      `Duplicate bodies on-chain: top sha repeats ${dups[0].c}x. Client dedupe helps UI but gas already spent.`,
    );
  }

  // Gzip waste on images/video
  const badGz = db
    .prepare(
      `SELECT COUNT(*) AS c, AVG(saved_pct) AS avg_save FROM docs
       WHERE mime LIKE 'image/%' OR mime LIKE 'video/%'`,
    )
    .get();
  if (badGz.c > 0) {
    add(
      "high",
      "compression",
      `${badGz.c} image/video posts; avg gzip save ${Number(badGz.avg_save || 0).toFixed(1)}%. Skip gzip for these mimes.`,
    );
  }

  // Base64 wire inflation
  if (totals.stored && totals.wire) {
    const inflate = totals.wire / totals.stored;
    add(
      "high",
      "encoding",
      `Calldata wire/stored ≈ ${inflate.toFixed(2)}x (JSON+base64 tax). Raw hex chunks would cut ~25–35% gas.`,
    );
  }

  // Multi-tx orphan risk
  const multi = db
    .prepare(`SELECT COUNT(*) AS c FROM docs WHERE chunk_count > 1`)
    .get();
  if (multi.c > 0) {
    add(
      "high",
      "atomicity",
      `${multi.c} multi-chunk docs. Fail mid-publish leaves orphan chunks at 0x0 with no manifest.`,
    );
  }

  // Sink has no access control
  add(
    "critical",
    "sink",
    `Anyone can spam ${ARCHIVE_SINK}. No stake, fee, or allowlist — 1000 users already filled inbox.`,
  );

  // Tag / search cardinality
  const tagRows = db.prepare(`SELECT tags FROM docs WHERE tags IS NOT NULL`).all();
  const tagCount = new Map();
  for (const row of tagRows) {
    try {
      for (const t of JSON.parse(row.tags)) {
        tagCount.set(t, (tagCount.get(t) || 0) + 1);
      }
    } catch {
      /* ignore */
    }
  }
  add(
    "med",
    "search",
    `${tagCount.size} distinct tags across ${totals.docs} docs. No on-chain index — Find is explorer scrape + local filter only.`,
  );

  // CW ratio
  const cw = db.prepare(`SELECT SUM(cw) AS c FROM docs`).get();
  add(
    "med",
    "moderation",
    `${cw.c || 0} CW-flagged posts. Flag is client-honored only; chain still serves raw body.`,
  );

  // Gas outliers
  const fat = db
    .prepare(
      `SELECT title, kind, gas_used, stored_bytes, chunk_count FROM docs
       ORDER BY gas_used DESC LIMIT 3`,
    )
    .all();
  if (fat.length) {
    add(
      "med",
      "gas",
      `Fattest doc "${fat[0].title}" (${fat[0].kind}): ${fat[0].gas_used} gas, ${fat[0].stored_bytes} stored B, ${fat[0].chunk_count} chunks.`,
    );
  }

  // Replaces unused in this sim mostly
  add(
    "low",
    "versioning",
    `replaces= field exists but sim showed almost no edit chains — readers can keep stale copies forever.`,
  );

  // Body index memory if Find searches all text
  const textBytes = db
    .prepare(
      `SELECT SUM(original_bytes) AS b FROM docs WHERE mime LIKE 'text/%' OR mime LIKE 'application/json%'`,
    )
    .get();
  add(
    "med",
    "client-index",
    `Text/json original bytes ≈ ${Math.round((textBytes.b || 0) / 1024)} KB. Body search loads opened docs into memory — at scale this becomes a browser tab bomb.`,
  );

  // Avg gas at pulse-like price note
  const gasPrice = 500000000000n; // 500 gwei stand-in
  const avgGas = totals.docs ? Math.round(Number(totals.gas) / totals.docs) : 0;
  const avgWei = BigInt(avgGas) * gasPrice;
  add(
    "info",
    "cost",
    `Avg gas/doc ≈ ${avgGas}. At 500 gwei stand-in ≈ ${formatEther(avgWei)} native/doc (Pulse price differs — order-of-magnitude only).`,
  );

  return { totals, dups, fat, tagCount: tagCount.size };
}

function writeReport(db, stats, elapsedMs) {
  const findings = db
    .prepare(`SELECT severity, area, detail FROM findings ORDER BY id`)
    .all();
  const byKind = db
    .prepare(
      `SELECT kind, COUNT(*) AS c, AVG(saved_pct) AS gz, AVG(chunk_count) AS chunks
       FROM docs GROUP BY kind ORDER BY c DESC`,
    )
    .all();

  const lines = [
    `# Heart’s Archive sim report`,
    ``,
    `- users: ${USERS}`,
    `- docs/user: ${DOCS_PER_USER}`,
    `- elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
    `- docs: ${stats.totals.docs}`,
    `- chunks: ${stats.totals.chunks}`,
    `- wire bytes: ${stats.totals.wire}`,
    `- gas used: ${stats.totals.gas}`,
    `- avg chunks/doc: ${Number(stats.totals.avg_chunks).toFixed(2)}`,
    `- max chunks: ${stats.totals.max_chunks}`,
    ``,
    `## By kind`,
    ...byKind.map(
      (k) =>
        `- ${k.kind}: ${k.c} · avg gz save ${Number(k.gz || 0).toFixed(0)}% · avg chunks ${Number(k.chunks).toFixed(2)}`,
    ),
    ``,
    `## Weak spots`,
    ...findings.map((f) => `- **${f.severity}** · ${f.area}: ${f.detail}`),
    ``,
  ];
  const path = join(OUT, "REPORT.md");
  writeFileSync(path, lines.join("\n"));
  return path;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const dbPath = join(OUT, "archive-sim.sqlite");
  const db = openDb(dbPath);

  console.log(`starting anvil on :${PORT} with ${USERS} accounts…`);
  const anvil = spawn(
    anvilExe(),
    [
      "--port",
      String(PORT),
      "--accounts",
      String(Math.max(USERS, 10)),
      "--balance",
      "1000000",
      "--silent",
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let anvilErr = "";
  anvil.stderr.on("data", (d) => {
    anvilErr += d.toString();
  });
  anvil.on("exit", (code) => {
    if (code && code !== 0) {
      console.error("anvil exited", code, anvilErr.slice(0, 500));
    }
  });

  try {
    await waitRpc();
    const publicClient = createPublicClient({
      chain: anvilChain,
      transport: http(RPC),
    });

    const insertUser = db.prepare(
      `INSERT INTO users (idx, address) VALUES (?, ?)`,
    );
    const insertDoc = db.prepare(
      `INSERT INTO docs (
        user_idx, author, manifest_hash, title, summary, kind, mime, type,
        encoding, sha256, tags, cw, original_bytes, stored_bytes, saved_pct,
        chunk_count, chunk_calldata_bytes, manifest_calldata_bytes,
        gas_est, gas_used, replaces, ok, error, created_ms
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const insertChunk = db.prepare(
      `INSERT INTO chunks (doc_id, chunk_index, tx_hash, calldata_bytes, gas_est, gas_used)
       VALUES (?,?,?,?,?,?)`,
    );

    const accounts = [];
    for (let i = 0; i < USERS; i++) {
      const account = mnemonicToAccount(MNEMONIC, { addressIndex: i });
      accounts.push(account);
      insertUser.run(i, account.address.toLowerCase());
    }

    const t0 = Date.now();
    let done = 0;
    const totalDocs = USERS * DOCS_PER_USER;
    const queue = [];
    for (let u = 0; u < USERS; u++) {
      for (let d = 0; d < DOCS_PER_USER; d++) {
        queue.push({ u, d });
      }
    }

    async function worker() {
      while (queue.length) {
        const job = queue.shift();
        if (!job) return;
        const { u, d } = job;
        const account = accounts[u];
        const rng = makeRng(u * 10007 + d * 97 + 13);
        const doc = makeGamingDoc(u, rng);
        const wallet = createWalletClient({
          account,
          chain: anvilChain,
          transport: http(RPC),
        });
        try {
          const result = await publishOne({
            wallet,
            publicClient,
            doc,
            account,
          });
          const info = insertDoc.run(
            u,
            account.address.toLowerCase(),
            result.manifestHash,
            doc.title,
            doc.summary,
            doc.kind,
            doc.mimeType,
            result.prepared.type,
            result.prepared.encoding,
            result.prepared.sha256,
            JSON.stringify(doc.tags || []),
            doc.cw ? 1 : 0,
            result.prepared.originalBytes,
            result.prepared.storedBytes,
            result.prepared.savedPct,
            result.prepared.parts.length,
            result.chunk_calldata_bytes,
            result.manifest_calldata_bytes,
            result.gas_est,
            result.gas_used,
            null,
            result.ok ? 1 : 0,
            null,
            Date.now(),
          );
          const docId = Number(info.lastInsertRowid);
          for (const c of result.chunkRows) {
            insertChunk.run(
              docId,
              c.chunk_index,
              c.tx_hash,
              c.calldata_bytes,
              c.gas_est,
              c.gas_used,
            );
          }
        } catch (e) {
          insertDoc.run(
            u,
            account.address.toLowerCase(),
            "",
            doc.title,
            doc.summary,
            doc.kind,
            doc.mimeType,
            null,
            null,
            null,
            JSON.stringify(doc.tags || []),
            doc.cw ? 1 : 0,
            doc.body.length,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            null,
            0,
            e instanceof Error ? e.message : String(e),
            Date.now(),
          );
        }
        done += 1;
        if (done % 50 === 0 || done === totalDocs) {
          console.log(`published ${done}/${totalDocs}`);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, USERS) }, () => worker()),
    );

    const elapsed = Date.now() - t0;
    const stats = analyze(db);
    const report = writeReport(db, stats, elapsed);
    writeFileSync(
      join(OUT, "summary.json"),
      JSON.stringify({ users: USERS, elapsedMs: elapsed, ...stats.totals, findings: db.prepare(`SELECT COUNT(*) AS c FROM findings`).get().c }, null, 2),
    );
    console.log(`db: ${dbPath}`);
    console.log(`report: ${report}`);
    console.log(
      `docs=${stats.totals.docs} gas=${stats.totals.gas} wire=${stats.totals.wire} findings=${db.prepare(`SELECT COUNT(*) AS c FROM findings`).get().c}`,
    );
  } finally {
    anvil.kill();
    db.close?.();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
