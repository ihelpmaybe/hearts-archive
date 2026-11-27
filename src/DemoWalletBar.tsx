import { useEffect, useMemo, useRef, useState } from "react";

const DEMO_KEY = "hearts-archive-demo-addr";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Stable fake address for Gallery costume — never a key, never signs. */
function demoAddress(): string {
  try {
    const existing = localStorage.getItem(DEMO_KEY);
    if (existing && /^0x[a-fA-F0-9]{40}$/.test(existing)) return existing;
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const hex =
      "0x" +
      [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(DEMO_KEY, hex);
    return hex;
  } catch {
    return "0xdemodemodemodemodemodemodemodemodemo00";
  }
}

const RELEASES =
  "https://github.com/ihelpmaybe/hearts-archive/releases/latest";

/** Gallery face only — read-only costume. Never labeled Trezor/hardware. */
export function DemoWalletBar() {
  const addr = useMemo(() => demoAddress(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="wallet-bar demo-wallet-bar" ref={rootRef}>
      <button
        type="button"
        className="wallet-chip"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        title="Peek only — cannot spend. Download Press ZIP to use a real wallet."
      >
        Peek · {shortAddr(addr)}
      </button>
      {open && (
        <div className="wallet-menu" role="menu">
          <p className="meta" style={{ margin: "0 0 0.5rem" }}>
            Showcase chip — not a wallet. Tip via QR here, or download Press /
            Studio ZIP → START.cmd to publish and spend on your machine.
          </p>
          <a
            href={RELEASES}
            target="_blank"
            rel="noreferrer"
            className="ghost link-btn"
            role="menuitem"
          >
            Download Press / Studio ZIP
          </a>
        </div>
      )}
    </div>
  );
}
