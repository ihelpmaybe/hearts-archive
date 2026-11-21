# Heart’s Archive

[![Check](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/check.yml/badge.svg)](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/check.yml)
[![Pages](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/pages.yml/badge.svg)](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/pages.yml)

**On-chain newspaper for [PulseChain](https://pulsechain.com).**  
Stories, likes, and A1 bids go to `0x…feed`. Highest PLS front-bid owns the lead.

> Experimental · text-only · Raven-compatible (`app`: `pulse-archive`) · **not open source**

---

## Use it (3 steps)

1. Download **[the latest Press ZIP](https://github.com/ihelpmaybe/hearts-archive/releases/latest)** → `hearts-archive-press.zip`
2. Unzip → double-click **`START.cmd`** (Windows) or run **`./START.sh`** (Mac/Linux)
3. Browser opens → connect a **Pulse** wallet → **Write** → **Publish**  
   Want the front page? Open your story → **Buy A1** (PLS)

Leave the starter window open while you use it. Close it to stop.

**No Node install.** That ZIP is a frozen build — it only changes when **you** download a newer release.  
Money paths: [`SECURITY.md`](./SECURITY.md) · Run sheet inside the ZIP: `RUN.txt`

### Then what?

| Goal | Tap |
|---|---|
| Read the paper | **Paper** (phone bottom bar) / front page |
| Pull new ink | **Sync** |
| Publish | **Write** → title + body → **Publish** |
| Own A1 | Open story → bid PLS higher than the lead |

### Peek only

[Demo preview](https://ihelpmaybe.github.io/hearts-archive/) — fine for reading. It reloads from the host every visit (not a locked install). Prefer the Press ZIP for a wallet.

---

## Developers

```bash
git clone https://github.com/ihelpmaybe/hearts-archive.git
cd hearts-archive
npm install
npm run dev:press    # Press with Vite
npm run build && npm run pack:press   # same ZIP users get
npm run check
```

| Face | Command | Wallet |
|---|---|---|
| **Press** | `START.cmd` / `dev:press` / release ZIP | on |
| **Desk** | `npm run dev` | off (DEV ONLY) |

Lab fake posts stay **off** unless `?lab=1`, Lab checkbox, or `VITE_LAB_SEED=1`.

Wire: [`PROTOCOL.md`](./PROTOCOL.md) · Patches: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

---

## Why

| Problem | This paper |
|---|---|
| Feeds bury signal | Broadsheet: nameplate, A1, columns |
| “Pinning” is theater | **Pay PLS** to `0x…feed` for the lead |
| Image boards drown text | **Text-only** publish |
| Yesterday vanishes | **Daily editions** (UTC) |

---

## Protocol (short)

| | |
|---|---|
| Archive inbox | `0x0000…feed` |
| Chunk sink | `0x0000…0000` |
| Front bid | PLS value + `{ kind: "pulse-archive-front", manifest, forDay }` |
| Like | ≥1 PLS + `{ kind: "pulse-archive-like", manifest }` |
| Share | `#/369/0x…` |

---

## Status / rights

**Not open source** — see [`LICENSE`](./LICENSE). Experimental; mainnet ink is forever.
