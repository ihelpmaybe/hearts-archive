import { isGalleryFace } from "./archiveFace";

const RELEASES =
  "https://github.com/ihelpmaybe/hearts-archive/releases/latest";

/**
 * Pages / Gallery peek — same posture as HEXmob showcase:
 * look here; spend only from Press/Studio ZIP on your machine.
 */
export function ShowcaseBanner() {
  if (!isGalleryFace()) return null;

  return (
    <div className="showcase-banner" role="status">
      <strong>Showcase peek</strong>
      {" — "}
      read + tip QR here. Do not treat GitHub Pages as a wallet front end.
      {" "}
      <a href={RELEASES} target="_blank" rel="noreferrer">
        Download Press / Studio ZIP
      </a>
      {" → "}
      <code>START.cmd</code> / <code>START.sh</code> on your PC to publish, like, or bid.
    </div>
  );
}
