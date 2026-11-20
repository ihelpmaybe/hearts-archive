# Heart’s Archive protocol

Compatible with Raven-style on-chain documents on PulseChain (369).  
Wire format / `kind: "pulse-archive"` unchanged.

## Addresses

| Role | Address |
|---|---|
| Chunk sink | `0x0000…0000` (burn / zero) |
| Archive inbox | `0x0000…feed` |

## Flow

1. Split body into ≤20 KiB parts (after optional gzip)
2. Each part → tx **to zero**, calldata = payload
3. Manifest JSON → tx **to `…feed`**, lists chunk tx hashes

## Chunk calldata

| Era | Format |
|---|---|
| Legacy / Raven | UTF-8 JSON `{ chunkData: "<base64>", mimeType }` |
| Archive v0.4+ write | **Raw bytes** as tx `data` (no JSON) |

Readers must accept both (`decodeChunkTxInput`).

## Manifest (JSON in calldata)

Required: `mimeType`, `chunkHashes[]`  
Archive writes also set: `kind: "pulse-archive"`, `app`, `encoding`, `sha256`, sizes, optional title/tags/summary/note/cw/replaces.

`encoding`: `gzip` | `raw`  
`sha256` is of the **original** uncompressed body.

## Likes (v0.5)

JSON calldata → `…feed`:

```json
{ "kind": "pulse-archive-like", "manifest": "0x…64", "app": "pulse-archive", "appVersion": "0.5.0" }
```

Count unique `(manifest, from)`. Tip (PLS to author) stays separate.

## Client rules (this app)

- **Text only** writes (`text/plain;charset=utf-8` / json). No image/PDF/audio/video publish.
- **No NSFW / porn** in this client (CW flag removed; don’t post it).
- Reader shows text; other mime from the feed → “not text” notice (Raven may still have binaries).
- Refuse original body &gt; 150 KiB
- Do not republish if same `sha256` already in shelf/catalog
- **Local-first:** catalog + opened docs + likes in IndexedDB. Boot paints local (no RPC). **Sync** pulls `…feed` (incremental). Re-open uses local copy.
- **Lab seed** off by default (`?lab=1` / checkbox / `VITE_LAB_SEED=1`).
- **RPC hygiene:** free local gas est; no duplicate getTx/getBlock on open; balance stale 60s; explorer page gaps.
- Like = on-chain sign-off to `…feed` (wait receipt; cached locally)
- Tip = PLS **or any ERC-20** to author — beside Like in the reader
- `replaces` → earlier/newer version links in the reader
