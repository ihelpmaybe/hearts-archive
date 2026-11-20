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
  if (n.includes("injected")) return "Browser";
  return name;
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
    return connectors.filter((c) => {
      const key = c.id || c.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [connectors]);

  return (
    <div className="wallet-bar">
      <div className="wallet-bar-main">
        {isConnected && address ? (
          <>
            <span
              className={wrongChain ? "net-pill bad" : "net-pill ok"}
              title={wrongChain ? `Chain ${chainId}` : "PulseChain"}
            >
              {wrongChain ? "Wrong net" : "Pulse"}
            </span>
            <span className="addr" title={address}>
              {shortAddr(address)}
            </span>
            <span className="bal-pill">
              {balLoading && !pls ? "…" : pls != null ? `${pls} PLS` : "—"}
            </span>
            {wrongChain && (
              <button
                type="button"
                className="primary"
                disabled={switching}
                onClick={() => switchChain({ chainId: pulsechain.id })}
                title="Wallet is on the wrong chain"
              >
                {switching ? "…" : "Switch to Pulse"}
              </button>
            )}
            {isConnected &&
              !wrongChain &&
              pls != null &&
              Number(pls.replace(/,/g, "")) < 1 && (
                <span className="net-pill bad" title="Low PLS for gas">
                  Low PLS
                </span>
              )}
            <button type="button" className="ghost" onClick={() => void copyAddr()}>
              {copied ? "OK" : "Copy"}
            </button>
            <a
              className="ghost link-btn"
              href={SCAN_ADDRESS(address)}
              target="_blank"
              rel="noreferrer"
            >
              Scan
            </a>
            {onUseAsAuthor && (
              <button
                type="button"
                className="ghost"
                onClick={() => onUseAsAuthor(address)}
              >
                Find
              </button>
            )}
            <button type="button" className="ghost" onClick={() => disconnect()}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="primary"
              disabled={isPending || status === "connecting"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {isPending || status === "connecting" ? "…" : "Connect"}
            </button>
            {menuOpen && (
              <div className="connect-menu">
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
                  <p className="meta">No wallet</p>
                )}
              </div>
            )}
          </>
        )}
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setRpcOpen((o) => !o);
            setRpcDraft(rpcUrls[0] || "");
          }}
        >
          RPC
        </button>
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
          </div>
        </div>
      )}
    </div>
  );
}
