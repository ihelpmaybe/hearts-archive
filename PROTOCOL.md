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

## Client rules (this app)

- Skip gzip for image/video/audio/pdf/zip
- Refuse original body &gt; 150 KiB
- Do not republish if same `sha256` already in shelf/catalog
- Browse via explorer paging + local IndexedDB catalog
