# Security

Heart’s Archive is an experimental PulseChain broadsheet. Read this before connecting a wallet.

## Report a vulnerability

If you find a wallet, tip-address, or drain-risk bug:

1. Prefer a **[private GitHub security advisory](https://github.com/ihelpmaybe/hearts-archive/security/advisories/new)** — do not open a public issue with exploit steps.
2. Include: what you did, what you expected, chain (Pulse / anvil), and whether funds moved.
3. We treat money-path reports ahead of cosmetics.

## How to run it

**Recommended:** run a **local copy** like an app — ZIP + `start-press.cmd` (Windows) or `start-press.sh` (Mac/Linux). That build only changes when **you** download or pull again.

A **demo preview** may be hosted on GitHub Pages for looking around. Prefer local before connecting a wallet with real funds, so a future deploy can’t silently change the UI under you.

## What this app can spend

Every spend is a **user-confirmed** wallet popup. There is no background drain, no hidden `approve`, and no WalletConnect relay.

| Action | Where value goes | What you pay |
|---|---|---|
| **Like** | Burn sink `0x…feed` | ≥1 PLS (extra PLS ≠ extra likes) |
| **Buy A1 / front bid** | Burn sink `0x…feed` | PLS you typed |
| **Publish** | Chunks → `0x0` (data only, **0 PLS**); manifest → `0x…feed` (**0 PLS**) | Gas only |
| **Tip** | Story author (`from`) or their optional `tipWallet` | Exact amount you typed (PLS or ERC-20 **`transfer`**, never `approve`) |

Burn to `0x…feed` is intentional (on-chain library / ranking). Wallet scanners often flag that pattern as “drain-looking.” It is not a transfer to a project EOA.

## What this app cannot do

- Cannot move funds without your signature
- Does not request unlimited ERC-20 allowances
- Does not use WalletConnect / Coinbase / Porto connectors (injected wallets only)
- Does not ask for seed phrases
- Does not auto-update a local install

## Tips — check the recipient

Tips go to the **story’s** tip address (or author). A malicious post could set `tipWallet` to an attacker. Always read the address in your wallet confirm screen.

## Custom RPC

The RPC field lets you override Pulse endpoints. Only save URLs you trust; a bad RPC can lie about chain state.

## Still your responsibility

- Re-check the repo / ZIP when you update
- Prefer a burner wallet while experimenting
- `npm install` trusts the lockfile + registry — don’t upgrade deps casually
