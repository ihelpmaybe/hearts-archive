/** Tip assets on PulseChain — native PLS or any ERC-20. */

export type TipToken = {
  id: string;
  symbol: string;
  /** null = native PLS */
  address: `0x${string}` | null;
  decimals: number;
};

/**
 * PulseChain tip presets — verified 2026-11-20 via RPC + DexScreener.
 * HEX = pHEX state-fork (not Ethereum HEX 0x2b59…f83e…).
 * eHEX = bridged from Ethereum (distinct asset).
 */
export const TIP_PRESETS: TipToken[] = [
  { id: "PLS", symbol: "PLS", address: null, decimals: 18 },
  {
    id: "HEX",
    symbol: "HEX",
    address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
    decimals: 8,
  },
  {
    id: "PLSX",
    symbol: "PLSX",
    address: "0x95B303987A60C71504D99Aa1b13B4da07b0790ab",
    decimals: 18,
  },
  {
    id: "INC",
    symbol: "INC",
    address: "0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d",
    decimals: 18,
  },
  {
    id: "eHEX",
    symbol: "eHEX",
    address: "0x57fde0a71132198BBeC939B98976993d8D89D225",
    decimals: 8,
  },
];

export const CUSTOM_TIP_ID = "custom";

const RECENT_KEY = "hearts-archive-tip-recent";
const MAX_RECENT = 3;

export function isAddressLike(s: string): s is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export function loadRecentTipTokens(): `0x${string}`[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is `0x${string}` => isAddressLike(a))
      .map((a) => a.toLowerCase() as `0x${string}`)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberTipToken(addr: `0x${string}`): `0x${string}`[] {
  const next = [
    addr.toLowerCase() as `0x${string}`,
    ...loadRecentTipTokens().filter(
      (a) => a.toLowerCase() !== addr.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* */
  }
  return next;
}
