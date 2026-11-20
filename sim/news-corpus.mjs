/** Fake Pulse / HEX / crypto desk news for Foundry seed (not real reporting). */

export const NEWS_ITEMS = [
  {
    title: "PulseChain gas stays cheap — archive posts spike",
    tags: ["pulse", "gas", "news"],
    summary: "Calldata costs still low; more docs landing on …feed.",
    body: `Desk note (sim)

PulseChain base fee remains low enough that small text manifests are pocket change.
Heart's Archive lab seed uses this window to post short news notes on a local Foundry chain only — nothing hits mainnet.

What operators are watching:
- sink activity at 0x…feed
- gzip wins on text, skip on images
- likes as tiny sign-off txs

This file is synthetic seed content for testing the reader + helper AI.`,
  },
  {
    title: "HEX stake renewals: weekend checklist",
    tags: ["hex", "stakes", "checklist"],
    summary: "Renewal windows, endstake hygiene, don’t stamp claimed early.",
    body: `HEX weekend checklist (sim)

1. Confirm stake end day before you touch anything.
2. Snapshot bag first if you’re migrating or claiming theater.
3. Never mark claimed before pay > 0.
4. Keep T-share / principal notes in your own archive post if you want a paper trail.

Not advice. Seed text for Heart's Archive Foundry lab.`,
  },
  {
    title: "Incubator rumor roundup — treat as noise",
    tags: ["incubator", "rumor", "news"],
    summary: "Unverified chatter; grade claims before you act.",
    body: `Rumor roundup (sim · claim_grade: guessed)

- New “partner” tweets: no contract yet.
- UI reskins ≠ product shipping.
- If there’s no address + verified source, it’s theater.

Archive tip: post the rumor with tag rumor and cw if spicy — keep signal and junk separable.`,
  },
  {
    title: "How likes work on Heart’s Archive",
    tags: ["guide", "likes", "meta"],
    summary: "On-chain sign-off to …feed, counted per wallet.",
    body: `Likes (sim guide)

A Like is a small JSON transaction to 0x…feed:
{ "kind": "pulse-archive-like", "manifest": "0x…" }

Unique (manifest, wallet) counts. Tips to the author are separate — pay if you want, like if you just want to sign off.

New user path: open a card → Like (on Pulse / lab) → Refresh.`,
  },
  {
    title: "PLS / eHEX desk: what moved overnight",
    tags: ["pls", "ehex", "markets"],
    summary: "Synthetic overnight tape for reader drills.",
    body: `Overnight tape (sim · not live prices)

- PLS: quiet range, low drama.
- eHEX: follows HEX beta with the usual lag jokes.
- Gas: still the free alpha for calldata apps.

If you’re reading this in the helper, ask “what’s here” to see the full seed stack.`,
  },
  {
    title: "Security note: never paste seeds into the archive",
    tags: ["security", "guide"],
    summary: "Archive is public calldata. Secrets don’t belong here.",
    body: `Security (sim)

Heart's Archive stores whatever you publish in calldata forever.
Do NOT post:
- seed phrases / private keys
- passwords / API tokens
- private medical or identity docs

Do post: notes, guides, citations, public research digests.`,
  },
  {
    title: "Foundry lab vs Pulse mainnet",
    tags: ["foundry", "guide", "dev"],
    summary: "Lab burns nothing on Pulse; mainnet is forever.",
    body: `Foundry vs Pulse (sim)

npm run sim:lab / sim:seed-news → local anvil.
Good for publish, readback, likes, UI drills.

Pulse mainnet → permanent trail. Use when you’re sure.
This seed exists so you can practice as a new reader with zero chain baggage.`,
  },
  {
    title: "Community briefing: how to use Library",
    tags: ["guide", "ui"],
    summary: "Search, open, Details, Like, Tip.",
    body: `Library tour (sim)

Left: cards from …feed + local catalog.
Right: reader — open a hash or click a card.
Top: search with tag: type: from:
Like = on-chain sign-off. Tip = send PLS to author.
Stuck publish rail on Post if a multi-chunk job dies mid-way.`,
  },
];
