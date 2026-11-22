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
  const paperFace = !!onOpenPost;
  return (
    <div className="incomplete-rail" role="status">
      <p className="incomplete-rail-copy meta">
        {paperFace ? (
          <>
            <strong>Publish paused</strong> — “{incomplete.title}” ({done}/
            {incomplete.partsCount}). Open Post to finish.
          </>
        ) : (
          <>
            <strong>Publish paused</strong> — “{incomplete.title}” is {done} of{" "}
            {incomplete.partsCount} chunks. Don’t change the text —{" "}
            <strong>Retry</strong> finishes, or Give up drops the attempt.
          </>
        )}
      </p>
      <div className="incomplete-rail-actions row wrap">
        {onOpenPost && (
          <button type="button" className="primary" onClick={onOpenPost}>
            Open Post
          </button>
        )}
        {!paperFace && (
          <button
            type="button"
            className="primary"
            disabled={publishing || !canRetry}
            onClick={onRetry}
          >
            {publishing ? "Finishing…" : "Retry"}
          </button>
        )}
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
        <p className="status bad incomplete-rail-warn">
          Text changed — hit <strong>Restore draft</strong>, then Retry.
        </p>
      )}
    </div>
  );
}
