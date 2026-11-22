/** Cold / empty / filtered paper — invite to write or clear filters. */
export function EmptyEdition({
  deskFace,
  onWrite,
  onSync,
  syncing,
  mode = "cold",
  onClearSearch,
}: {
  deskFace: boolean;
  onWrite: () => void;
  onSync: () => void;
  syncing: boolean;
  /** cold = no stories for the day · search = filters hid everything */
  mode?: "cold" | "search";
  onClearSearch?: () => void;
}) {
  const searching = mode === "search";
  return (
    <div
      className={`empty first-path${syncing ? " is-syncing" : ""}${searching ? " is-search-empty" : ""}`}
    >
      <p className="empty-title">
        {syncing
          ? "Looking for stories…"
          : searching
            ? "Nothing matches"
            : "This paper is blank"}
      </p>
      <p className="empty-dek">
        {syncing
          ? "Syncing from Pulse — Write anytime while you wait."
          : searching
            ? "Your filters hid every story on this day. Clear search or pick another day."
            : "Be first — publish a short story, then bid PLS for A1 if you want the lead."}
      </p>
      {deskFace && !searching ? (
        <p className="empty-dek status bad" style={{ marginTop: "0.5rem" }}>
          <strong>Desk · DEV ONLY</strong> — real app: Releases → Press ZIP →{" "}
          <code>START.cmd</code>
        </p>
      ) : null}
      <div className="empty-actions">
        {searching && onClearSearch ? (
          <button type="button" className="primary" onClick={onClearSearch}>
            Clear search
          </button>
        ) : (
          <button type="button" className="primary" onClick={onWrite}>
            Write
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={syncing}
          onClick={onSync}
        >
          {syncing ? "Syncing…" : "Sync"}
        </button>
        {searching ? (
          <button type="button" className="ghost" onClick={onWrite}>
            Write
          </button>
        ) : null}
      </div>
      <p className="empty-foot meta">
        Like ≠ tip ≠ A1 bid — each is a separate confirm in your wallet.
      </p>
    </div>
  );
}
