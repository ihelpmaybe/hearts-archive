# Heart’s Archive

Local PulseChain document archive (Raven-compatible read; write to `0x…feed`).  
On-chain `kind` / app id stays `pulse-archive` for compatibility.

**Status:** experimental desk tool — not public product infra.

## Quick start

```bash
npm install
npm run check    # typecheck + lint + unit tests + smoke
npm run dev      # http://127.0.0.1:5177
```

## Scripts

| Script | What |
|---|---|
| `npm run check` | Gate: `tsc` + eslint + vitest + protocol smoke |
| `npm run dev` | Vite on `:5177` (explorer proxied) |
| `npm run build` | Production build |
| `npm run test` | Unit tests |
| `npm run lint` | ESLint |
| `npm run smoke` | Protocol / explorer smoke (Node) |
| `npm run sim:lab` | **Preferred** — local anvil publish/read/like (no Pulse trail) |
| `npm run sim` | Foundry stress · 1000 users → `sim/out/` |
| `npm run sim:quick` | Stress, 100 users |
| `npm run catalog` | Optional static `public/catalog.json` |

## Layout

- `src/` — React app (Library + Post)
- `sim/` — anvil load sim + smoke
- `scripts/` — catalog builder + check runner

## Protocol notes (v0.4)

- Manifest → `…feed`; chunks → `0x0`
- New chunks: **raw calldata** (legacy JSON+base64 still readable)
- Gzip when it helps; skip image/video/audio/pdf/zip
- Hard publish cap: **150 KB** original
- Client: explorer paging, IndexedDB catalog, sha republish gate, stuck-publish retry

## Foundry

Anvil lives at `%USERPROFILE%\.foundry\bin`. `npm run sim` starts it on `:8549`.
