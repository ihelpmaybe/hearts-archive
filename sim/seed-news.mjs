/**
 * Seed Heart's Archive news onto local Foundry anvil.
 * Writes public/lab-seed.json for the app (no Pulse trail).
 *
 *   npm run sim:seed
 *   node sim/seed-news.mjs --keep   # leave anvil up on :8551
 */
import { spawn } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  copyFileSync,
} from "node:fs";
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
import { NEWS_ITEMS } from "./news-corpus.mjs";
import { BOOK } from "./book-corpus.mjs";
import {
  ARCHIVE_SINK,
  preparePayload,
  buildManifest,
  chunkCalldata,
  manifestCalldata,
  likeCalldata,
} from "./protocol-node.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(__dirname, "out");
const PUBLIC_SEED = join(ROOT, "public", "lab-seed.json");
const MNEMONIC =
  "test test test test test test test test test test test junk";
const FOUNDRY_BIN = join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".foundry",
  "bin",
);
const PORT = Number(
  process.argv.includes("--port")
    ? process.argv[process.argv.indexOf("--port") + 1]
    : "8551",
);
const KEEP = process.argv.includes("--keep");
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
      /* */
    }
    await sleep(150);
  }
  throw new Error(`anvil not up on ${RPC}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(ROOT, "public"), { recursive: true });

  console.log(`Seeding news on anvil :${PORT}…`);
  const anvil = spawn(
    anvilExe(),
    [
      "--port",
      String(PORT),
      "--accounts",
      "20",
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
    const authors = [0, 1, 2].map((i) =>
      mnemonicToAccount(MNEMONIC, { addressIndex: i }),
    );
    const likers = [3, 4, 5, 6, 7].map((i) =>
      mnemonicToAccount(MNEMONIC, { addressIndex: i }),
    );

    const entries = [];
    const bodies = {};
    const likes = [];

    for (let i = 0; i < NEWS_ITEMS.length; i++) {
      const item = NEWS_ITEMS[i];
      const account = authors[i % authors.length];
      const wallet = createWalletClient({
        account,
        chain: anvilChain,
        transport: http(RPC),
      });
      const body = Buffer.from(item.body, "utf8");
      const prepared = preparePayload(body, "text/plain;charset=utf-8");
      const chunkHashes = [];
      for (const part of prepared.parts) {
        const hash = await wallet.sendTransaction({
          account,
          to: zeroAddress,
          data: chunkCalldata(part),
          value: 0n,
          chain: anvilChain,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        chunkHashes.push(hash);
      }
      const manifest = buildManifest({
        prepared,
        meta: {
          title: item.title,
          summary: item.summary,
          tags: item.tags,
          type: "text",
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

      const ts = Math.floor(Date.now() / 1000) - (NEWS_ITEMS.length - i) * 3600;
      entries.push({
        hash: manifestHash,
        from: account.address.toLowerCase(),
        timestamp: new Date(ts * 1000).toISOString(),
        title: item.title,
        mimeType: "text/plain;charset=utf-8",
        type: "text",
        tags: item.tags,
        summary: item.summary,
        sha256: prepared.sha256,
        encoding: prepared.encoding,
        kind: "pulse-archive",
        chunkCount: chunkHashes.length,
        cw: false,
      });
      bodies[manifestHash.toLowerCase()] = item.body;

      // first 3 docs get a few likes
      if (i < 3) {
        for (const liker of likers.slice(0, 2 + i)) {
          const lw = createWalletClient({
            account: liker,
            chain: anvilChain,
            transport: http(RPC),
          });
          const lh = await lw.sendTransaction({
            account: liker,
            to: ARCHIVE_SINK,
            data: likeCalldata(manifestHash),
            value: 0n,
            chain: anvilChain,
          });
          await publicClient.waitForTransactionReceipt({ hash: lh });
          likes.push({
            hash: lh,
            from: liker.address.toLowerCase(),
            manifest: manifestHash.toLowerCase(),
            timeStamp: ts + 60,
          });
        }
      }
      console.log(`  posted ${i + 1}/${NEWS_ITEMS.length}: ${item.title}`);
    }

    // One book = one Library card (multi-chunk under the hood)
    {
      const account = authors[0];
      const wallet = createWalletClient({
        account,
        chain: anvilChain,
        transport: http(RPC),
      });
      const body = Buffer.from(BOOK.body, "utf8");
      const prepared = preparePayload(body, "text/plain;charset=utf-8");
      const chunkHashes = [];
      for (const part of prepared.parts) {
        const hash = await wallet.sendTransaction({
          account,
          to: zeroAddress,
          data: chunkCalldata(part),
          value: 0n,
          chain: anvilChain,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        chunkHashes.push(hash);
      }
      const manifest = buildManifest({
        prepared,
        meta: {
          title: BOOK.title,
          summary: BOOK.summary,
          tags: BOOK.tags,
          type: "text",
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
      const ts = Math.floor(Date.now() / 1000);
      entries.unshift({
        hash: manifestHash,
        from: account.address.toLowerCase(),
        timestamp: new Date(ts * 1000).toISOString(),
        title: BOOK.title,
        mimeType: "text/plain;charset=utf-8",
        type: "text",
        tags: BOOK.tags,
        summary: BOOK.summary,
        sha256: prepared.sha256,
        encoding: prepared.encoding,
        kind: "pulse-archive",
        chunkCount: chunkHashes.length,
        cw: false,
      });
      bodies[manifestHash.toLowerCase()] = BOOK.body;
      console.log(
        `  posted book: ${BOOK.title} (${chunkHashes.length} chunks, ${(body.length / 1024).toFixed(0)} KB plain)`,
      );
    }

    // 3-card series via `replaces` (Library collapses to tip + “older”)
    {
      const account = authors[1];
      const wallet = createWalletClient({
        account,
        chain: anvilChain,
        transport: http(RPC),
      });
      const chapters = [
        {
          title: "Series demo — ch.1",
          summary: "First version",
          body: "Chapter 1 — the start of a replaces chain.\n",
        },
        {
          title: "Series demo — ch.2",
          summary: "Revised",
          body: "Chapter 2 — replaces ch.1.\n",
        },
        {
          title: "Series demo — ch.3",
          summary: "Latest",
          body: "Chapter 3 — tip of the series (Library shows v3).\n",
        },
      ];
      let prevHash = null;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const body = Buffer.from(ch.body, "utf8");
        const prepared = preparePayload(body, "text/plain;charset=utf-8");
        const chunkHashes = [];
        for (const part of prepared.parts) {
          const hash = await wallet.sendTransaction({
            account,
            to: zeroAddress,
            data: chunkCalldata(part),
            value: 0n,
            chain: anvilChain,
          });
          await publicClient.waitForTransactionReceipt({ hash });
          chunkHashes.push(hash);
        }
        const manifest = buildManifest({
          prepared,
          meta: {
            title: ch.title,
            summary: ch.summary,
            tags: ["series", "lab"],
            type: "text",
            replaces: prevHash || undefined,
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
        const ts = Math.floor(Date.now() / 1000) - (chapters.length - i) * 120;
        entries.unshift({
          hash: manifestHash,
          from: account.address.toLowerCase(),
          timestamp: new Date(ts * 1000).toISOString(),
          title: ch.title,
          mimeType: "text/plain;charset=utf-8",
          type: "text",
          tags: ["series", "lab"],
          summary: ch.summary,
          sha256: prepared.sha256,
          encoding: prepared.encoding,
          replaces: prevHash || undefined,
          kind: "pulse-archive",
          chunkCount: chunkHashes.length,
          cw: false,
        });
        bodies[manifestHash.toLowerCase()] = ch.body;
        prevHash = manifestHash;
        console.log(`  posted series ${i + 1}/${chapters.length}: ${ch.title}`);
      }
    }

    const seed = {
      generatedAt: new Date().toISOString(),
      source: "foundry-anvil",
      rpc: RPC,
      sink: ARCHIVE_SINK,
      note: "Local Foundry seed only — not Pulse mainnet.",
      entries,
      bodies,
      likes,
    };
    const outPath = join(OUT, "seed.json");
    writeFileSync(outPath, JSON.stringify(seed, null, 2));
    writeFileSync(PUBLIC_SEED, JSON.stringify(seed, null, 2));
    copyFileSync(PUBLIC_SEED, join(OUT, "lab-seed.json"));

    console.log(`\nWrote ${entries.length} posts (news + book)`);
    console.log(`  ${outPath}`);
    console.log(`  ${PUBLIC_SEED}`);
    console.log(`Refresh the desk (dev server) — Library loads lab-seed.`);

    if (KEEP) {
      console.log(`\nAnvil kept on ${RPC} (Ctrl+C to stop).`);
      await new Promise(() => {});
    }
  } finally {
    if (!KEEP) anvil.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
