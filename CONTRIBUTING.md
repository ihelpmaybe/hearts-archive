# Contributing

Heart’s Archive is experimental. Small, careful patches beat drive-by rewrites.

## Before you open a PR

```bash
npm install
npm run check
```

That runs typecheck, lint, unit tests, smoke, and the anvil A1 dry-run.

## Faces

| Face | Command | Notes |
|---|---|---|
| **Press** | `npm run dev:press` or `start-press.*` | Real app path — wallets on |
| **Desk** | `npm run dev` | Local sandbox — **DEV ONLY**, no wallet gate |

Do not split Desk/Press into a second GitHub. Same repo, two Vite modes (`VITE_ARCHIVE_FACE`).

## Rules of the road

- **Text-only publish** — no image upload path
- **Money** — likes / A1 burn PLS to `0x…feed`; tips are `transfer` only (no `approve`). See [`SECURITY.md`](./SECURITY.md)
- **RPC-light** — no auto Sync loops; Sync is user-triggered
- Prefer fixing PROTOCOL / SECURITY docs when wire behavior changes
- Keep personal names / private paths out of the public tree

## Protocol changes

If you touch calldata, manifests, front-bids, or likes, update [`PROTOCOL.md`](./PROTOCOL.md) in the same PR and extend `sim/dry-run.mjs` when the happy path changes.
