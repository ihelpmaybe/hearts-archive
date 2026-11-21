/**
 * Project gate — typecheck, lint, unit tests, smoke.
 * Exit 0 only if all pass.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;

function bin(rel) {
  const p = join(root, "node_modules", rel);
  if (!existsSync(p)) throw new Error(`Missing ${rel} — run npm install`);
  return p;
}

const steps = [
  {
    name: "typecheck",
    args: [bin("typescript/bin/tsc"), "--noEmit", "-p", root],
  },
  {
    name: "lint",
    args: [bin("eslint/bin/eslint.js"), "."],
  },
  {
    name: "unit",
    args: [bin("vitest/vitest.mjs"), "run"],
  },
  {
    name: "smoke",
    args: [join(root, "sim/smoke.mjs")],
  },
  {
    name: "lab",
    args: [join(root, "sim/lab.mjs")],
  },
  {
    // Short A1 gate (Post→Sync→Like→Tip→Front-bid). Full spam: npm run sim:front-spam
    name: "dry",
    args: [join(root, "sim/dry-run.mjs")],
  },
];

let failed = 0;
console.log("Heart’s Archive check\n");

for (const step of steps) {
  process.stdout.write(`· ${step.name}… `);
  const r = spawnSync(node, step.args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    env: process.env,
  });
  if (r.status === 0) {
    console.log("ok");
  } else {
    failed += 1;
    console.log("FAIL");
    if (r.stdout?.trim()) console.log(r.stdout.trim());
    if (r.stderr?.trim()) console.log(r.stderr.trim());
    if (r.error) console.log(String(r.error));
  }
}

console.log("");
if (failed) {
  console.error(`${failed}/${steps.length} failed`);
  process.exit(1);
}
console.log(`all ${steps.length} passed`);
