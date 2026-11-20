/** Curated classic plates for the broadsheet face (never author media). */

export type Plate = {
  id: string;
  src: string;
  credit: string;
};

export const PLATES: Plate[] = [
  {
    id: "press",
    src: "/plates/press.jpg",
    credit: "Library of Congress — public domain",
  },
  {
    id: "street",
    src: "/plates/street.jpg",
    credit: "Library of Congress — public domain",
  },
  {
    id: "crowd",
    src: "/plates/crowd.jpg",
    credit: "Library of Congress — public domain",
  },
];

function hashNibble(hash: string): number {
  const h = (hash || "").replace(/^0x/i, "").toLowerCase();
  let n = 0;
  for (let i = 0; i < Math.min(8, h.length); i++) {
    n = (n * 16 + parseInt(h[i] || "0", 16)) >>> 0;
  }
  return n;
}

export function plateFor(hash: string, salt = 0): Plate {
  const i = (hashNibble(hash) + salt) % PLATES.length;
  return PLATES[i]!;
}
