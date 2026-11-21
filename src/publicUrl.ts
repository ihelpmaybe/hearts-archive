/** Root-relative public asset — respects Vite `base` (GitHub Pages `/hearts-archive/`). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}${path.replace(/^\//, "")}`;
}
