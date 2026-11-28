import { useEffect, useState } from "react";
import { FOOTER_DONATION } from "./data/wallets";
import { resolveDonate } from "./data/resolveDonate";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function DonateFoot() {
  const [copied, setCopied] = useState(false);
  const [donate, setDonate] = useState({
    label: FOOTER_DONATION.label,
    address: FOOTER_DONATION.address,
  });

  useEffect(() => {
    let cancelled = false;
    void resolveDonate(FOOTER_DONATION).then((next) => {
      if (!cancelled) setDonate({ label: next.label, address: next.address });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(donate.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer className="site-donate">
      <span className="site-donate-label">{donate.label}</span>
      <code className="site-donate-addr" title={donate.address}>
        {shortAddr(donate.address)}
      </code>
      <button type="button" className="site-donate-copy ghost" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </footer>
  );
}
