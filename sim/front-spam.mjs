/**
 * Adversarial front-bid spam — try to break A1 ranking / rebid rules.
 * Local anvil only. No Pulse trail.
 *
 *   node sim/front-spam.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  zeroAddress,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import {
  ARCHIVE_SINK,
  APP_NAME,
  APP_VERSION,
  buildManifest,
  chunkCalldata,
  frontBidCalldata,
  likeCalldata,
  manifestCalldata,
  preparePayload,
  tryParseFrontBid,
  utf8ToHex,
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
const PORT = 8552;
const RPC = `http://127.0.0.1:${PORT}`;
const ACCOUNTS = 40;

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

function tomorrowUtc() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function shiftDay(dayKey, delta) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + delta);
  return new Date(t).toISOString().slice(0, 10);
}

/** Mirror archive.frontBidPrintedDay (legacy = bid calendar + 1). */
function printedDay(bid, blockTsSec) {
  if (bid.forDay && /^\d{4}-\d{2}-\d{2}$/.test(bid.forDay)) return bid.forDay;
  if (!blockTsSec) return "";
  const d = new Date(blockTsSec * 1000);
  const t = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
  );
  return new Date(t).toISOString().slice(0, 10);
}

function dedupeBest(bids, day) {
  const best = new Map();
  for (const b of bids) {
    if (b.day !== day) continue;
    if (b.valueWei <= 0n) continue;
    const key = b.manifest;
    const prev = best.get(key);
    if (
      !prev ||
      b.valueWei > prev.valueWei ||
      (b.valueWei === prev.valueWei && b.timeStamp > prev.timeStamp)
    ) {
      best.set(key, b);
    }
  }
  return [...best.values()].sort((a, b) => {
    if (b.valueWei !== a.valueWei) return b.valueWei > a.valueWei ? 1 : -1;
    return b.timeStamp - a.timeStamp;
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const results = [];
  const findings = [];
  const pass = (name, cond, detail = "") => {
    results.push({ name, ok: !!cond, detail });
    console.log(`  ${cond ? "ok " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
    if (!cond) findings.push({ severity: "break", name, detail });
    return !!cond;
  };
  const note = (severity, name, detail) => {
    findings.push({ severity, name, detail });
    console.log(`  note [${severity}] ${name} — ${detail}`);
  };

  console.log(`Front-bid attack spam · :${PORT} · ${ACCOUNTS} wallets\n`);

  const anvil = spawn(
    anvilExe(),
    [
      "--port",
      String(PORT),
      "--accounts",
      String(ACCOUNTS),
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
    const acct = (i) => mnemonicToAccount(MNEMONIC, { addressIndex: i });
    const wallet = (account) =>
      createWalletClient({
        account,
        chain: anvilChain,
        transport: http(RPC),
      });
    const forDay = tomorrowUtc();
    const otherDay = shiftDay(forDay, 1);

    async function publish(authorIdx, title) {
      const author = acct(authorIdx);
      const body = Buffer.from(`spam-story ${title}\n`.repeat(20), "utf8");
      const prepared = preparePayload(body, "text/plain;charset=utf-8");
      const chunkHashes = [];
      for (const part of prepared.parts) {
        const hash = await wallet(author).sendTransaction({
          account: author,
          to: zeroAddress,
          data: chunkCalldata(part, prepared.mimeType),
          value: 0n,
          chain: anvilChain,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        chunkHashes.push(hash);
      }
      const manifest = buildManifest({
        prepared,
        meta: { title, tags: ["spam"], type: prepared.type },
        chunkHashes,
      });
      const manifestHash = await wallet(author).sendTransaction({
        account: author,
        to: ARCHIVE_SINK,
        data: manifestCalldata(manifest),
        value: 0n,
        chain: anvilChain,
      });
      await publicClient.waitForTransactionReceipt({ hash: manifestHash });
      return manifestHash.toLowerCase();
    }

    /** Per-wallet nonce lock — parallel spam from the same key must not collide. */
    const nonceLocks = new Map();
    async function withNonce(fromIdx, fn) {
      const prev = nonceLocks.get(fromIdx) || Promise.resolve();
      let release;
      const gate = new Promise((r) => {
        release = r;
      });
      nonceLocks.set(
        fromIdx,
        prev.then(() => gate),
      );
      await prev;
      try {
        return await fn();
      } finally {
        release();
      }
    }

    async function bid(fromIdx, manifest, valueWei, day = forDay) {
      return withNonce(fromIdx, async () => {
        const from = acct(fromIdx);
        const nonce = await publicClient.getTransactionCount({
          address: from.address,
          blockTag: "pending",
        });
        const hash = await wallet(from).sendTransaction({
          account: from,
          to: ARCHIVE_SINK,
          data: frontBidCalldata(manifest, day),
          value: valueWei,
          chain: anvilChain,
          nonce,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        return { hash, status: receipt.status, from: from.address };
      });
    }

    async function scrapeBids() {
      const tip = await publicClient.getBlockNumber();
      const out = [];
      for (let b = 0n; b <= tip; b++) {
        const block = await publicClient.getBlock({
          blockNumber: b,
          includeTransactions: true,
        });
        const ts = Number(block.timestamp);
        for (const tx of block.transactions) {
          if (!tx.to || tx.to.toLowerCase() !== ARCHIVE_SINK) continue;
          const parsed = tryParseFrontBid(tx.input);
          if (!parsed) continue;
          out.push({
            hash: tx.hash.toLowerCase(),
            manifest: parsed.manifest,
            valueWei: tx.value,
            forDay: parsed.forDay || null,
            day: printedDay(parsed, ts),
            timeStamp: ts,
            from: tx.from.toLowerCase(),
            input: tx.input,
          });
        }
      }
      return out;
    }

    // --- Setup: 4 stories ---
    const stories = [];
    for (let i = 0; i < 4; i++) {
      stories.push(await publish(0, `Story-${i}`));
    }
    pass("setup posts", stories.length === 4);

    // 1) Same wallet rebid ladder (20 ascending)
    {
      const m = stories[0];
      for (let i = 1; i <= 20; i++) {
        await bid(1, m, parseEther(String(i)));
      }
      const ranked = dedupeBest(await scrapeBids(), forDay);
      const win = ranked.find((b) => b.manifest === m);
      pass(
        "same-wallet rebid ladder",
        !!win && win.valueWei === parseEther("20"),
        `win=${win?.valueWei}`,
      );
    }

    // 2) Parallel burst: 30 wallets bid random 1–100 on story 1
    {
      const m = stories[1];
      const amounts = [];
      const jobs = [];
      for (let i = 2; i < 32; i++) {
        const pls = BigInt(1 + ((i * 17) % 100));
        amounts.push({ i, pls });
        jobs.push(
          bid(i, m, parseEther(String(pls))).then(
            (r) => ({ ok: true, ...r, pls }),
            (e) => ({
              ok: false,
              pls,
              err: e instanceof Error ? e.message : String(e),
            }),
          ),
        );
      }
      const settled = await Promise.all(jobs);
      const okN = settled.filter((s) => s.ok).length;
      const maxPls = amounts.reduce((a, b) => (b.pls > a.pls ? b : a));
      const scraped = await scrapeBids();
      const onStory = scraped.filter(
        (b) => b.manifest === m && b.day === forDay && b.valueWei > 0n,
      );
      const ranked = dedupeBest(scraped, forDay);
      const win = ranked.find((b) => b.manifest === m);
      pass(
        "parallel 30-wallet burst",
        okN === 30 &&
          onStory.length >= 1 &&
          !!win &&
          win.valueWei === parseEther(String(maxPls.pls)),
        `okTx=${okN}/30 scraped=${onStory.length} want=${maxPls.pls} got=${win?.valueWei}`,
      );
    }

    // 3) Equal-value race — newer timestamp wins
    {
      const m = stories[2];
      const v = parseEther("42");
      const a = await bid(5, m, v);
      await sleep(1100); // anvil block time can be instantaneous — force later wall clock? block.timestamp may still bump
      // Mine an empty gap by sending a zero-value self-tx then bid
      await wallet(acct(6)).sendTransaction({
        account: acct(6),
        to: acct(6).address,
        value: 0n,
        chain: anvilChain,
      });
      const b = await bid(6, m, v);
      const ranked = dedupeBest(await scrapeBids(), forDay);
      const win = ranked.find((x) => x.manifest === m);
      // If timestamps equal, order is unstable — record that
      if (win && win.hash === b.hash.toLowerCase()) {
        pass("equal-value newer wins", true, `winner=${b.hash.slice(0, 10)}`);
      } else if (win && win.hash === a.hash.toLowerCase()) {
        // Check if timestamps actually differed
        const all = (await scrapeBids()).filter(
          (x) => x.manifest === m && x.valueWei === v && x.day === forDay,
        );
        const sameTs = all.length === 2 && all[0].timeStamp === all[1].timeStamp;
        if (sameTs) {
          note(
            "med",
            "equal-value same block.timestamp",
            "anvil packed equal bids in same second — tie-break by timeStamp is a no-op; Map last-write order may disagree with sort. App uses timeStamp only.",
          );
          pass(
            "equal-value newer wins",
            false,
            "same timestamp — tie rule weak on anvil",
          );
        } else {
          pass("equal-value newer wins", false, `got=${win.hash.slice(0, 10)}`);
        }
      } else {
        pass("equal-value newer wins", false, "no winner");
      }
    }

    // 4) Zero-value "bid" — chain accepts tx; ranking must ignore
    {
      const m = stories[3];
      const from = acct(7);
      const hash = await wallet(from).sendTransaction({
        account: from,
        to: ARCHIVE_SINK,
        data: frontBidCalldata(m, forDay),
        value: 0n,
        chain: anvilChain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const ranked = dedupeBest(await scrapeBids(), forDay);
      const win = ranked.find((b) => b.manifest === m);
      pass(
        "zero-value ignored for A1",
        !win || win.valueWei > 0n,
        win ? `still ranked ${win.valueWei}` : "ignored",
      );
      // Also: paid bid then confirm zero never displaces
      await bid(8, m, parseEther("3"));
      const ranked2 = dedupeBest(await scrapeBids(), forDay);
      const win2 = ranked2.find((b) => b.manifest === m);
      pass(
        "zero cannot displace paid",
        !!win2 && win2.valueWei === parseEther("3"),
      );
    }

    // 5) Wrong-day spam cannot steal target A1
    {
      const m = stories[0];
      const before = dedupeBest(await scrapeBids(), forDay).find(
        (b) => b.manifest === m,
      );
      await bid(9, m, parseEther("99999"), otherDay);
      const after = dedupeBest(await scrapeBids(), forDay).find(
        (b) => b.manifest === m,
      );
      pass(
        "wrong-day cannot steal A1",
        !!before &&
          !!after &&
          after.valueWei === before.valueWei &&
          after.hash === before.hash,
        `before=${before?.valueWei} after=${after?.valueWei}`,
      );
    }

    // 6) Junk / like / malformed — must not parse as front or corrupt ranking
    {
      const junker = acct(10);
      const junkPayloads = [
        utf8ToHex("not-json"),
        utf8ToHex(JSON.stringify({ kind: "pulse-archive-front" })), // no manifest
        utf8ToHex(
          JSON.stringify({
            kind: "pulse-archive-front",
            manifest: "0xdead",
            forDay,
          }),
        ),
        likeCalldata(stories[0]),
        utf8ToHex(
          JSON.stringify({
            kind: "pulse-archive-front",
            manifest: stories[0],
            forDay: "not-a-day",
            app: APP_NAME,
            appVersion: APP_VERSION,
          }),
        ),
        "0x",
      ];
      for (const data of junkPayloads) {
        try {
          const hash = await wallet(junker).sendTransaction({
            account: junker,
            to: ARCHIVE_SINK,
            data,
            value: parseEther("1"),
            chain: anvilChain,
          });
          await publicClient.waitForTransactionReceipt({ hash });
        } catch {
          /* some may fail gas/revert — still fine */
        }
      }
      const scraped = await scrapeBids();
      const badParse = scraped.filter(
        (b) =>
          !/^0x[a-f0-9]{64}$/.test(b.manifest) ||
          (b.forDay && !/^\d{4}-\d{2}-\d{2}$/.test(b.forDay)),
      );
      pass("junk/like does not forge front bids", badParse.length === 0);
      // Invalid forDay should omit forDay (legacy path) — check parser
      const weird = tryParseFrontBid(
        utf8ToHex(
          JSON.stringify({
            kind: "pulse-archive-front",
            manifest: stories[0],
            forDay: "not-a-day",
          }),
        ),
      );
      pass(
        "invalid forDay stripped",
        !!weird && !weird.forDay,
        weird ? JSON.stringify(weird.forDay) : "null",
      );
    }

    // 7) Cross-story cascade — fresh high ladder so prior spam cannot pollute
    {
      const base = parseEther("10000");
      await bid(11, stories[0], base + 10n);
      await bid(12, stories[1], base + 20n);
      await bid(13, stories[2], base + 30n);
      await bid(14, stories[3], base + 40n);
      let ranked = dedupeBest(await scrapeBids(), forDay);
      let top3 = ranked.slice(0, 3).map((b) => b.manifest);
      pass(
        "cascade before snipe",
        top3[0] === stories[3] &&
          top3[1] === stories[2] &&
          top3[2] === stories[1],
        top3.map((h) => h.slice(0, 8)).join(","),
      );
      await bid(15, stories[0], base + 100n);
      ranked = dedupeBest(await scrapeBids(), forDay);
      top3 = ranked.slice(0, 3).map((b) => b.manifest);
      pass(
        "snipe flips A1 cascade",
        top3[0] === stories[0] &&
          top3[1] === stories[3] &&
          top3[2] === stories[2],
        top3.map((h) => h.slice(0, 8)).join(","),
      );
      const a1 = ranked[0]?.valueWei ?? base + 100n;
      await bid(16, stories[1], a1 + 1n);
      ranked = dedupeBest(await scrapeBids(), forDay);
      pass(
        "+1 wei snipes A1",
        ranked[0]?.manifest === stories[1] && ranked[0]?.valueWei === a1 + 1n,
        `win=${ranked[0]?.valueWei}`,
      );
    }

    // 8) Sink spam volume — 80 tiny bids (grief inbox, ranking still coherent)
    {
      const m = stories[2];
      const jobs = [];
      for (let i = 0; i < 80; i++) {
        const idx = 2 + (i % (ACCOUNTS - 2));
        jobs.push(
          bid(idx, m, parseEther("0.001") + BigInt(i)).then(
            (r) => ({ ok: true, ...r }),
            (e) => ({
              ok: false,
              err: e instanceof Error ? e.message : String(e),
            }),
          ),
        );
      }
      for (let i = 0; i < jobs.length; i += 10) {
        await Promise.all(jobs.slice(i, i + 10));
      }
      await bid(17, m, parseEther("777777"));
      const after = dedupeBest(await scrapeBids(), forDay).find(
        (b) => b.manifest === m,
      );
      const all = await scrapeBids();
      pass(
        "80-dust + closer still correct",
        !!after && after.valueWei === parseEther("777777"),
        `bids_total=${all.length} story_win=${after?.valueWei}`,
      );
      if (all.length > 100) {
        note(
          "high",
          "feed spam works",
          `${all.length} front-bid txs on sink — ranking held but Sync/UI must page; anyone can grief …feed`,
        );
      }
    }

    // 9) frontBidCalldata rejects bad day at encode (client gate)
    {
      let threw = false;
      try {
        frontBidCalldata(stories[0], "yesterday");
      } catch {
        threw = true;
      }
      pass("encode rejects bad forDay", threw);
    }

    const failed = results.filter((r) => !r.ok);
    const summary = {
      ok: failed.length === 0,
      forDay,
      otherDay,
      stories,
      results,
      findings,
      at: new Date().toISOString(),
    };
    writeFileSync(join(OUT, "front-spam.json"), JSON.stringify(summary, null, 2));

    console.log(
      failed.length === 0
        ? `\nall ${results.length} held`
        : `\n${failed.length}/${results.length} broke`,
    );
    if (findings.length) {
      console.log("\nFindings:");
      for (const f of findings) {
        console.log(`  · [${f.severity}] ${f.name}: ${f.detail}`);
      }
    }
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    anvil.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
