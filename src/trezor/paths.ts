/** BIP44 Ethereum account path — same shape as HEX Save stakePath default. */
export function ethAccountPath(index = 0): string {
  const i = Math.max(0, Math.floor(index));
  return `m/44'/60'/${i}'/0/0`;
}
