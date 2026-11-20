/** Soft face mute — blunt keyword screen, not a porn classifier. */

const HITS =
  /\b(porn|porno|xxx|nsfw|onlyfans|hentai|nude|nudes|naked|blowjob|handjob|cumshot|creampie|deepthroat|anal\b|pussy|cock\b|dick\b|boob|tits|titty|orgasm|masturbat|fetish|bdsm|camgirl|sex\s*tape|explicit\s*sex)\b/i;

export function softMuteHit(...parts: (string | undefined | null)[]): boolean {
  return parts.some((p) => !!p && HITS.test(p));
}
