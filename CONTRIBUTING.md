# Contributing

Heart’s Archive is **not open source** (all rights reserved — see [`LICENSE`](./LICENSE)).  
Experimental. Small, careful patches by invitation beat drive-by rewrites.

## Before you open a PR

```bash
npm install
npm run check
```

That runs typecheck, lint, unit tests, smoke, and the anvil A1 dry-run.

## Faces

| Face | Command | Notes |
|---|---|---|
| **Press** | `npm run dev:press` / `pack:press` | Injected wallets |
| **Gallery** | `npm run dev:gallery` / `build:pages` | Read-only + tip QR; Capacitor webDir |
| **Studio** | `npm run dev:studio` / `pack:studio` | Trezor Connect + Bridge; desktop gate |
| **Desk** | `npm run dev` | Local sandbox — **DEV ONLY**, no wallet gate |

Capacitor: `build:android` / `build:ios` sync Gallery. iOS signed builds need Mac + Xcode.

Do not split faces into a second GitHub. Same repo, Vite modes (`VITE_ARCHIVE_FACE`).

## Rules of the road

- **Text-only publish** — no image upload path
- **Money** — likes / A1 burn PLS to `0x…feed`; tips are `transfer` only (no `approve`). See [`SECURITY.md`](./SECURITY.md)
- **RPC-light** — no auto Sync loops; Sync is user-triggered
- Prefer fixing PROTOCOL / SECURITY docs when wire behavior changes
- Keep personal names / private paths out of the public tree

## Protocol changes

If you touch calldata, manifests, front-bids, or likes, update [`PROTOCOL.md`](./PROTOCOL.md) in the same PR and extend `sim/dry-run.mjs` when the happy path changes.
