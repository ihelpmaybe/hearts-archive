/**
 * Local how-to when the Open paper has no real story yet.
 * Lands as A1 and opens as a full article.
 */
import type { Hash } from "viem";
import type { ArchiveEntry, FrontBidEntry } from "./archive";
import { packArticle } from "./articleFormat";
import { putCachedDoc } from "./cache";
import { upsertCatalog } from "./catalog";
import { pinToShelf } from "./shelf";
import {
  shiftUtcDay,
  utcDayStartSec,
  utcTodayKey,
} from "./editions";
import { LAB_FROM } from "./uiBits";
import { sha256Hex } from "./protocol";

const GUIDE_TAG = "hearts-archive-publish-howto-v4";

/** Default type-cut for the empty-Open publish guide. */
const ASCII_MARK = `
                                                 /\\
                                              /------\\
                                          /----      ----\\
                                      /----              ----\\
                                   /---                      ---\\
                               /----                            ----\\
                           /----                                    ----\\
                       /----   --------------------------------------   ----\\
                   /----                                                    ----\\
                /---                                                            ---\\
            /----    .++++++++++++++++.     ++++++++++++++++                       ----\\
        /----          .#@@@@@@@@@@+.         +@@@@@@@@@@+                             ----\\
    /----               .@@@@@@@@@.            @@@@@@@@@         #          .              ----\\
    |                   .@@@@@@@@#             @@@@@@@@.        #@#         .                  |
    |                   #@@@@@@@@.            +@@@@@@@@        #@@@+    .  /|\\                 |
    |                   @@@@@@@@#             #@@@@@@@+       +@@@@@. ...---*---.........      |
    |                  .@@@@@@@@+            .@@@@@@@@       +@@@@@@@      \\./          ..     |
    |                  #@@@@@@@@             +@@@@@@@#      .@@@@@@@@#      |            .     |
    |                  @@@@@@@@#             #@@@@@@@+     .@##@@@@@@@#     |          ...     |
    |                 .@@@@@@@@#+++#####@@@@@@@@@@@@@      @@  @@@@@@@@+             ...       |
    |                 #@@@@@@@@+++++...     +@@@@@@@#     #@.  .@@@@@@@@.         ....         |
    |                 @@@@@@@@#             @@@@@@@@+    #@.    +@@@@@@@@.    .....            |
    |               ..@@@@@@@@.            .@@@@@@@@    +@+      #@@@@@@@@......               |
    |             ...#@@@@@@@@             +@@@@@@@#   +@+        @@@@@@@@#                    |
    |    |      ...  @@@@@@@@+             @@@@@@@@.  .@#      ...#@@@@@@@@+               |   |
    |   -+-   ...   .@@@@@@@@             .@@@@@@@@  .@@....++###+.+@@@@@@@@+             -+-  |
    |    |   ..     #@@@@@@@#             +@@@@@@@#..@@####+.       #@@@@@@@@.             |   |
    |      ...      @@@@@@@@#             @@@@@@@#+.@@+              @@@@@@@@@                 |
    |     ..       +@@@@@@@@#         ...+##++.    #@+               .@@@@@@@@#                |
    |    ...      +@@@@@@@@@@#+........           #@@                 +@@@@@@@@#               |
    |    .  ....+#######++++.....                #@@+                  #@@@@@@@@+              |
    |    ...    ..........                      #@@@+                  +@@@@@@@@@+             |
    |       .....                             +@@@@@@+                +@@@@@@@@@@@#.           |
    |                                      .+#########++.          .++##############++         |
    |  +====================================================================================+  |
    |  | #   # #####  ###  ####  #####  ####      ###  ####   #### #   # ##### #   # #####  |  |
    |  | #   # #     #   # #   #   #   #         #   # #   # #     #   #   #   #   # #      |  |
    |  | ##### ####  ##### ####    #    ###      ##### ####  #     #####   #   #   # ####   |  |
    |  | #   # #     #   # #  #    #       #     #   # #  #  #     #   #   #    # #  #      |  |
    |  | #   # ##### #   # #   #   #   ####      #   # #   #  #### #   # #####   #   #####  |  |
    |  |                                                                                    |  |
    \\  +====================================================================================+  /
    ----\\                                                                                  /----
        ----\\      -------------    .  .  .  .  .  .  .  .  .  .    -------------      /----
            ----\\                                                                  /----
                ---\\                                                            /---
                   ----\\                                                    /----
                       ----\\                                            /----
                           ----\\                                    /----
                               ----\\                            /----
                                   ---\\                      /---
                                      ----\\              /----
                                          ----\\      /----
                                              ---\\/---
`.trim();

function publishGuideBody(): string {
  return `NO STORY ON THIS PAPER YET — this is a local guide (not on-chain).

HOW TO RUN (no questions)
1) Download Press ZIP: https://github.com/ihelpmaybe/hearts-archive/releases/latest
2) Unzip → START.cmd (Windows) or ./START.sh (Mac/Linux)
3) Browser opens local Press — connect Pulse wallet
• Demo peek only: https://ihelpmaybe.github.io/hearts-archive/ (not a locked install)
• Desk (npm run dev) = DEV sandbox only — not for real wallets

HOW TO PUBLISH
1) Write (phone: bottom tab).
2) Title (max 72) · optional ASCII picture · body text.
3) Optional: summary, tags, Telegram / X, tip wallet.
4) Pick the Open edition day (tomorrow … up to +30 UTC days).
5) Publish (Press + Pulse wallet) — on-chain; gas only on those txs (0 PLS value).

AFTER YOU PUBLISH
• Your story is in the library. It is NOT automatically A1.
• Open the story → Buy A1 with PLS (burns to 0x…feed). Highest bid wins A1–A3; next ranks fill B1–B12, then C…
• Like = burn ≥1 PLS once per wallet (extra PLS ≠ extra likes).
• Tip = send the writer anything (check the tip address).

SYNC
• Hit Sync to pull other people’s …feed ink into this device.
• This guide disappears from the lead when a real bid owns the day.

Have low expectations. BETA.
`.trim();
}

export type HowToGuide = {
  entry: ArchiveEntry;
  front: FrontBidEntry;
  dayKey: string;
};

export async function publishGuideHashForDay(openDay: string): Promise<Hash> {
  const digest = await sha256Hex(
    new TextEncoder().encode(`${GUIDE_TAG}:${openDay}`),
  );
  return (`0x${digest}`) as Hash;
}

export function isPublishGuideEntry(entry: {
  from?: string;
  tags?: string[];
  title?: string;
}): boolean {
  if ((entry.from || "").toLowerCase() !== LAB_FROM) return false;
  if (entry.tags?.includes("publish") && entry.tags?.includes("guide")) {
    return true;
  }
  return (entry.title || "").toUpperCase().includes("HOW TO PUBLISH");
}

export function isPublishGuideFront(
  b: FrontBidEntry,
  guideHash?: Hash | null,
): boolean {
  if (guideHash && b.manifest.toLowerCase() === guideHash.toLowerCase()) {
    return true;
  }
  return (b.from || "").toLowerCase() === LAB_FROM && !!guideHash;
}

/** Open-day publish guide — fills an empty paper as A1. */
export async function buildPublishGuide(
  openDay = shiftUtcDay(utcTodayKey(), 1),
): Promise<HowToGuide> {
  const hash = await publishGuideHashForDay(openDay);
  const digest = hash.slice(2);
  const bidHash = (`0x${digest.replace(/.$/, "b")}`) as Hash;
  const start = utcDayStartSec(openDay);
  const now = Math.floor(Date.now() / 1000);
  /** Must be before the open day starts so the bid counts for that paper. */
  const filedAt = Math.min(now - 60, start - 60);
  const title = "HOW TO PUBLISH ON THIS PAPER";
  const summary =
    "No story yet — local publish guide. Desk = DEV ONLY. Real app = Press (start-press.cmd).";

  const entry: ArchiveEntry = {
    hash,
    from: LAB_FROM,
    timeStamp: filedAt,
    title,
    mimeType: "text/plain",
    type: "text",
    tags: ["guide", "publish", "howto", "local"],
    summary,
    chunkCount: 1,
    kind: "pulse-archive",
  };

  const front: FrontBidEntry = {
    hash: bidHash,
    from: LAB_FROM,
    timeStamp: filedAt - 30,
    manifest: hash,
    valueWei: 50n * 10n ** 18n,
    forDay: openDay,
  };

  const packed = packArticle(ASCII_MARK, publishGuideBody());
  const bytes = new TextEncoder().encode(packed);
  await putCachedDoc({
    hash,
    mimeType: "text/plain",
    title,
    tags: entry.tags,
    summary,
    type: "text",
    from: LAB_FROM,
    postedAt: filedAt,
    chunkCount: 1,
    bytes: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
    savedAt: Date.now(),
  });
  await upsertCatalog([entry]);
  pinToShelf({
    hash,
    from: LAB_FROM,
    timeStamp: filedAt,
    title,
    mimeType: "text/plain",
    type: "text",
    tags: entry.tags,
    summary,
    chunkCount: 1,
    kind: "pulse-archive",
  });

  return { entry, front, dayKey: openDay };
}

/** @deprecated use buildPublishGuide */
export const buildHowToGuide = buildPublishGuide;
