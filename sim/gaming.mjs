import { randomBytes } from "node:crypto";
import { fakeJpeg } from "./protocol-node.mjs";

const GAMES = [
  "Elden Ring",
  "CS2",
  "PoE2",
  "Dota 2",
  "League",
  "Valorant",
  "FF14",
  "WoW",
  "Helldivers 2",
  "Baldur's Gate 3",
  "Minecraft",
  "GTA Online",
  "Warframe",
  "Destiny 2",
  "Apex",
  "Fortnite",
  "Hades II",
  "Stardew",
  "Factorio",
  "Rocket League",
];

const ROLES = [
  "support main",
  "raid lead",
  "coach",
  "clip farmer",
  "theorycrafter",
  "speedrunner",
  "casual",
  "smurf",
  "streamer",
  "lfg bot",
];

const TAGS = [
  "build",
  "guide",
  "patch",
  "meta",
  "clip",
  "lfg",
  "tierlist",
  "exploit",
  "nerf",
  "buff",
  "pvp",
  "pve",
  "raid",
  "arena",
  "loadout",
  "macro",
  "toxic",
  "meme",
  "spoiler",
  "season",
];

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function picks(arr, n, rng) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const j = Math.floor(rng() * copy.length);
    out.push(copy.splice(j, 1)[0]);
  }
  return out;
}

/** Mulberry32 */
export function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function patchNotes(game, rng) {
  const lines = [
    `# ${game} patch notes (sim)`,
    "",
    `## Balance`,
    `- ${pick(["Damage", "Heal", "Cooldown", "Range"], rng)} ${pick(["+8%", "-12%", "+3%", "-5%"], rng)}`,
    `- ${pick(["Ult", "Passive", "Item", "Map"], rng)} rework — ${pick(["safer", "riskier", "cleaner", "buggier"], rng)}`,
    "",
    `## Fixes`,
    `- Crash when ${pick(["opening inventory", "queuing ranked", "loading raid", "emoting"], rng)}`,
    `- Desync in ${pick(["duels", "dungeons", "customs", "spectate"], rng)}`,
    "",
    `## Known issues`,
    `- Hitreg feels ${pick(["spongy", "crispy", "random", "fine"], rng)} on ${pick(["high ping", "wifi", "VPN", "mobile"], rng)}`,
  ];
  // pad for gzip-friendly text volume
  const pad = Array.from({ length: 8 + Math.floor(rng() * 40) }, (_, i) =>
    `- note ${i}: ${game} season grind tip #${Math.floor(rng() * 9000)} — keep ${pick(["cooldowns", "position", "economy", "mana"], rng)} honest.`,
  );
  return [...lines, "", "## Community tips", ...pad].join("\n");
}

function buildGuide(game, rng) {
  const role = pick(ROLES, rng);
  return [
    `${game} ${role} guide`,
    "",
    "Core loop:",
    `1. Open with ${pick(["engage", "poke", "farm", "scout"], rng)}`,
    `2. Trade when ${pick(["ult up", "numbers even", "objective spawns", "enemy flashed"], rng)}`,
    `3. Reset if ${pick(["down a sum", "out of util", "behind tempo", "low resources"], rng)}`,
    "",
    "Loadout:",
    JSON.stringify(
      {
        game,
        role,
        items: picks(
          ["boots", "lens", "core", "flex", "defense", "mobility", "lifesteal"],
          4,
          rng,
        ),
        skillOrder: picks(["Q", "W", "E", "R", "passive"], 5, rng),
      },
      null,
      2,
    ),
    "",
    ...Array.from({ length: 20 + Math.floor(rng() * 80) }, (_, i) =>
      `Step ${i + 1}: hold ${pick(["angle", "wave", "camp", "point"], rng)} until ${pick(["rotate", "commit", "bait", "disengage"], rng)}.`,
    ),
  ].join("\n");
}

function loadoutJson(game, rng) {
  return JSON.stringify(
    {
      game,
      season: 1 + Math.floor(rng() * 12),
      rank: pick(["iron", "gold", "plat", "diamond", "challenger"], rng),
      modules: Array.from({ length: 6 + Math.floor(rng() * 10) }, () => ({
        slot: pick(["weapon", "armor", "trinket", "aura", "pet"], rng),
        name: `${pick(["Void", "Solar", "Arc", "Kinetic", "Chaos"], rng)} ${pick(["Edge", "Ward", "Pulse", "Fang"], rng)}`,
        rolls: Array.from({ length: 3 }, () => Math.round(rng() * 100)),
      })),
    },
    null,
    2,
  );
}

function toxicPost(game, rng) {
  return [
    `${pick(["gg ez", "report mid", "diff", "bot lane int"], rng)} — ${game}`,
    "",
    `teammates ${pick(["int", "throw", "grief", "afk"], rng)} every ${pick(["other", "third", "ranked"], rng)} game.`,
    `unironically ${pick(["uninstall", "touch grass", "soft int back"], rng)}.`,
  ].join("\n");
}

function longEssay(game, rng) {
  const para = () =>
    `${game} meta shifted after the last patch. If you still ${pick(["force old comps", "ignore tempo", "overfarm", "chase kills"], rng)}, you lose for free. The correct plan is to ${pick(["play for spawns", "stack util", "deny vision", "force 50/50s"], rng)} and only take fights when ${pick(["numbers favor", "ult economy is up", "objective timers align"], rng)}.`;
  return Array.from({ length: 40 + Math.floor(rng() * 120) }, para).join(
    "\n\n",
  );
}

/**
 * @returns {{ title: string, summary: string, tags: string[], note?: string, cw?: boolean, mimeType: string, body: Buffer, kind: string }}
 */
export function makeGamingDoc(userIndex, rng) {
  const game = pick(GAMES, rng);
  const roll = rng();

  // 8% spam duplicate meme (same body → same sha if identical)
  if (roll < 0.08) {
    const body = Buffer.from(
      "GAMING MEME TEMPLATE v1 — insert reaction here\n".repeat(12),
      "utf8",
    );
    return {
      title: `${game} meme`,
      summary: "copypasta",
      tags: ["meme", pick(TAGS, rng), game.toLowerCase().replace(/\s+/g, "")],
      mimeType: "text/plain;charset=utf-8",
      body,
      kind: "spam-meme",
      cw: false,
    };
  }

  // 12% screenshot-like (bad gzip)
  if (roll < 0.2) {
    const size = 8_000 + Math.floor(rng() * 55_000);
    return {
      title: `${game} clip frame`,
      summary: "pseudo-jpeg screenshot",
      tags: ["clip", "image", pick(TAGS, rng)],
      mimeType: "image/jpeg",
      body: fakeJpeg(size),
      kind: "screenshot",
      cw: false,
    };
  }

  // 10% toxic / CW
  if (roll < 0.3) {
    const body = Buffer.from(toxicPost(game, rng), "utf8");
    return {
      title: `${game} rant`,
      summary: "tilt post",
      tags: ["toxic", pick(TAGS, rng)],
      note: "sim CW",
      mimeType: "text/plain;charset=utf-8",
      body,
      kind: "toxic",
      cw: true,
    };
  }

  // 15% loadout json
  if (roll < 0.45) {
    const body = Buffer.from(loadoutJson(game, rng), "utf8");
    return {
      title: `${game} loadout`,
      summary: "export json",
      tags: ["loadout", "json", pick(TAGS, rng)],
      mimeType: "application/json",
      body,
      kind: "loadout",
      cw: false,
    };
  }

  // 15% patch notes
  if (roll < 0.6) {
    const body = Buffer.from(patchNotes(game, rng), "utf8");
    return {
      title: `${game} patch digests`,
      summary: "fake patch notes",
      tags: ["patch", "meta", pick(TAGS, rng)],
      mimeType: "text/markdown;charset=utf-8",
      body,
      kind: "patch",
      cw: false,
    };
  }

  // 15% long essay (multi-chunk potential)
  if (roll < 0.75) {
    const body = Buffer.from(longEssay(game, rng), "utf8");
    return {
      title: `${game} meta essay`,
      summary: "longform take",
      tags: ["guide", "meta", pick(TAGS, rng)],
      mimeType: "text/plain;charset=utf-8",
      body,
      kind: "essay",
      cw: false,
    };
  }

  // 10% binary blob noise (video-ish)
  if (roll < 0.85) {
    const size = 40_000 + Math.floor(rng() * 90_000);
    return {
      title: `${game} vod snippet`,
      summary: "random binary stand-in",
      tags: ["clip", "video"],
      mimeType: "video/mp4",
      body: randomBytes(size),
      kind: "vod-blob",
      cw: false,
    };
  }

  // rest: build guide
  const body = Buffer.from(buildGuide(game, rng), "utf8");
  return {
    title: `${game} ${pick(ROLES, rng)} guide`,
    summary: "step guide",
    tags: ["guide", "build", pick(TAGS, rng)],
    mimeType: "text/markdown;charset=utf-8",
    body,
    kind: "guide",
    cw: false,
    lang: "en",
  };
}

export { GAMES, TAGS, ROLES };
