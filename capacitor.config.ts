import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shells wrap the Gallery (read-only) Vite build.
 * Scaffold on Windows OK; signed iOS IPA still needs Mac + Xcode.
 */
const config: CapacitorConfig = {
  appId: "archive.hearts.gallery",
  appName: "Heart’s Archive",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#100805",
    },
  },
};

export default config;
