import { useEffect, useMemo, useRef } from "react";
import { normalizeTypeCut, typeCutColumns } from "./typeCut";

/** Fit true monospace cut to the column — never wrap, never body font. */
export function TypeCutPicture({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const normalized = useMemo(() => normalizeTypeCut(text), [text]);

  useEffect(() => {
    const frame = frameRef.current;
    const pre = preRef.current;
    if (!frame || !pre || !normalized.trim()) return;

    const cols = typeCutColumns(normalized);
    const fit = () => {
      const w = frame.clientWidth;
      if (w < 32 || cols < 1) return;
      // Courier (etc.) is ~0.6em wide — don't assume 1ch === 1em or the cut
      // sits in a puddle of empty padding. Measure real advance, then fill width.
      pre.style.lineHeight = "1";
      pre.style.letterSpacing = "0px";
      pre.style.fontKerning = "none";
      pre.style.fontSize = "100px";
      const at100 = pre.scrollWidth || 1;
      const px = Math.max(3.5, (w * 0.995 * 100) / at100);
      pre.style.fontSize = `${px}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [normalized]);

  if (!normalized.trim()) return null;

  return (
    <div ref={frameRef} className={`type-cut-frame ${className || ""}`.trim()}>
      <pre ref={preRef} className="type-cut-pre">
        {normalized}
      </pre>
    </div>
  );
}
