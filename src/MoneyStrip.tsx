import type { ReactNode } from "react";

/** One short legend so Like / Tip / A1 stay distinct. */
export function MoneyStripLegend() {
  return (
    <p className="money-strip-legend meta">
      <strong>Like</strong> = ≥1 PLS once per wallet · <strong>Tip</strong> =
      send the writer any Pulse asset · <strong>Buy A1</strong> = PLS bid for
      the lead (not gas). Three different moves.
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
