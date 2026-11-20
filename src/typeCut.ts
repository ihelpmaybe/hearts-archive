/** Image → plain-text cut for Heart’s Archive (newspaper width, on-chain text). */

export const TYPE_CUT_WIDTH_DEFAULT = 100;
export const TYPE_CUT_WIDTH_MIN = 40;
export const TYPE_CUT_WIDTH_MAX = 160;

export type TypeCutOpts = {
  /** Columns (characters). */
  width: number;
  /** Words that fill the dark ink. */
  phrase: string;
  /** Flip light/dark. */
  invert?: boolean;
  /**
   * 0–1: darker than this becomes ink (letter).
   * Higher = more filled / heavier cut.
   */
  threshold?: number;
};

function clampWidth(n: number): number {
  const w = Math.round(Number.isFinite(n) ? n : TYPE_CUT_WIDTH_DEFAULT);
  return Math.min(TYPE_CUT_WIDTH_MAX, Math.max(TYPE_CUT_WIDTH_MIN, w));
}

/** Sample average luminance 0 = black, 1 = white. */
function cellLuma(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let sum = 0;
  let n = 0;
  const xa = Math.max(0, Math.floor(x0));
  const ya = Math.max(0, Math.floor(y0));
  const xb = Math.min(imgW, Math.ceil(x1));
  const yb = Math.min(imgH, Math.ceil(y1));
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const i = (y * imgW + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      // Rec. 601
      sum += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      n++;
    }
  }
  return n ? sum / n : 1;
}

/**
 * Build a type cut from ImageData.
 * Dark regions = next letter of the phrase; light = space.
 * Output is plain UTF-8 text ready for Publish.
 */
export function imageDataToTypeCut(
  image: { data: Uint8ClampedArray; width: number; height: number },
  opts: TypeCutOpts,
): string {
  const cols = clampWidth(opts.width);
  const phrase = (opts.phrase.replace(/\s+/g, " ").trim() || "HEARTS ARCHIVE").toUpperCase();
  const threshold = opts.threshold ?? 0.55;
  const invert = !!opts.invert;
  // Monospace cells are taller than wide — squash rows so faces don’t stretch
  const rows = Math.max(
    8,
    Math.round((image.height / image.width) * cols * 0.48),
  );

  let pi = 0;
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      const x0 = (col / cols) * image.width;
      const x1 = ((col + 1) / cols) * image.width;
      const y0 = (row / rows) * image.height;
      const y1 = ((row + 1) / rows) * image.height;
      let luma = cellLuma(
        image.data,
        image.width,
        image.height,
        x0,
        y0,
        x1,
        y1,
      );
      if (invert) luma = 1 - luma;
      const ink = luma < threshold;
      if (ink) {
        line += phrase[pi % phrase.length]!;
        pi++;
      } else {
        line += " ";
      }
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  // Drop fully blank leading/trailing rows
  while (lines.length && !/\S/.test(lines[0]!)) lines.shift();
  while (lines.length && !/\S/.test(lines[lines.length - 1]!)) lines.pop();
  return lines.join("\n");
}

/** Load a browser File into ImageData via canvas (call from UI only). */
export async function fileToImageData(
  file: File,
  maxEdge = 640,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that picture"));
      el.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    const { data, width, height } = ctx.getImageData(0, 0, w, h);
    return { data, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
