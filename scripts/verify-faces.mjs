import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function appJs(root) {
  const assets = join(root, "dist", "assets");
  const name = readdirSync(assets).find((f) => f.startsWith("App-") && f.endsWith(".js"));
  if (!name) throw new Error(`no App-*.js in ${assets}`);
  return readFileSync(join(assets, name), "utf8");
}

const press = appJs("out/hearts-archive-press");
const studio = appJs("out/hearts-archive-studio");

const checks = [
  ["press has WalletBar path", press.includes("Switch to Pulse") || press.includes("MetaMask")],
  ["press has Demo costume code", press.includes("Demo ·")],
  ["studio has Connect Trezor", studio.includes("Connect Trezor")],
  ["studio has Bridge hint", studio.includes("Bridge")],
  ["studio has tip QR EIP-681", studio.includes("ethereum:") || studio.includes("@369")],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log(ok ? `ok  ${name}` : `FAIL ${name}`);
  if (!ok) fail += 1;
}
process.exit(fail ? 1 : 0);
