# Heart’s Archive

**On-chain newspaper for PulseChain.**  
Text stories live at `0x…feed`. The highest PLS front-bid owns **A1**. The desk reads like a broadsheet — not a feed of cards.

> Experimental, text-only, Raven-compatible. Private desk energy — not a hosted product.

---

## Why it exists

| Problem | This desk |
|---|---|
| Feeds bury signal in chrome | Broadsheet front: nameplate, A1, columns |
| “Pinning” is social theater | **Pay PLS** to `0x…feed` to hold the lead |
| Media boards invite porn | **Text-only publish** + soft mute on the face |
| Yesterday disappears | **Daily editions** from bid timestamps (UTC) |

---

## Quick start

```bash
npm install
npm run check    # typecheck · lint · unit · smoke · lab
npm run dev      # http://127.0.0.1:5177
```

Connect on **Pulse**. Lab fake posts stay **off** unless `?lab=1`, the Lab seed checkbox, or `VITE_LAB_SEED=1`.

Operator wire: [`PROTOCOL.md`](./PROTOCOL.md)

---

## What you can do

1. **Write** → publish UTF-8 text (gzip when it helps; hard cap 150 KB)
2. **Sync** → pull `…feed` into a local-first library (IndexedDB)
3. **Buy A1** → PLS value on a front-bid tx; highest wins the lead
4. **Like / tip** → on-chain sign-off; tip pHEX / INC / etc. to the author
5. **Edition** → Today · Final (closed) · → Tomorrow · Open (unpublished A1 race)
6. **Themes** → Press (default broadsheet), plus Sailor / Venus / Operator / Pulse packs

---

## Scripts

| Script | What |
|---|---|
| `npm run check` | Gate before you share a branch |
| `npm run dev` | Vite on `:5177` |
| `npm run build` | Production build |
| `npm run sim:lab` | Local anvil publish / read / like (no Pulse trail) |
| `npm run sim:dry` | Post → Sync → Like → Tip on anvil |
| `npm run sim:seed` | Rebuild `public/lab-seed.json` |
| `npm run sim` | Foundry stress → `sim/out/` (gitignored) |

---

## Layout

```
src/           React desk (Library · Post · broadsheet)
public/themes  Theme packs (Press default)
sim/           Anvil lab + dry-run + stress
PROTOCOL.md    Operator one-pager
```

Authors **cannot** publish images through this app — text face only.

---

## Protocol (short)

| | |
|---|---|
| Archive inbox | `0x0000…feed` |
| Chunk sink | `0x0000…0000` |
| Write mime | text only |
| Front bid | `{ "kind": "pulse-archive-front", "manifest": "0x…" }` + **PLS `value`** |
| Like | `{ "kind": "pulse-archive-like", "manifest": "0x…" }` |
| Share | `#/369/0x…` |

On-chain `app` id stays `pulse-archive` for Raven compatibility.

---

## Safety

- Never paste seed phrases into the archive
- Lab ≠ mainnet — Foundry burns nothing on Pulse
- Soft mute is a blunt keyword screen, not an NSFW classifier
- Tips use **Pulse** token addresses (pHEX ≠ Ethereum HEX)

---

## License / status

Private experimental tool. Collaborate carefully; mainnet ink is forever.
