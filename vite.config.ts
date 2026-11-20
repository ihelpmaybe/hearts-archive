import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
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
