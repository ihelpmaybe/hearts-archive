# Security

Heart’s Archive is an experimental PulseChain broadsheet. Read this before connecting a wallet.

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

## Tips — check the recipient

Tips go to the **story’s** tip address (or author). A malicious post could set `tipWallet` to an attacker. Always read the address in your wallet confirm screen.

## Custom RPC

The RPC field lets you override Pulse endpoints. Only save URLs you trust; a bad RPC can lie about chain state.

## Report a false phishing flag

If MetaMask / Blockaid flags this origin, file a mistake report with the exact hostname (e.g. `ihelpmaybe.github.io`) and link this file. Public site: https://ihelpmaybe.github.io/hearts-archive/
