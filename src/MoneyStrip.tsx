import type { ReactNode } from "react";

/** One short legend so Like / Tip / A1 stay distinct. */
export function MoneyStripLegend() {
  return (
    <p className="money-strip-legend meta">
      <strong>Like</strong> / <strong>Buy A1</strong> burn PLS to{" "}
      <code>0x…feed</code> (you confirm each) · <strong>Tip</strong> ={" "}
      <code>transfer</code> to the author (check the address) · no token
      approvals.
    </p>
  );
}

export function MoneyStrip({ children }: { children: ReactNode }) {
  return (
    <div className="money-strip">
      <MoneyStripLegend />
      {children}
    </div>
  );
}
