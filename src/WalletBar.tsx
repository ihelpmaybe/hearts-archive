import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { pulsechain } from "wagmi/chains";
import { formatEther } from "viem";
import { SCAN_ADDRESS } from "./protocol";
import { getPulseRpcUrls, setPulseRpcUrl } from "./wagmi";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function connectorLabel(name: string) {
  const n = name.toLowerCase();
  if (n.includes("metamask")) return "MetaMask";
  if (n.includes("rabby")) return "Rabby";
  if (n.includes("injected") || n === "browser") return "Browser";
  return name;
}

function isGenericInjected(name: string) {
  const l = connectorLabel(name).toLowerCase();
  return l === "browser" || l === "injected";
}

/** PulseChain is custom EVM — Phantom (and similar) don’t carry chain 369. */
function isPulseCapableWallet(name: string) {
  const n = name.toLowerCase();
  if (n.includes("phantom")) return false;
  if (n.includes("solana")) return false;
  return true;
}

type Props = {
  onUseAsAuthor?: (address: string) => void;
};

export function WalletBar({ onUseAsAuthor }: Props) {
  const { address, isConnected, chainId, status } = useAccount();
  const { connect, connectors, isPending, error: connectError, reset } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } =
    useSwitchChain();
  const { data: balance, isFetching: balLoading } = useBalance({
    address,
    chainId: pulsechain.id,
    query: {
      enabled: !!address,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [rpcOpen, setRpcOpen] = useState(false);
  const [rpcDraft, setRpcDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const wrongChain = isConnected && chainId !== pulsechain.id;
  const rpcUrls = getPulseRpcUrls();

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const pls =
    balance != null
      ? Number(formatEther(balance.value)).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })
      : null;

  const lowPls =
    isConnected &&
    !wrongChain &&
    pls != null &&
    Number(pls.replace(/,/g, "")) < 1;

  async function copyAddr() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
  }

  function saveRpc() {
    const url = rpcDraft.trim();
    if (url && !url.startsWith("http")) return;
    setPulseRpcUrl(url || null);
    window.location.reload();
  }

  const uniqueConnectors = useMemo(() => {
    const seen = new Set<string>();
    const usable = connectors.filter((c) => isPulseCapableWallet(c.name));
    const deduped = usable.filter((c) => {
      const key = connectorLabel(c.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const hasNamed = deduped.some((c) => !isGenericInjected(c.name));
    if (!hasNamed) return deduped;
    return deduped.filter((c) => !isGenericInjected(c.name));
  }, [connectors]);

  return (
    <div className="wallet-bar">
      <div className="wallet-bar-main">
        {isConnected && address ? (
          <div className="wallet-chip-wrap">
            <button
              type="button"
              className={
                wrongChain
                  ? "wallet-chip is-bad"
                  : lowPls
                    ? "wallet-chip is-warn"
                    : "wallet-chip"
              }
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title={address}
              onClick={() => {
                setRpcOpen(false);
                setMenuOpen((o) => !o);
              }}
            >
              <span className="wallet-chip-net">
                {wrongChain ? "Wrong net" : "Pulse"}
              </span>
              <span className="wallet-chip-addr">{shortAddr(address)}</span>
              <span className="wallet-chip-bal">
                {balLoading && !pls ? "…" : pls != null ? `${pls} PLS` : "—"}
              </span>
              {lowPls ? <span className="wallet-chip-flag">Low</span> : null}
              <span className="wallet-chip-caret" aria-hidden>
                ▾
              </span>
            </button>
            {menuOpen && (
              <div className="connect-menu wallet-overflow" role="menu">
                {wrongChain && (
                  <button
                    type="button"
                    className="primary"
                    disabled={switching}
                    onClick={() => switchChain({ chainId: pulsechain.id })}
                  >
                    {switching ? "…" : "Switch to Pulse"}
                  </button>
                )}
                <button type="button" onClick={() => void copyAddr()}>
                  {copied ? "Copied" : "Copy address"}
                </button>
                <a
                  className="ghost link-btn"
                  href={SCAN_ADDRESS(address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on scan
                </a>
                {onUseAsAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      onUseAsAuthor(address);
                      setMenuOpen(false);
                    }}
                  >
                    Find as author
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setRpcOpen(true);
                    setRpcDraft(rpcUrls[0] || "");
                  }}
                >
                  RPC…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    disconnect();
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="wallet-chip-wrap">
            <button
              type="button"
              className="primary"
              disabled={isPending || status === "connecting"}
              onClick={() => {
                setRpcOpen(false);
                setMenuOpen((o) => !o);
              }}
            >
              {isPending || status === "connecting" ? "…" : "Connect"}
            </button>
            {menuOpen && (
              <div className="connect-menu" role="menu">
                {uniqueConnectors.map((c) => (
                  <button
                    key={c.uid}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      reset();
                      connect(
                        { connector: c, chainId: pulsechain.id },
                        { onSuccess: () => setMenuOpen(false) },
                      );
                    }}
                  >
                    {connectorLabel(c.name)}
                  </button>
                ))}
                {uniqueConnectors.length === 0 && (
                  <p className="meta" style={{ margin: 0, padding: "0.25rem" }}>
                    No browser wallet found. Install MetaMask or Rabby, then
                    refresh.
                  </p>
                )}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setMenuOpen(false);
                    setRpcOpen(true);
                    setRpcDraft(rpcUrls[0] || "");
                  }}
                >
                  RPC…
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {(connectError || switchError) && (
        <p className="status bad">
          {(connectError || switchError)?.message?.split("\n")[0]}
        </p>
      )}

      {rpcOpen && (
        <div className="rpc-panel">
          <ul className="rpc-list">
            {rpcUrls.map((u) => (
              <li key={u}>
                <code>{u}</code>
              </li>
            ))}
          </ul>
          <div className="row">
            <input
              type="text"
              placeholder="https://…"
              value={rpcDraft}
              onChange={(e) => setRpcDraft(e.target.value)}
              spellCheck={false}
            />
            <button type="button" className="primary" onClick={saveRpc}>
              Save
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setPulseRpcUrl(null);
                window.location.reload();
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setRpcOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
