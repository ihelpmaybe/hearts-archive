import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
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
