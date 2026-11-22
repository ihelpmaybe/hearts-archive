import { useEffect, useState, type ReactNode } from "react";
import { unpackArticle } from "./articleFormat";
import { softMuteHit } from "./softMute";
import { TypeCutPicture } from "./TypeCutPicture";

export const PREVIEW_FROM = "0xpreview00000000000000000000000000000001";
/** Valid hex so tip QR / address checks work on lab docs — not a funded key. */
export const LAB_FROM = "0x1000000000000000000000000000000000000001";

export function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function isLocalPreviewDoc(from?: string) {
  return (from || "").toLowerCase() === PREVIEW_FROM;
}

export function isLabTestDoc(from?: string) {
  return (from || "").toLowerCase() === LAB_FROM;
}

export function formatPostedAt(unixSec?: number): string {
  if (!unixSec || unixSec <= 0) return "";
  const d = new Date(unixSec * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SoftHeld({
  hit,
  children,
  label = "Held from the face — open anyway",
}: {
  hit: boolean;
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!hit || open) return <>{children}</>;
  return (
    <div className="soft-held">
      <p className="soft-held-note">
        Soft mute — wording looked too graphic for the paper face.
      </p>
      <button type="button" className="ghost" onClick={() => setOpen(true)}>
        {label}
      </button>
    </div>
  );
}

export type PreviewDoc = {
  mimeType: string;
  objectUrl: string;
  title?: string;
};

export function Preview({ doc }: { doc: PreviewDoc }) {
  const { mimeType, objectUrl } = doc;
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml")
  ) {
    return <TextPreview url={objectUrl} title={doc.title} />;
  }
  return (
    <p className="meta">
      Not text ({mimeType || "unknown"}). This app is text-only — open the Tx
      link if you need the raw payload.
    </p>
  );
}

export function TextPreview({ url, title }: { url: string; title?: string }) {
  const [text, setText] = useState("Loading…");
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((e) => {
        if (!cancelled) setText(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  const loading = text === "Loading…";
  const parts = loading ? { picture: "", body: text } : unpackArticle(text);
  const hit = softMuteHit(title, parts.picture, parts.body);
  return (
    <SoftHeld hit={hit} label="Read anyway">
      <div className="article-stack">
        {parts.picture.trim() ? (
          <TypeCutPicture text={parts.picture} className="article-picture" />
        ) : null}
        {parts.body.trim() || !parts.picture.trim() ? (
          <pre className="article-body">
            {parts.body || (loading ? text : "")}
          </pre>
        ) : null}
      </div>
    </SoftHeld>
  );
}
