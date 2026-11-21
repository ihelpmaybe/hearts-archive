/**
 * One on-chain text blob, two faces: optional type-cut picture + prose body.
 * Legacy posts (no markers) = all body.
 */

import { normalizeTypeCut } from "./typeCut";

export const PICTURE_MARK = "<<<HEARTS-PICTURE>>>";
export const BODY_MARK = "<<<HEARTS-BODY>>>";

export type ArticleParts = {
  picture: string;
  body: string;
};

export function packArticle(picture: string, body: string): string {
  const pic = normalizeTypeCut(picture);
  const bod = body.replace(/\s+$/g, "");
  if (!pic.trim()) return bod.length ? bod : " ";
  return `${PICTURE_MARK}\n${pic}\n${BODY_MARK}\n${bod}`;
}

export function unpackArticle(raw: string): ArticleParts {
  const text = raw ?? "";
  const start = text.indexOf(PICTURE_MARK);
  const mid = text.indexOf(BODY_MARK);
  if (start === 0 && mid > start) {
    const picture = normalizeTypeCut(
      text.slice(start + PICTURE_MARK.length, mid).replace(/^\n/, ""),
    );
    const body = text.slice(mid + BODY_MARK.length).replace(/^\n/, "");
    return { picture, body };
  }
  return { picture: "", body: text };
}

export function hasPicture(raw: string): boolean {
  return unpackArticle(raw).picture.trim().length > 0;
}
