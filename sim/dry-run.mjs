/**
 * One Foundry dry-run: Post → sink scrape (Sync) → Like → Tip.
 * Local anvil only — no Pulse trail.
 *
 *   npm run sim:dry
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { spawnSync } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
  parseEther,
  parseAbi,
  zeroAddress,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import {
  ARCHIVE_SINK,
  buildManifest,
  chunkCalldata,
  likeCalldata,
  manifestCalldata,
  preparePayload,
  readDocumentFromChain,
  tryParseLike,
  tryParseManifest,
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
const PORT = 8551;
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

function forgeExe() {
  const local = join(
    FOUNDRY_BIN,
    process.platform === "win32" ? "forge.exe" : "forge",
  );
  return existsSync(local) ? local : "forge";
}

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

function deployMockErc20(rpc, pk) {
  const sol = join(__dirname, "MockERC20.sol");
  const r = spawnSync(
    forgeExe(),
    [
      "create",
      `${sol}:MockERC20`,
      "--rpc-url",
      rpc,
      "--private-key",
      pk,
      "--broadcast",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.status !== 0) {
    throw new Error(`forge create failed: ${out.slice(0, 500)}`);
  }
  const m = out.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
  if (!m) throw new Error(`no deploy address in forge output: ${out.slice(0, 500)}`);
  return m[1];
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

function gate(name, cond, detail = "") {
  if (cond) {
    console.log(`  ok  ${name}`);
    return true;
  }
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  return false;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const results = [];
  const pass = (name, cond, detail) => {
    results.push({ name, ok: !!cond, detail: detail || "" });
    return gate(name, cond, detail);
  };

  console.log(`Dry-run · Post → Sync → Like → Tip · :${PORT}\n`);

  const anvil = spawn(
    anvilExe(),
    [
      "--port",
      String(PORT),
      "--accounts",
      "5",
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
    const author = mnemonicToAccount(MNEMONIC, { addressIndex: 0 });
    const tipper = mnemonicToAccount(MNEMONIC, { addressIndex: 1 });
    const liker = mnemonicToAccount(MNEMONIC, { addressIndex: 2 });
    const wallet = (account) =>
      createWalletClient({
        account,
        chain: anvilChain,
        transport: http(RPC),
      });

    // --- Post ---
    const body = Buffer.from(
      "Dry-run post — Heart's Archive on local anvil.\n",
      "utf8",
    );
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
      meta: {
        title: "dry-run note",
        tags: ["dry-run"],
        summary: "anvil only",
        type: prepared.type,
      },
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
    pass("Post", !!manifestHash);

    // --- Sync (scrape sink like the desk) ---
    const tip = await publicClient.getBlockNumber();
    let foundManifest = false;
    const likesBefore = [];
    for (let b = 0n; b <= tip; b++) {
      const block = await publicClient.getBlock({
        blockNumber: b,
        includeTransactions: true,
      });
      for (const tx of block.transactions) {
        if (!tx.to || tx.to.toLowerCase() !== ARCHIVE_SINK) continue;
        if (tx.hash.toLowerCase() === manifestHash.toLowerCase()) {
          foundManifest = !!tryParseManifest(tx.input);
        }
        const like = tryParseLike(tx.input);
        if (like) likesBefore.push(like);
      }
    }
    pass("Sync finds post", foundManifest);

    const getTx = async (hash) => {
      const tx = await publicClient.getTransaction({ hash });
      return { input: tx.input };
    };
    const read = await readDocumentFromChain(getTx, manifestHash);
    pass(
      "Read body",
      Buffer.compare(Buffer.from(read.bytes), body) === 0,
    );

    // --- Like (≥1 PLS burn to …feed; extra PLS ≠ extra likes) ---
    const likeHash = await wallet(liker).sendTransaction({
      account: liker,
      to: ARCHIVE_SINK,
      data: likeCalldata(manifestHash),
      value: 10n ** 18n,
      chain: anvilChain,
    });
    await publicClient.waitForTransactionReceipt({ hash: likeHash });
    const likeTx = await publicClient.getTransaction({ hash: likeHash });
    const likeParsed = tryParseLike(likeTx.input);
    pass(
      "Like",
      !!likeParsed &&
        likeParsed.manifest === manifestHash.toLowerCase() &&
        likeTx.value >= 10n ** 18n,
    );

    // --- Tip (native) ---
    const before = await publicClient.getBalance({ address: author.address });
    const tipHash = await wallet(tipper).sendTransaction({
      account: tipper,
      to: author.address,
      value: parseEther("1.5"),
      chain: anvilChain,
    });
    const tipReceipt = await publicClient.waitForTransactionReceipt({
      hash: tipHash,
    });
    const after = await publicClient.getBalance({ address: author.address });
    pass(
      "Tip PLS",
      tipReceipt.status === "success" && after > before,
      `Δ ${after - before}`,
    );

    // --- Tip ERC-20 (MockERC20 via forge) ---
    try {
      const pk =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // anvil[0]
      const token = deployMockErc20(RPC, pk);
      // fund tipper with tokens from author (deployer = anvil[0] = author)
      const fundHash = await wallet(author).sendTransaction({
        account: author,
        to: token,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [tipper.address, parseEther("100")],
        }),
        chain: anvilChain,
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });
      const balBefore = await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [author.address],
      });
      const ercHash = await wallet(tipper).sendTransaction({
        account: tipper,
        to: token,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [author.address, parseEther("7")],
        }),
        chain: anvilChain,
      });
      const ercReceipt = await publicClient.waitForTransactionReceipt({
        hash: ercHash,
      });
      const balAfter = await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [author.address],
      });
      pass(
        "Tip ERC-20",
        ercReceipt.status === "success" && balAfter > balBefore,
        `token ${token}`,
      );
    } catch (e) {
      pass("Tip ERC-20", false, e instanceof Error ? e.message : String(e));
    }

    const failed = results.filter((r) => !r.ok);
    writeFileSync(
      join(OUT, "dry-run.json"),
      JSON.stringify(
        {
          ok: failed.length === 0,
          manifestHash,
          results,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    console.log(
      failed.length === 0
        ? `\nall ${results.length} passed`
        : `\n${failed.length}/${results.length} failed`,
    );
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    anvil.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
