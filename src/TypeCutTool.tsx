import { useEffect, useState } from "react";
import {
  TYPE_CUT_WIDTH_DEFAULT,
  TYPE_CUT_WIDTH_MAX,
  TYPE_CUT_WIDTH_MIN,
  fileToImageData,
  imageDataToTypeCut,
} from "./typeCut";

type Props = {
  phraseDefault: string;
  onUse: (text: string) => void;
};

export function TypeCutTool({ phraseDefault, onUse }: Props) {
  const [phrase, setPhrase] = useState(phraseDefault || "HEARTS ARCHIVE");
  const [width, setWidth] = useState(TYPE_CUT_WIDTH_DEFAULT);
  const [invert, setInvert] = useState(false);
  const [threshold, setThreshold] = useState(0.55);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (phraseDefault.trim()) setPhrase(phraseDefault.trim());
  }, [phraseDefault]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const img = await fileToImageData(file);
      const text = imageDataToTypeCut(img, {
        width,
        phrase,
        invert,
        threshold,
      });
      if (!text.trim()) {
        setErr("Nothing drew — try Invert or more Ink.");
        setPreview("");
        return;
      }
      setPreview(text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPreview("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="type-cut-tool post-side-card">
      <p className="side-label">Type cut</p>
      <p className="meta">
        Picture stays local. Output is text for Publish (
        {TYPE_CUT_WIDTH_MIN}–{TYPE_CUT_WIDTH_MAX} wide).
      </p>
      <div className="type-cut-controls">
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Words that fill the ink"
          aria-label="Phrase"
        />
        <label className="type-cut-width">
          Width
          <input
            type="number"
            min={TYPE_CUT_WIDTH_MIN}
            max={TYPE_CUT_WIDTH_MAX}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => setInvert(e.target.checked)}
          />
          Invert
        </label>
        <label className="type-cut-width">
          Ink
          <input
            type="range"
            min={0.25}
            max={0.85}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="Ink threshold"
          />
        </label>
        <label className="ghost file-btn">
          {busy ? "…" : "Pick picture"}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void onFile(f);
            }}
          />
        </label>
      </div>
      {err && <p className="status bad">{err}</p>}
      {preview && (
        <>
          <pre className="type-cut-preview">{preview}</pre>
          <button
            type="button"
            className="primary"
            onClick={() => onUse(preview)}
          >
            Use as body
          </button>
        </>
      )}
    </div>
  );
}
