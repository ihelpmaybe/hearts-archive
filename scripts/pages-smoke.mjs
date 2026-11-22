/**
 * Static Press/Pages bundle sanity — no chain, no wallet.
 *   npm run smoke:pages
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const node = process.execPath;

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`ok  ${name}`);
  else {
    fails += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("Pages smoke\n");

const build = spawnSync(
  node,
  [
    join(root, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "-p",
    root,
  ],
  { cwd: root, encoding: "utf8", shell: false },
);
// Prefer already-built dist; rebuild with pages base if missing
if (!existsSync(join(dist, "index.html"))) {
  console.log("· building pages bundle…");
  const r = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build:pages"],
    { cwd: root, encoding: "utf8", shell: true, env: process.env },
  );
  ok("build:pages", r.status === 0, (r.stderr || r.stdout || "").slice(0, 200));
} else {
  ok("dist present", true);
}
void build;

ok("index.html", existsSync(join(dist, "index.html")));
const html = existsSync(join(dist, "index.html"))
  ? readFileSync(join(dist, "index.html"), "utf8")
  : "";
ok(
  "asset refs present",
  /assets\/[^"]+\.(js|css)/.test(html),
  "expected hashed assets in index",
);
ok(
  "PWA manifest",
  existsSync(join(dist, "manifest.webmanifest")),
  "manifest.webmanifest in dist",
);
ok(
  "PWA icons",
  existsSync(join(dist, "icons", "icon-192.png")) &&
    existsSync(join(dist, "icons", "icon-512.png")),
);
ok(
  "manifest linked",
  /manifest\.webmanifest/.test(html),
  "index links manifest",
);
ok("robots.txt", existsSync(join(dist, "robots.txt")));
ok("sitemap.xml", existsSync(join(dist, "sitemap.xml")));
ok("og:image", /property="og:image"/.test(html));
ok("og-banner.png", existsSync(join(dist, "og-banner.png")));
ok("canonical", /rel="canonical"/.test(html));
ok("json-ld", /application\/ld\+json/.test(html));
ok(
  "twitter large image",
  /twitter:card"\s+content="summary_large_image"/.test(html),
);

const assets = existsSync(join(dist, "assets"))
  ? readdirSync(join(dist, "assets"))
  : [];
ok("css chunk", assets.some((f) => f.endsWith(".css")));
ok("js chunk", assets.some((f) => f.endsWith(".js")));

const themes = join(dist, "themes", "index.json");
ok("themes/index.json", existsSync(themes));
if (existsSync(themes)) {
  try {
    const j = JSON.parse(readFileSync(themes, "utf8"));
    ok("theme schema", j.schema === "hearts-archive-theme/v1");
  } catch (e) {
    ok("theme json", false, e instanceof Error ? e.message : String(e));
  }
}

if (fails) {
  console.error(`\n${fails} pages-smoke failure(s)`);
  process.exit(1);
}
console.log("\npages-smoke clean");
