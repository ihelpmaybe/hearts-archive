import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { parseEther } from "viem";
import { PULSE_CHAIN_ID } from "./protocol";
import { isAddressLike } from "./tipTokens";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** EIP-681 for native PLS on PulseChain. */
export function tipQrPayload(
  tipTo: string,
  amountPls?: string,
): string | null {
  if (!isAddressLike(tipTo)) return null;
  const addr = tipTo.trim().toLowerCase();
  let valueWei: bigint | null = null;
  if (amountPls?.trim()) {
    try {
      const v = parseEther(amountPls.trim());
      if (v > 0n) valueWei = v;
    } catch {
      /* address-only */
    }
  }
  if (valueWei != null) {
    return `ethereum:${addr}@${PULSE_CHAIN_ID}?value=${valueWei.toString()}`;
  }
  return `ethereum:${addr}@${PULSE_CHAIN_ID}`;
}

type Props = {
  tipTo: string;
  /** PLS amount string — included in QR when parseable */
  amountPls?: string;
  label?: string;
};

export function TipQr({ tipTo, amountPls, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const payload = tipQrPayload(tipTo, amountPls);

  useEffect(() => {
    if (!payload || !canvasRef.current) return;
    setErr(null);
    void QRCode.toCanvas(canvasRef.current, payload, {
      width: 128,
      margin: 1,
      color: { dark: "#1a100c", light: "#fffaf3" },
    }).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [payload]);

  if (!payload) return null;

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(tipTo.trim().toLowerCase());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setErr("Copy failed");
    }
  }

  return (
    <div className="tip-qr">
      <canvas
        ref={canvasRef}
        className="tip-qr-canvas"
        width={128}
        height={128}
        aria-label={`Tip QR for ${shortAddr(tipTo)}`}
      />
      <div className="tip-qr-meta">
        <p className="meta">
          {label || "Scan to tip"} · {shortAddr(tipTo)}
        </p>
        <button type="button" className="ghost" onClick={() => void copyAddr()}>
          {copied ? "Copied" : "Copy address"}
        </button>
        <details className="more tip-qr-details">
          <summary>About tip QR</summary>
          <p className="meta">
            Encodes EIP-681 PLS on Pulse (chain 369). Verify the recipient on
            your device before sending.
          </p>
        </details>
        {err && <p className="status bad">{err}</p>}
      </div>
    </div>
  );
}
