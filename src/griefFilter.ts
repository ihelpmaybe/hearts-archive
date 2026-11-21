/**
 * Client-side Sync grief filter — ranking still uses real PLS bids;
 * dust / empty calldata junk is dropped so IndexedDB + face stay sane.
 */

/** Front bids below this are ignored (not A1 material). 0.001 PLS. */
export const MIN_FRONT_WEI = 10n ** 15n;

/** Like txs already require ≥1 PLS in protocol; keep a named alias. */
export const MIN_LIKE_SIGNAL_WEI = 10n ** 18n;

export function isDustFrontWei(valueWei: bigint): boolean {
  return valueWei < MIN_FRONT_WEI;
}
