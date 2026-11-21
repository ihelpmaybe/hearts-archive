/** Cold / empty paper — first path without looking dead. */
export function EmptyEdition({
  deskFace,
  onWrite,
  onSync,
  syncing,
}: {
  deskFace: boolean;
  onWrite: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="empty first-path">
      <p className="empty-title">Open paper — no ink yet</p>
      <p className="empty-dek">
        This edition is empty until someone publishes text and a wallet bids PLS
        for A1. Like ≠ tip ≠ front bid.
      </p>
      {deskFace ? (
        <p className="empty-dek status bad" style={{ marginTop: "0.5rem" }}>
          You’re on <strong>Desk · DEV ONLY</strong> (local sandbox). Real app:
          Releases → <code>hearts-archive-press.zip</code> →{" "}
          <code>START.cmd</code> (no Node).
        </p>
      ) : null}
      <ol className="empty-steps">
        <li>
          {deskFace
            ? "Desk is for developers — switch to Press for wallets"
            : "Connect on Pulse"}
        </li>
        <li>
          <button type="button" className="linkish" onClick={onWrite}>
            Write · Publish
          </button>{" "}
          UTF-8 text only
        </li>
        <li>
          <button
            type="button"
            className="linkish"
            disabled={syncing}
            onClick={onSync}
          >
            {syncing ? "Syncing…" : "Sync the feed"}
          </button>{" "}
          — pulls …feed into this device
        </li>
        <li>
          Open a story · <strong>Buy A1</strong> with more PLS than the current
          lead (loser drops to A2/A3/B). Tip the writer anything; like burns ≥1
          PLS once per wallet.
        </li>
      </ol>
      <p className="empty-foot meta">
        Rebid anytime before that edition’s UTC midnight. Each bid is a new tx —
        not a top-up.
      </p>
    </div>
  );
}
