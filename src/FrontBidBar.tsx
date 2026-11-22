import { formatPls } from "./frontPage";
import type { FrontBidEntry } from "./archive";

/** Shared A1 bid chrome — Desk and Press use the same rules. */
export function FrontBidBar({
  bidForDay,
  frontAmount,
  fronting,
  walletUiOff,
  wrongChain,
  canSend,
  frontWinner,
  docManifest,
  minOpenDay,
  maxOpenDay,
  onDay,
  onAmount,
  onBuy,
}: {
  bidForDay: string;
  frontAmount: string;
  fronting: boolean;
  walletUiOff: boolean;
  wrongChain: boolean;
  canSend: boolean;
  frontWinner: FrontBidEntry | null;
  docManifest: string;
  minOpenDay: string;
  maxOpenDay: string;
  onDay: (d: string) => void;
  onAmount: (v: string) => void;
  onBuy: () => void;
}) {
  const leading =
    frontWinner &&
    frontWinner.manifest.toLowerCase() === docManifest.toLowerCase();
  const floorWei = minA1Wei(frontWinner);
  const floor = formatPls(floorWei);
  const status = leading
    ? `You’re A1 · ${formatPls(frontWinner!.valueWei)} PLS`
    : frontWinner
      ? `Lead ${formatPls(frontWinner.valueWei)} PLS — bid more to take A1`
      : `A1 open · bid PLS`;

  return (
    <div className="front-bid-bar">
      <span className="front-bid-label">{status}</span>
      <input
        type="date"
        value={bidForDay}
        min={minOpenDay}
        max={maxOpenDay}
        onChange={(e) => onDay(e.target.value)}
        aria-label="Open edition day for A1"
      />
      <input
        type="text"
        value={frontAmount}
        onChange={(e) => onAmount(e.target.value)}
        aria-label="Front page PLS bid"
        placeholder={`≥ ${floor}`}
      />
      <button
        type="button"
        className="primary"
        disabled={fronting || (!walletUiOff && !canSend)}
        onClick={onBuy}
        title="Highest PLS for this day owns A1; top 3 = A1–A3. Before UTC midnight."
      >
        {fronting ? "…" : walletUiOff ? "Buy A1 (desk)" : "Buy A1"}
      </button>
      {wrongChain && !walletUiOff && (
        <span className="status bad">Wrong network — Switch to Pulse</span>
      )}
      <details className="front-bid-help">
        <summary>A1 rules</summary>
        <p className="meta">
          Highest PLS for the open day owns A1; top 3 = A1–A3. Rebid anytime
          before UTC midnight (+1 wei can snipe). Tip ≠ like ≠ bid.
        </p>
      </details>
    </div>
  );
}

/** Same floor Press and Desk enforce before send. */
export function minA1Wei(frontWinner: FrontBidEntry | null | undefined): bigint {
  return frontWinner ? frontWinner.valueWei + 1n : 1n;
}
