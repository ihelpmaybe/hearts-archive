/** injected from wagmi core — not wagmi/connectors (avoids WC/Coinbase/Porto). */
import { http, createConfig, fallback, injected } from "wagmi";
import { pulsechain } from "wagmi/chains";

const DEFAULT_RPCS = [
  "https://rpc.pulsechain.com",
  "https://pulsechain-rpc.publicnode.com",
] as const;

function pulseRpcList(): string[] {
  const custom = import.meta.env.VITE_PULSE_RPC as string | undefined;
  const saved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("pulse-archive-rpc") || undefined
      : undefined;
  const list = [saved, custom, ...DEFAULT_RPCS].filter(
    (u): u is string => !!u && u.startsWith("http"),
  );
  return [...new Set(list)];
}

export function getPulseRpcUrls(): string[] {
  return pulseRpcList();
}

export function setPulseRpcUrl(url: string | null) {
  if (typeof localStorage === "undefined") return;
  if (!url) localStorage.removeItem("pulse-archive-rpc");
  else localStorage.setItem("pulse-archive-rpc", url);
}

const urls = pulseRpcList();

export const config = createConfig({
  chains: [pulsechain],
  connectors: [
    injected({
      target: "metaMask",
      shimDisconnect: true,
    }),
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [pulsechain.id]: fallback(
      urls.map((url) =>
        http(url, {
          batch: true,
          retryCount: 3,
          timeout: 20_000,
        }),
      ),
    ),
  },
  multiInjectedProviderDiscovery: true,
  ssr: false,
});

export const PULSE_RPC = urls[0] ?? DEFAULT_RPCS[0];
