# Heart’s Archive — one pager

On-chain broadsheet for PulseChain. Write text to `0x…feed`, chunks to `0x0`. Highest PLS front-bid owns A1. Private desk tool — not public product infra.

## Use it

1. **Connect** wallet on Pulse (top bar). Need a little PLS for gas.
2. **Post** → write text → **Publish**. When it lands you see **You’re live** → Open in reader.
3. **Front page** paints from local cache. Hit **Sync** when you want new posts from `…feed`.
4. **Like** = on-chain sign-off. **Tip** = send PLS / pHEX / INC / etc. to the author (not a like).
5. **Buy A1** = PLS front-bid to `…feed`. Highest bid owns the lead until outbid.
6. **Edition** = Live, or a prior UTC day frozen from bid timestamps.

Lab fake posts stay off unless `?lab=1`, Lab seed checkbox, or `VITE_LAB_SEED=1`.

## Keys

| | |
|---|---|
| Chunk sink | `0x0000…0000` |
| Archive inbox | `0x0000…feed` |
| Cap | 150 KB original text |
| Write mime | text only |
| Discovery | Sync `…feed` (incremental) |
| Share | `#/369/0x…` (hash ≠ browse; Front page clears it) |

## Wire (short)

1. Optional gzip → split ≤20 KiB parts  
2. Each part → tx to **zero**, calldata = raw bytes (legacy Raven JSON+base64 still readable)  
3. Manifest JSON → tx to **`…feed`** listing chunk hashes (+ title/tags/`replaces`/sha256)  
4. Like → JSON `{ kind: "pulse-archive-like", manifest }` to `…feed`

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

```json
{ "kind": "pulse-archive-like", "manifest": "0x…64", "app": "pulse-archive", "appVersion": "0.6.0" }
```

Count unique `(manifest, from)`.

## Front-page bid

JSON calldata → `…feed` **with PLS `value`**:

```json
{ "kind": "pulse-archive-front", "manifest": "0x…64", "app": "pulse-archive", "appVersion": "0.6.0" }
```

Highest `value` wins the lead headline. Outbid to take #1. (Token / “own coin” rails can layer later — PLS first.)

## Chunk eras

| Era | Format |
|---|---|
| Legacy / Raven | UTF-8 JSON `{ chunkData: "<base64>", mimeType }` |
| Archive v0.4+ write | **Raw bytes** as tx `data` |

Readers accept both (`decodeChunkTxInput`).
