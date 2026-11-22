# Heart’s Archive

[![Check](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/check.yml/badge.svg)](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/check.yml)
[![Pages](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/pages.yml/badge.svg)](https://github.com/ihelpmaybe/hearts-archive/actions/workflows/pages.yml)
[![Latest release](https://img.shields.io/github/v/release/ihelpmaybe/hearts-archive?label=Press)](https://github.com/ihelpmaybe/hearts-archive/releases/latest)
[![License](https://img.shields.io/badge/license-Proprietary-red)](./LICENSE)

<p align="center">
  <img src="public/brand/ha-banner.png" alt="Heart’s Archive — on-chain newspaper for PulseChain" width="520" />
</p>

**On-chain newspaper for [PulseChain](https://pulsechain.com).**  
Stories, likes, and A1 bids go to `0x…feed`. Highest PLS front-bid owns the lead.

> Experimental · text-only · Raven-compatible (`app`: `pulse-archive`) · **not open source**

### Share this

**Peek (read + tip QR):** https://ihelpmaybe.github.io/hearts-archive/  
**Press ZIP (wallets):** https://github.com/ihelpmaybe/hearts-archive/releases/latest  

Copy/paste for X:

```
Heart’s Archive — on-chain newspaper for PulseChain.
Read + tip QR: https://ihelpmaybe.github.io/hearts-archive/
Publish (Press ZIP): https://github.com/ihelpmaybe/hearts-archive/releases/latest
```

---

## Products (same repo)

| Face | What | Wallet |
|---|---|---|
| **Gallery** | Read-only paper + tip QR · Pages peek + phone PWA / Capacitor | Demo chip only (cannot spend) |
| **Press** | Everyday publish / like / tip / A1 | Injected (MetaMask / Rabby) |
| **Studio** | Power publisher on desktop | **Trezor Connect + Bridge** (real device path) |
| **Desk** | Local sandbox | Off (DEV ONLY) |

---

## Use it (Press — 3 steps)

1. Download **[the latest Press ZIP](https://github.com/ihelpmaybe/hearts-archive/releases/latest)** → `hearts-archive-press.zip`
2. Unzip → double-click **`START.cmd`** (Windows) or run **`./START.sh`** (Mac/Linux)
3. Browser opens → connect a **Pulse** wallet → **Write** → **Publish**  
   Want the front page? Open your story → **Buy A1** (PLS)

Leave the starter window open while you use it. Close it to stop.

**Studio ZIP** (`hearts-archive-studio.zip`) is the same flow with **Connect Trezor** instead of MetaMask. Needs Suite / Bridge on the PC.

**No Node install** for ZIPs. Money paths: [`SECURITY.md`](./SECURITY.md) · Run sheet: `RUN.txt`

### Tip QR

Open a story → tip strip shows an **EIP-681** QR for native PLS on Pulse (`ethereum:<addr>@369`). Gallery is scan/copy only; Press/Studio can also Tip in-app. Always verify the recipient on device.

### Phone

- **PWA:** open the [Gallery peek](https://ihelpmaybe.github.io/hearts-archive/) → Add to Home Screen (iOS: Share → Add to Home Screen).
- **Capacitor:** `npm run build:android` / `build:ios` syncs Gallery into `android/` / `ios/`. **Signed iOS IPA needs a Mac + Xcode**; Android APK can build on this Windows box with Android Studio. Share uses the native share sheet when native.

### Peek only

[Demo preview](https://ihelpmaybe.github.io/hearts-archive/) — Gallery face (read + tip QR). Prefer Press / Studio ZIPs to spend.

---

## Developers

```bash
git clone https://github.com/ihelpmaybe/hearts-archive.git
cd hearts-archive
npm install
npm run dev:press      # Press with Vite
npm run dev:gallery    # read-only
npm run dev:studio     # Trezor (desktop)
npm run build && npm run pack:press
npm run pack:studio
npm run check
```

| Face | Command |
|---|---|
| **Press** | `dev:press` / `pack:press` |
| **Gallery** | `dev:gallery` / `build:pages` |
| **Studio** | `dev:studio` / `pack:studio` |
| **Desk** | `npm run dev` |

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
| Tip QR | `ethereum:<tipTo>@369` (± `?value=` wei) |
| Share | `#/369/0x…` |

---

## Status / rights

**Latest:** [v0.8.1](https://github.com/ihelpmaybe/hearts-archive/releases/tag/v0.8.1) — Gallery · Press · Studio · tip QR.  
**Not open source** — see [`LICENSE`](./LICENSE). Experimental; mainnet ink is forever.

### Remaining (todo)

| # | Todo | Issue |
|---|---|---|
| 1 | **Live money path** — Press (Chrome + Pulse wallet) · Studio (Bridge + Trezor) · phone tip QR scan | [#17](https://github.com/ihelpmaybe/hearts-archive/issues/17) |
| 2 | **Android APK / device** — Capacitor `android/` needs SDK / Studio (or CI) | [#18](https://github.com/ihelpmaybe/hearts-archive/issues/18) |
| 3 | **Dependabot vulns** — triage money-path risk vs noise | [#19](https://github.com/ihelpmaybe/hearts-archive/issues/19) |
| 4 | **Protocol limits (known)** — `0x…feed` spam · Sync/Find paging · multi-chunk orphans | [#20](https://github.com/ihelpmaybe/hearts-archive/issues/20) |

Non-goals for now: App Store submit, WalletConnect-in-Press, ERC-20 tip QRs, Electron.
