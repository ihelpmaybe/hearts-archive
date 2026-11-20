/**
 * Foundry lab — local anvil only. Publish, read back, like, count.
 * No Pulse mainnet trail.
 *
 *   npm run sim:lab
 *   node sim/lab.mjs --users 40 --port 8550
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  zeroAddress,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { makeGamingDoc, makeRng } from "./gaming.mjs";
import {
  ARCHIVE_SINK,
  MAX_PUBLISH_BYTES,
  preparePayload,
  buildManifest,
  chunkCalldata,
  chunkCalldataLegacy,
  manifestCalldata,
  likeCalldata,
  tryParseLike,
  tryParseManifest,
  readDocumentFromChain,
  shouldSkipGzip,
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

const USERS = Number(arg("--users", "40"));
const PORT = Number(arg("--port", "8550"));
const RPC = `http://127.0.0.1:${PORT}`;

const anvilChain = defineChain({
  id: 31337,
  name: "anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

function anvilExe() {
  const local = join(
    FOUNDRY_BIN,
    process.platform === "win32" ? "anvil.exe" : "anvil",
  );
  return existsSync(local) ? local : "anvil";
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
    await sleep(150);
  }
  throw new Error(`anvil not up on ${RPC}`);
}

function ok(name, cond, detail = "") {
  if (cond) {
    console.log(`  ok  ${name}`);
    return true;
  }
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  return false;
}

async function publishDoc({ wallet, publicClient, account, doc, legacyChunk }) {
  const prepared = preparePayload(doc.body, doc.mimeType);
  const chunkHashes = [];
  for (const part of prepared.parts) {
    const data = legacyChunk
      ? chunkCalldataLegacy(part, prepared.mimeType)
      : chunkCalldata(part, prepared.mimeType);
    const hash = await wallet.sendTransaction({
      account,
      to: zeroAddress,
      data,
      value: 0n,
      chain: anvilChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    chunkHashes.push(hash);
  }
  const manifest = buildManifest({
    prepared,
    meta: {
      title: doc.title,
      summary: doc.summary,
      tags: doc.tags,
      note: doc.note,
      cw: doc.cw,
      type: prepared.type,
    },
    chunkHashes,
  });
  const manifestHash = await wallet.sendTransaction({
    account,
    to: ARCHIVE_SINK,
    data: manifestCalldata(manifest),
    value: 0n,
    chain: anvilChain,
  });
  await publicClient.waitForTransactionReceipt({ hash: manifestHash });
  return { manifestHash, prepared, original: doc.body };
}

async function sendLikeTx({ wallet, publicClient, account, manifestHash }) {
  const hash = await wallet.sendTransaction({
    account,
    to: ARCHIVE_SINK,
    data: likeCalldata(manifestHash),
    value: 0n,
    chain: anvilChain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const results = [];
  const pass = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail });
    return ok(name, cond, detail);
  };

  console.log(`Foundry lab · ${USERS} users · :${PORT} (local only)\n`);

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

  try {
    await waitRpc();
    const publicClient = createPublicClient({
      chain: anvilChain,
      transport: http(RPC),
    });
    const accounts = Array.from({ length: USERS }, (_, i) =>
      mnemonicToAccount(MNEMONIC, { addressIndex: i }),
    );
    const walletFor = (account) =>
      createWalletClient({
        account,
        chain: anvilChain,
        transport: http(RPC),
      });

    // --- unit-ish protocol gates (no chain) ---
    pass("gzip skip jpeg", shouldSkipGzip("image/jpeg"));
    let capThrew = false;
    try {
      preparePayload(Buffer.alloc(MAX_PUBLISH_BYTES + 1), "text/plain");
    } catch {
      capThrew = true;
    }
    pass("size cap", capThrew);

    // --- publish raw + legacy raven-style chunk ---
    const author = accounts[0];
    const textDoc = makeGamingDoc(0, makeRng(42));
    // force small text for reliable roundtrip
    const forced = {
      ...textDoc,
      title: "lab note",
      mimeType: "text/plain;charset=utf-8",
      body: Buffer.from(
        "Heart's Archive lab note — local anvil only.\n".repeat(20),
        "utf8",
      ),
      tags: ["lab", "foundry"],
      cw: false,
    };

    const pub = await publishDoc({
      wallet: walletFor(author),
      publicClient,
      account: author,
      doc: forced,
      legacyChunk: false,
    });
    pass("publish raw chunks", !!pub.manifestHash);

    const legacyDoc = {
      title: "legacy chunk doc",
      summary: "base64 path",
      tags: ["lab"],
      mimeType: "text/plain;charset=utf-8",
      body: Buffer.from("legacy raven-style chunk body\n", "utf8"),
      cw: false,
    };
    const legacy = await publishDoc({
      wallet: walletFor(author),
      publicClient,
      account: author,
      doc: legacyDoc,
      legacyChunk: true,
    });
    pass("publish legacy base64 chunks", !!legacy.manifestHash);

    // --- read back ---
    const getTx = async (hash) => {
      const tx = await publicClient.getTransaction({ hash });
      return { input: tx.input };
    };
    const readRaw = await readDocumentFromChain(getTx, pub.manifestHash);
    pass(
      "readback raw sha",
      readRaw.manifest.sha256 === pub.prepared.sha256,
      readRaw.manifest.sha256,
    );
    pass(
      "readback raw body",
      Buffer.compare(Buffer.from(readRaw.bytes), forced.body) === 0,
    );

    const readLegacy = await readDocumentFromChain(getTx, legacy.manifestHash);
    pass(
      "readback legacy body",
      Buffer.compare(Buffer.from(readLegacy.bytes), legacyDoc.body) === 0,
    );

    const mTx = await publicClient.getTransaction({ hash: pub.manifestHash });
    pass("manifest on sink", mTx.to?.toLowerCase() === ARCHIVE_SINK);
    pass("manifest parses", !!tryParseManifest(mTx.input));

    // --- likes ---
    const likers = accounts.slice(1, 11); // 10 likers
    const likeHashes = [];
    for (const a of likers) {
      likeHashes.push(
        await sendLikeTx({
          wallet: walletFor(a),
          publicClient,
          account: a,
          manifestHash: pub.manifestHash,
        }),
      );
    }
    // double-like from same wallet (should still land; client dedupes)
    await sendLikeTx({
      wallet: walletFor(likers[0]),
      publicClient,
      account: likers[0],
      manifestHash: pub.manifestHash,
    });

    // scrape sink txs via eth_getLogs isn't available for all calldata —
    // walk recent blocks for txs to sink (anvil is short)
    const tip = await publicClient.getBlockNumber();
    const likes = [];
    for (let b = 0n; b <= tip; b++) {
      const block = await publicClient.getBlock({
        blockNumber: b,
        includeTransactions: true,
      });
      for (const tx of block.transactions) {
        if (!tx.to || tx.to.toLowerCase() !== ARCHIVE_SINK) continue;
        const like = tryParseLike(tx.input);
        if (!like) continue;
        if (like.manifest !== pub.manifestHash.toLowerCase()) continue;
        likes.push({
          hash: tx.hash,
          from: tx.from.toLowerCase(),
          manifest: like.manifest,
        });
      }
    }

    pass("likes landed", likes.length >= 11, `got ${likes.length}`);
    const unique = new Set(likes.map((l) => l.from));
    pass("unique likers", unique.size === 10, `got ${unique.size}`);
    pass(
      "double-like raw count > unique",
      likes.length > unique.size,
      `${likes.length} vs ${unique.size}`,
    );

    // jpeg stays raw encoding
    const jpegDoc = {
      title: "lab jpeg",
      summary: "skip gzip",
      tags: ["lab"],
      mimeType: "image/jpeg",
      body: Buffer.alloc(12_000, 7),
      cw: false,
    };
    jpegDoc.body[0] = 0xff;
    jpegDoc.body[1] = 0xd8;
    const jpegPub = await publishDoc({
      wallet: walletFor(author),
      publicClient,
      account: author,
      doc: jpegDoc,
      legacyChunk: false,
    });
    pass("jpeg encoding raw", jpegPub.prepared.encoding === "raw");

    const failed = results.filter((r) => !r.ok);
    const report = [
      `# Heart’s Archive Foundry lab`,
      ``,
      `- local anvil :${PORT}`,
      `- users: ${USERS}`,
      `- passed: ${results.length - failed.length}/${results.length}`,
      `- no Pulse mainnet txs`,
      ``,
      `## Checks`,
      ...results.map(
        (r) =>
          `- ${r.ok ? "OK" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`,
      ),
      ``,
    ].join("\n");
    writeFileSync(join(OUT, "LAB.md"), report);
    writeFileSync(
      join(OUT, "lab-summary.json"),
      JSON.stringify(
        {
          port: PORT,
          users: USERS,
          passed: results.length - failed.length,
          total: results.length,
          manifest: pub.manifestHash,
          likesRaw: likes.length,
          likesUnique: unique.size,
        },
        null,
        2,
      ),
    );

    console.log("");
    if (failed.length) {
      console.error(`${failed.length} lab failure(s) — see sim/out/LAB.md`);
      process.exitCode = 1;
    } else {
      console.log(`lab clean — sim/out/LAB.md`);
    }
  } finally {
    anvil.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
