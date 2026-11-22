import { useEffect, useRef, useState } from "react";
import {
  connectTrezorFromGesture,
  warmTrezorConnect,
  humanTrezorError,
} from "./trezor/connect";
import { setTrezorSignIndex } from "./trezor/signPulseTx";
import { SCAN_ADDRESS } from "./protocol";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type Props = {
  address: string | null;
  onConnected: (opts: {
    address: string;
    derivationIndex: number;
    deviceId: string;
  }) => void;
  onDisconnect: () => void;
};

/** Studio face — real Trezor Connect + Bridge only. */
export function TrezorBar({ address, onConnected, onDisconnect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    void warmTrezorConnect()
      .then(() => setWarm(true))
      .catch((e) =>
        setErr(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onPointer(e: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  function connectClick() {
    setErr(null);
    setBusy(true);
    // NO await before gesture — popup must open in this turn.
    const pending = connectTrezorFromGesture();
    void pending
      .then((r) => {
        setTrezorSignIndex(r.derivationIndex);
        onConnected({
          address: r.address0,
          derivationIndex: r.derivationIndex,
          deviceId: r.deviceId,
        });
        setMenuOpen(false);
      })
      .catch((e) => {
        setErr(
          humanTrezorError(e instanceof Error ? e.message : String(e)),
        );
      })
      .finally(() => setBusy(false));
  }

  if (!address) {
    return (
      <div className="wallet-bar trezor-bar" ref={rootRef}>
        <button
          type="button"
          className="wallet-chip primary"
          disabled={busy || !warm}
          onClick={connectClick}
          title="Needs Trezor Suite / Bridge on this PC"
        >
          {busy ? "…" : warm ? "Connect Trezor" : "Starting…"}
        </button>
        {err && (
          <span className="meta status bad" style={{ marginLeft: "0.35rem" }}>
            {err}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-bar trezor-bar" ref={rootRef}>
      <button
        type="button"
        className="wallet-chip"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        title="Trezor · Studio"
      >
        Trezor · {shortAddr(address)}
      </button>
      {menuOpen && (
        <div className="wallet-menu" role="menu">
          <a
            href={SCAN_ADDRESS(address)}
            target="_blank"
            rel="noreferrer"
            className="ghost link-btn"
            role="menuitem"
          >
            Explorer
          </a>
          <button
            type="button"
            className="ghost"
            role="menuitem"
            disabled={busy}
            onClick={connectClick}
          >
            Switch account
          </button>
          <button
            type="button"
            className="ghost"
            role="menuitem"
            onClick={() => {
              onDisconnect();
              setMenuOpen(false);
            }}
          >
            Disconnect
          </button>
          <p className="meta" style={{ margin: "0.5rem 0 0" }}>
            Need Suite / Bridge on :21325
          </p>
          {err && <p className="status bad">{err}</p>}
        </div>
      )}
    </div>
  );
}
