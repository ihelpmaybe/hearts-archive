# Theme packs (bring your own)

No custom theme engine. Packs are **CSS custom properties** in JSON — same pattern as the operator desk (`tts/kit.css` `[data-theme=…]`).

## In the app

**Make** (next to the theme picker) → live edit → **Save on device** · **Download JSON** · **Submit theme** (GitHub issue with the pack attached/pasted).

## Drop in (maintainers)

1. Copy `venus.json` → `your-id.json`
2. Edit `id`, `name`, `eyebrow`, `swatch`, `vars`
3. Add `"your-id"` to `index.json` → `packs`
4. Refresh the app (or MCP `theme_set`)

## Shape

```json
{
  "id": "my-theme",
  "name": "Display name",
  "tagline": "short",
  "eyebrow": "Brand line under title",
  "swatch": "#ff8a1e",
  "fonts": { "google": "FontName:wght@400;700" },
  "vars": {
    "--bg": "#120a07",
    "--panel": "#1c110c",
    "--text": "#fff6ec",
    "--accent": "#ff8a1f",
    "--gold": "#f0c75e"
  }
}
```

Required vars: `--bg` `--panel` `--line` `--text` `--muted` `--accent` `--gold` `--bad` `--ok` `--radius`

## Agent / MCP

Point Cursor at `mcp-themes/server.mjs` (stdio). Tools: `theme_list`, `theme_get`, `theme_set`, `theme_write`.
Or use any filesystem MCP on this folder.
