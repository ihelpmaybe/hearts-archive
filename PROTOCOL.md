# Heart’s Archive — one pager

On-chain broadsheet for PulseChain. Write text to `0x…feed`, chunks to `0x0`. Highest PLS front-bid owns A1. Private desk tool — not public product infra.

## Faces (one repo)

| Face | Command | Wallet | Publish |
|---|---|---|---|
| **Desk** | `npm run dev` | off | local shelf |
| **Press** | `npm run build` / `dev:press` | on | chain → `…feed` |

Override: `VITE_ARCHIVE_FACE=desk|press`. Do **not** split into a second GitHub.

## Use it (Press)

1. **Connect** wallet on Pulse (top bar). Need a little PLS for gas.
2. **Post** → write text → **Publish**. When it lands you see **You’re live** → Open in reader.
3. **Front page** paints from local cache. Hit **Sync** when you want new posts from `…feed`.
4. **Like** = burn **≥1 PLS** to `…feed` with like JSON. Extra PLS still = **one** like per wallet. **Tip** = send the writer anything on Pulse — not a like.
5. **Publish + A1 + gas = PLS only.** Front-bid is native PLS to `…feed` with optional `forDay` (printed YYYY-MM-DD). You may bid higher anytime before that day’s UTC midnight — each bid is a new PLS tx; highest wins. Not a top-up of the old tx.
6. **Edition** = **≤ today · Final** (locked) and **Open** = tomorrow through **+30 UTC days**. Sync lookback = **60d** (2× schedule): post today for +30d, return on day 59, still catch it. Publish tx is at today’s height, not the paper day. Legacy bids without `forDay` = bid calendar day + 1.

Lab fake posts stay off unless `?lab=1`, Lab seed checkbox, or `VITE_LAB_SEED=1`.

## Keys

| | |
|---|---|
| Chunk sink | `0x0000…0000` |
| Archive inbox | `0x0000…feed` |
| Cap | 150 KB original text |
| Write mime | text only |
| Discovery | Sync since last visit, capped at 60d / 2× schedule (one tip stream; stop on known / age) |
| Share | `#/369/0x…` (hash ≠ browse; Front page clears it) |

## Wire (short)

1. Optional gzip → split ≤20 KiB parts  
2. Each part → tx to **zero**, calldata = raw bytes (legacy Raven JSON+base64 still readable)  
3. Manifest JSON → tx to **`…feed`** listing chunk hashes (+ title/tags/`replaces`/sha256)  
4. Like → JSON `{ kind: "pulse-archive-like", manifest }` to `…feed` **with ≥1 PLS `value`** (more PLS ≠ more likes)

## Client habits

- Local-first: catalog + docs + likes in IndexedDB; re-open = no RPC  
- Free gas est (no estimateGas while typing); balance gate before Publish  
- Series: `replaces` chain collapses in Library (tip + older)  
- Export/Import = shelf + catalog JSON backup  
- `j` / `k` move cards, `Esc` clears reader  
- Text face only — authors cannot publish images  
- Soft mute holds blunt lewd wording off the face until opened  
- Tip presets use **Pulse** addresses (pHEX ≠ Ethereum HEX)

## Verify locally

```bash
npm run check      # tsc + lint + unit + smoke + lab
npm run sim:dry    # Post → Sync → Like → Tip PLS + ERC-20 on anvil
npm run sim:seed   # news + book + 3-card series → public/lab-seed.json
npm run dev        # :5177
```

## Likes payload

JSON calldata → `…feed` **with ≥1 PLS `value`**:

```json
{ "kind": "pulse-archive-like", "manifest": "0x…64", "app": "pulse-archive", "appVersion": "0.6.0" }
```

Count unique `(manifest, from)`. Txs under 1 PLS are ignored. Paying 5 PLS still counts as one like.

## Front-page bid

JSON calldata → `…feed` **with PLS `value`**:

```json
{ "kind": "pulse-archive-front", "manifest": "0x…64", "app": "pulse-archive", "appVersion": "0.6.0" }
```

Highest `value` for that `forDay` wins that paper’s A1. Outbid before that day’s UTC midnight. Schedule ≤ **+30d**; Sync walks ≤ **60d** so a long absence still sees max-horizon posts. Legacy bids with no `forDay` target bid-day + 1.

## Chunk eras

| Era | Format |
|---|---|
| Legacy / Raven | UTF-8 JSON `{ chunkData: "<base64>", mimeType }` |
| Archive v0.4+ write | **Raw bytes** as tx `data` |

Readers accept both (`decodeChunkTxInput`).
