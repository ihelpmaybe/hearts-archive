# Heart’s Archive

[![Check](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/check.yml/badge.svg)](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/check.yml)
[![Pages](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/pages.yml/badge.svg)](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**On-chain newspaper for [PulseChain](https://pulsechain.com).**  
Stories, likes, and A1 bids go to `0x…feed`. Highest PLS front-bid owns the lead. Reads like a broadsheet — not a card feed.

> Experimental · text-only · Raven-compatible (`app`: `pulse-archive`)

```
                         HEARTS ARCHIVE
                    local Press · on-chain ink
```

---

## Run it (recommended)

**Use a local copy** — you control when the UI updates. Connecting a funded wallet to a random web host is a worse trust model.

| Want | Do this |
|---|---|
| **Windows** | [Download ZIP](https://github.com/ihelpmaybe/hearts-archive/archive/refs/heads/main.zip) → unzip → double-click **`start-press.cmd`** |
| **Mac / Linux** | Unzip or clone → `chmod +x start-press.sh && ./start-press.sh` |
| **Need Node** | Install [Node.js 20+ LTS](https://nodejs.org/) once, then the script above |
| **Peek only** | [Demo preview](https://ihelpmaybe.github.io/hearts-archive/) — fine for reading; prefer local before a funded wallet |

First Windows double-click installs deps once; later clicks open Press at `http://127.0.0.1:5177/`. Leave that window open — that’s the app.

Money paths, burns, and tip safety: **[`SECURITY.md`](./SECURITY.md)**.

```bash
git clone https://github.com/ihelpmaybe/hearts-archive.git
cd hearts-archive
npm install
npm run dev:press   # Press — wallets on (people)
# npm run dev       # Desk — local sandbox, DEV ONLY
```

| Face | Command | Wallet | Publish |
|---|---|---|---|
| **Press** (real app) | `start-press.*` / `npm run dev:press` | on | on-chain → `…feed` |
| **Desk** (develop) | `npm run dev` | off | local shelf + test A1 |

```bash
npm run check   # typecheck · lint · unit · smoke · anvil A1 dry
npm run build   # static Press → dist/
```

Lab fake posts stay **off** unless `?lab=1`, the Lab checkbox, or `VITE_LAB_SEED=1`.

---

## What you can do

1. **Write** — UTF-8 text (gzip when useful; hard cap 150 KB). Optional ASCII type-cut.
2. **Sync** — pull `…feed` into a local-first library (IndexedDB). RPC-light; no auto-crawl spam.
3. **Buy A1–A3** — PLS front-bids; top 3 own the A face; next ranks fill **B1+**, then **C/D**.
4. **Like / tip** — like burns ≥1 PLS to `…feed`; tip is a normal `transfer` to the author (no `approve`).
5. **Editions** — Final (≤ today, locked) · Open (tomorrow … +30 UTC days).
6. **Themes** — Venus · Light · Dark · Pulse.

Phone: bottom **Paper · Search · Write · Sync**. Desk chrome stays for developers.

---

## Why

| Problem | This paper |
|---|---|
| Feeds bury signal in chrome | Broadsheet: nameplate, A1, columns |
| “Pinning” is social theater | **Pay PLS** to `0x…feed` for the lead |
| Image boards drown text | **Text-only** publish + soft mute on the face |
| Yesterday vanishes | **Daily editions** from bid timestamps (UTC) |

---

## Protocol (short)

| | |
|---|---|
| Archive inbox | `0x0000…feed` |
| Chunk sink | `0x0000…0000` |
| Write mime | text only |
| Front bid | `{ "kind": "pulse-archive-front", "manifest": "0x…", "forDay": "YYYY-MM-DD" }` + **PLS value** |
| Like | `{ "kind": "pulse-archive-like", "manifest": "0x…" }` + ≥1 PLS |
| Share | `#/369/0x…` |

Full operator wire: [`PROTOCOL.md`](./PROTOCOL.md).

---

## Safety (read this)

- Never paste seed phrases into the archive
- **Likes / A1** burn PLS to `0x…feed` (intentional). Wallet scanners may look spooked — every spend still needs your confirm
- **Tips** = `transfer` to the story’s tip address — check it
- **Publish** = data txs (0 PLS value) + gas
- No background drain, no unlimited `approve`, injected wallets only
- Prefer a burner while experimenting
- Demo Pages ≠ your install — local Press only changes when you update

Details: [`SECURITY.md`](./SECURITY.md).

---

## Scripts

| Script | What |
|---|---|
| `npm run check` | Gate before you share a branch |
| `npm run dev` / `dev:press` | Desk / Press on `:5177` |
| `npm run build` / `build:pages` | Press bundle (Pages uses `/hearts-archive/` base) |
| `npm run sim:dry` | Anvil: Post → Sync → Like → Tip → A1 |
| `npm run sim:lab` | Local Foundry lab (no Pulse trail) |

```
src/            React paper (Library · Post · broadsheet)
public/themes   Theme packs
sim/            Anvil lab + dry-run
PROTOCOL.md     Operator one-pager
SECURITY.md     Money + trust model
```

---

## License / status

[MIT](./LICENSE). Experimental — mainnet ink is forever. Collaborate carefully.
