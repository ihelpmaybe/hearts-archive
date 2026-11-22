import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// GitHub Pages project site: https://<user>.github.io/hearts-archive/
const pagesBase = process.env.VITE_BASE || "/";
const isPages = pagesBase !== "/" && pagesBase !== "./";

const pressDesc =
  "Heart’s Archive — on-chain newspaper for PulseChain. Local Press for wallets; text stories and PLS A1 bids at 0x…feed.";
const pagesDesc =
  "Heart’s Archive — on-chain newspaper for PulseChain. Prefer local Press for wallets; this demo preview reloads from the host each visit.";

export default defineConfig({
  base: pagesBase,
  plugins: [
    react(),
    {
      name: "hearts-archive-meta",
      transformIndexHtml(html) {
        const desc = isPages ? pagesDesc : pressDesc;
        return html
          .replace(
            /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
            `<meta name="description" content="${desc}" />`,
          )
          .replace(
            /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
            `<meta property="og:description" content="${desc}" />`,
          )
          .replace(
            /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
            `<meta name="twitter:description" content="${desc}" />`,
          );
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/viem")) return "viem";
          if (
            id.includes("node_modules/wagmi") ||
            id.includes("node_modules/@wagmi")
          ) {
            return "wagmi";
          }
        },
      },
    },
  },
  server: {
    port: 5177,
    strictPort: true,
    proxy: {
      "/pulse-api": {
        target: "https://api.scan.pulsechain.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pulse-api/, "/api"),
      },
    },
  },
});
