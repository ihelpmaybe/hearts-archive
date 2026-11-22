# Security

Heart’s Archive is an experimental PulseChain broadsheet. Read this before connecting a wallet.

## Report a vulnerability

If you find a wallet, tip-address, or drain-risk bug:

1. Prefer a **[private GitHub security advisory](https://github.com/ihelpmaybe/hearts-archive/security/advisories/new)** — do not open a public issue with exploit steps.
2. Include: what you did, what you expected, chain (Pulse / anvil), and whether funds moved.
3. We treat money-path reports ahead of cosmetics.

## How to run it

**Recommended (users):** download the **[Press release ZIP](https://github.com/ihelpmaybe/hearts-archive/releases/latest)** → unzip → **`START.cmd`** / **`START.sh`**.  
No Node. Serves a **frozen** build on `http://127.0.0.1:5177/`. It only changes when **you** download a newer release.

**Studio (Trezor):** `hearts-archive-studio.zip` — same serve path, **Trezor Connect + Bridge** only. Not a software HD / mnemonic unlock. Needs Suite or Bridge on `:21325`. Desktop-only.

**Developers:** `npm run dev:press` / `dev:studio` or `npm run pack:press` / `pack:studio`.

**Gallery peek** ([GitHub Pages](https://ihelpmaybe.github.io/hearts-archive/) + Capacitor / PWA): **cannot spend**. Demo chip ≠ hardware. Tip via QR / copy only.

### “Add to Home Screen” on the live demo

**Not a locked install.** The icon still loads **whatever is on Pages** each open (malicious-update risk). Use the release ZIP instead.

## What this app can spend

Every spend is a **user-confirmed** signature (injected wallet popup or Trezor screen). There is no background drain, no hidden `approve`, and no WalletConnect relay.

| Action | Where value goes | What you pay |
|---|---|---|
| **Like** | Burn sink `0x…feed` | ≥1 PLS (extra PLS ≠ extra likes) |
| **Buy A1 / front bid** | Burn sink `0x…feed` | PLS you typed |
| **Publish** | Chunks → `0x0` (data only, **0 PLS**); manifest → `0x…feed` (**0 PLS**) | Gas only |
| **Tip** | Story author (`from`) or their optional `tipWallet` | Exact amount you typed (PLS or ERC-20 **`transfer`**, never `approve`) |

Burn to `0x…feed` is intentional (on-chain library / ranking). Wallet scanners often flag that pattern as “drain-looking.” It is not a transfer to a project EOA.

## Tip QR

QR encodes **EIP-681** for the story tip address on Pulse (`@369`). A malicious post could set `tipWallet` to an attacker. **Always verify the recipient on device** before sending.

## What this app cannot do

- Cannot move funds without your signature
- Does not request unlimited ERC-20 allowances
- Does not use WalletConnect / Coinbase / Porto connectors (Press = injected; Studio = Trezor Connect)
- Does not ask for seed phrases
- Does not auto-update a local install
- Gallery / phone Capacitor shell cannot publish, like, tip in-app, or bid A1

## Custom RPC

The RPC field lets you override Pulse endpoints. Only save URLs you trust; a bad RPC can lie about chain state.

## Still your responsibility

- Re-check the repo / ZIP when you update
- Prefer a burner wallet while experimenting
- `npm install` trusts the lockfile + registry — don’t upgrade deps casually
