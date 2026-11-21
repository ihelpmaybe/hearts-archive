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
}: {
  incomplete: IncompletePublish;
  publishing: boolean;
  canRetry: boolean;
  shaMismatch: boolean;
  onRetry: () => void;
  onGiveUp: () => void;
  /** When shown on the library face — jump to Post. */
  onOpenPost?: () => void;
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
          Text changed — use Restore draft (or paste the original) so the sha
          matches, then Retry.
        </p>
      )}
    </div>
  );
}
