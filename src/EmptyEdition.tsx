/** Cold / empty paper — invite to write, not a protocol lecture. */
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
    <div className={`empty first-path${syncing ? " is-syncing" : ""}`}>
      <p className="empty-title">
        {syncing ? "Looking for stories…" : "This paper is blank"}
      </p>
      <p className="empty-dek">
        {syncing
          ? "Syncing from Pulse — Write anytime while you wait."
          : "Be first — publish a short story, then bid PLS for A1 if you want the lead."}
      </p>
      {deskFace ? (
        <p className="empty-dek status bad" style={{ marginTop: "0.5rem" }}>
          <strong>Desk · DEV ONLY</strong> — real app: Releases → Press ZIP →{" "}
          <code>START.cmd</code>
        </p>
      ) : null}
      <div className="empty-actions">
        <button type="button" className="primary" onClick={onWrite}>
          Write
        </button>
        <button
          type="button"
          className="ghost"
          disabled={syncing}
          onClick={onSync}
        >
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>
      <p className="empty-foot meta">
        Like ≠ tip ≠ A1 bid — each is a separate confirm in your wallet.
      </p>
    </div>
  );
}
