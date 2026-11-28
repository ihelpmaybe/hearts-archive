import { useState } from "react";
import { FOOTER_DONATION } from "./data/wallets";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function DonateFoot() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FOOTER_DONATION.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer className="site-donate">
      <span className="site-donate-label">{FOOTER_DONATION.label}</span>
      <code className="site-donate-addr" title={FOOTER_DONATION.address}>
        {shortAddr(FOOTER_DONATION.address)}
      </code>
      <button type="button" className="site-donate-copy ghost" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </footer>
  );
}
