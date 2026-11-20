/**
 * Thin MCP over public/themes/*.json — drop-in packs only.
 * Uses official @modelcontextprotocol/sdk (not a custom theme engine).
 *
 * Cursor mcp.json example:
 *   "hearts-archive-themes": {
 *     "command": "node",
 *     "args": ["…/demos/pulse-publish/mcp-themes/server.mjs"]
 *   }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES = join(__dirname, "..", "public", "themes");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listPackIds() {
  if (!existsSync(THEMES)) return [];
  return readdirSync(THEMES)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => f.replace(/\.json$/, ""));
}

function readIndex() {
  const p = join(THEMES, "index.json");
  if (!existsSync(p)) {
    return { schema: "hearts-archive-theme/v1", default: "venus", packs: listPackIds() };
  }
  return readJson(p);
}

function writeIndex(index) {
  mkdirSync(THEMES, { recursive: true });
  writeFileSync(join(THEMES, "index.json"), JSON.stringify(index, null, 2) + "\n");
}

const server = new McpServer({
  name: "hearts-archive-themes",
  version: "1.0.0",
});

server.tool("theme_list", "List drop-in theme packs in public/themes/", {}, async () => {
  const index = readIndex();
  const packs = listPackIds().map((id) => {
    try {
      const p = readJson(join(THEMES, `${id}.json`));
      return { id, name: p.name, swatch: p.swatch, tagline: p.tagline };
    } catch {
      return { id, error: "invalid json" };
    }
  });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ default: index.default, packs }, null, 2),
      },
    ],
  };
});

server.tool(
  "theme_get",
  "Read one theme pack JSON by id",
  { id: z.string() },
  async ({ id }) => {
    const path = join(THEMES, `${id}.json`);
    if (!existsSync(path)) {
      return { content: [{ type: "text", text: `missing: ${id}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: readFileSync(path, "utf8") }],
    };
  },
);

server.tool(
  "theme_set",
  "Set default theme id in index.json (app uses this + localStorage)",
  { id: z.string() },
  async ({ id }) => {
    const path = join(THEMES, `${id}.json`);
    if (!existsSync(path)) {
      return { content: [{ type: "text", text: `missing pack: ${id}` }], isError: true };
    }
    const index = readIndex();
    index.default = id;
    if (!index.packs.includes(id)) index.packs.push(id);
    writeIndex(index);
    return {
      content: [{ type: "text", text: `default → ${id}. Refresh the archive UI.` }],
    };
  },
);

server.tool(
  "theme_write",
  "Write/overwrite a theme pack JSON (bring your own). Pass full pack object.",
  {
    id: z.string(),
    pack: z.record(z.unknown()),
  },
  async ({ id, pack }) => {
    mkdirSync(THEMES, { recursive: true });
    const body = { ...pack, id };
    if (!body.vars || typeof body.vars !== "object") {
      return {
        content: [{ type: "text", text: "pack.vars (CSS custom properties) required" }],
        isError: true,
      };
    }
    writeFileSync(join(THEMES, `${id}.json`), JSON.stringify(body, null, 2) + "\n");
    const index = readIndex();
    if (!index.packs.includes(id)) {
      index.packs.push(id);
      writeIndex(index);
    }
    return {
      content: [
        {
          type: "text",
          text: `wrote public/themes/${id}.json — drop-in pack ready`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
