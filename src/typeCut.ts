/** Type-cut picture helpers — paste ASCII in; fit monospace on the page. */

export function typeCutColumns(picture: string): number {
  const line = picture.split(/\r?\n/).find((l) => l.length > 0) || "";
  return Math.max(1, line.length);
}

/** Pad/truncate every line to one width so cuts stay aligned. */
export function normalizeTypeCut(picture: string): string {
  const lines = picture
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  while (lines.length && lines[0] === "") lines.shift();
  if (!lines.length) return "";

  const counts = new Map<number, number>();
  for (const l of lines) {
    const n = l.length;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  let cols = lines[0]!.length;
  let best = 0;
  for (const [n, c] of counts) {
    if (c > best || (c === best && n > cols)) {
      best = c;
      cols = n;
    }
  }
  cols = Math.max(1, cols);

  return lines
    .map((l) => {
      if (l.length === cols) return l;
      if (l.length > cols) return l.slice(0, cols);
      return l + " ".repeat(cols - l.length);
    })
    .join("\n");
}
