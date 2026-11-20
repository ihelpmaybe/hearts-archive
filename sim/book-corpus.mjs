/**
 * Lab “book” — readable chapters only. One Library card.
 * Synthetic Foundry seed; not a real publication.
 */

export const BOOK = {
  title: "Operator Field Manual (lab)",
  tags: ["book", "guide", "lab"],
  summary:
    "Short lab manual — one Library card. How feed, chunks, likes, and hygiene work.",
  body: `HEART'S ARCHIVE — OPERATOR FIELD MANUAL (LAB EDITION)

Synthetic seed book for the Foundry lab. Not financial advice. Not Pulse mainnet.

How to read this in the app: one card in Library → open → scroll. Chunks are plumbing; you should never have to think about them.


══════════════════════════════════════
CHAPTER 1 — What the sink is
══════════════════════════════════════

The shared inbox is 0x…feed. Authors send archive manifests there. Readers browse that address, not a secret list of hashes.

Author is still on every transaction as “from.” Trust a person → follow their wallet. Discover the commons → watch the feed.

Lab posts in this app may be loaded from a local seed file so you can drill the UI without burning Pulse gas.


══════════════════════════════════════
CHAPTER 2 — Manifests and chunks
══════════════════════════════════════

One publish = one Library card.

Under the hood the body may be split into ~20 KB pieces (chunks), then a manifest transaction to …feed lists those chunk hashes, title, tags, and checksum.

You open the card. The reader reassembles the file. If something says “2 chunks,” that is storage detail — still one document.


══════════════════════════════════════
CHAPTER 3 — Likes vs tips
══════════════════════════════════════

Like = on-chain sign-off. A tiny JSON transaction to …feed pointing at this document’s manifest. One count per wallet per doc.

Tip = send PLS to the author if you want to pay. Separate button, separate meaning.

Do not confuse applause with payment.


══════════════════════════════════════
CHAPTER 4 — Lab vs mainnet
══════════════════════════════════════

Foundry / anvil burns nothing on Pulse. Mainnet is forever.

Use the lab to stress the reader, filters, and cards. When you publish for real, you are writing calldata the world can keep forever.


══════════════════════════════════════
CHAPTER 5 — Hygiene
══════════════════════════════════════

Never paste seeds, private keys, or mnemonics into an archive post. Calldata is public.

Treat rumor as unverified until a contract or transaction proves it. Tag claims. Prefer short posts and chapter splits over stuffing a novel past the size cap (~150 KB).


══════════════════════════════════════
CHAPTER 6 — Closing drill
══════════════════════════════════════

1. Refresh Library (feed or local seed).
2. Click a card — do not hunt raw hashes.
3. Read. Like if you mean it. Tip only if you mean to pay.
4. Post your own note when the lab feels boring.

— end of lab manual —
`,
};