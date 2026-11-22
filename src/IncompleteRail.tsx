import {
  incompleteDoneCount,
  type IncompletePublish,
} from "./incomplete";

export function IncompleteRail({
  incomplete,
  publishing,
  canRetry,
  shaMismatch,
  onRetry,
  onGiveUp,
  onOpenPost,
  onRestoreDraft,
}: {
  incomplete: IncompletePublish;
  publishing: boolean;
  canRetry: boolean;
  shaMismatch: boolean;
  onRetry: () => void;
  onGiveUp: () => void;
  /** When shown on the library face — jump to Post. */
  onOpenPost?: () => void;
  /** Put stuck draft text back into the compose fields. */
  onRestoreDraft?: () => void;
}) {
  const done = incompleteDoneCount(incomplete);
  return (
    <div className="incomplete-rail" role="status">
      <p className="meta" style={{ margin: 0 }}>
        <strong>Publish paused</strong> — “{incomplete.title}” is {done} of{" "}
        {incomplete.partsCount} chunks on-chain. Don’t change the text —{" "}
        <strong>Retry</strong> finishes the manifest, or Give up drops the
        attempt (orphan chunks may already exist at 0x0).
      </p>
      <div className="row wrap" style={{ margin: 0 }}>
        {onOpenPost && (
          <button type="button" className="ghost" onClick={onOpenPost}>
            Open Post
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={publishing || !canRetry}
          onClick={onRetry}
        >
          {publishing ? "Finishing…" : "Retry"}
        </button>
        {shaMismatch && onRestoreDraft && (
          <button
            type="button"
            className="ghost"
            disabled={publishing}
            onClick={onRestoreDraft}
          >
            Restore draft
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={publishing}
          onClick={onGiveUp}
        >
          Give up
        </button>
      </div>
      {shaMismatch && (
        <p className="status bad" style={{ margin: "0.35rem 0 0" }}>
          Text changed — hit <strong>Restore draft</strong> (or paste the
          original), then Retry.
        </p>
      )}
    </div>
  );
}
