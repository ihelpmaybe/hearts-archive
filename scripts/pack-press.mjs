/**
 * Pack a user Press ZIP: prebuilt dist + START scripts (no Node to run).
 *   node scripts/pack-press.mjs
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const outRoot = join(root, "out");
const outDir = join(outRoot, "hearts-archive-press");
const zipPath = join(outRoot, "hearts-archive-press.zip");

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(r.stdout || "");
    console.error(r.stderr || "");
    process.exit(r.status || 1);
  }
}

console.log("Pack Press release bundle\n");

console.log("· building Press (base /)…");
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:press"]);
if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/index.html missing after build:press");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(dist, join(outDir, "dist"), { recursive: true });
mkdirSync(join(outDir, "scripts"), { recursive: true });
cpSync(
  join(root, "scripts", "serve-dist.ps1"),
  join(outDir, "scripts", "serve-dist.ps1"),
);
cpSync(join(root, "START.cmd"), join(outDir, "START.cmd"));
cpSync(join(root, "START.sh"), join(outDir, "START.sh"));
cpSync(join(root, "RUN.txt"), join(outDir, "RUN.txt"));
cpSync(join(root, "SECURITY.md"), join(outDir, "SECURITY.md"));
cpSync(join(root, "LICENSE"), join(outDir, "LICENSE"));

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
writeFileSync(
  join(outDir, "VERSION.txt"),
  `Heart's Archive Press ${pkg.version}\n`,
  "utf8",
);

rmSync(zipPath, { force: true });
if (process.platform === "win32") {
  run("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force`,
  ]);
} else {
  run("zip", ["-r", "hearts-archive-press.zip", "hearts-archive-press"], outRoot);
}

console.log(`ok  ${outDir}`);
console.log(`ok  ${zipPath}`);
