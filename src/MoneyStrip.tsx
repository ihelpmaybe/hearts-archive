import type { ReactNode } from "react";

/** Collapsed by default — actions first, legend one tap away. */
export function MoneyStripLegend() {
  return (
    <details className="money-strip-legend-details">
      <summary className="money-strip-legend-sum">How money moves</summary>
      <p className="money-strip-legend meta">
        <strong>Like</strong> / <strong>Buy A1</strong> burn PLS to{" "}
        <code>0x…feed</code> (you confirm each) · <strong>Tip</strong> ={" "}
        <code>transfer</code> to the author (check the address) · no token
        approvals.
      </p>
    </details>
  );
}

export function MoneyStrip({ children }: { children: ReactNode }) {
  return (
    <div className="money-strip">
      {children}
      <MoneyStripLegend />
    </div>
  );
}
