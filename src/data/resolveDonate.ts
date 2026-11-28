import { FOOTER_DONATION } from "./wallets";
import { DONATE_PUBKEY_SPKI_B64 } from "./donate-pubkey";

export const DONATE_JSON_URL = "https://ihelpmaybe.github.io/donate.json";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEEN_KEY = "ihmb-donate-updated";
const MAX_FUTURE_DAYS = 2;

export type DonateResolved = {
  label: string;
  address: string;
  source: "remote" | "fallback";
};

function b64ToU8(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function canonicalMsg(
  v: number,
  updated: string,
  address: string,
  label: string,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    `v${v}\n${updated}\n${address.toLowerCase()}\n${label}`,
  ) as Uint8Array<ArrayBuffer>;
}

function dateOk(updated: string): boolean {
  if (!DATE_RE.test(updated)) return false;
  const t = Date.parse(`${updated}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  if (t > Date.now() + MAX_FUTURE_DAYS * 86_400_000) return false;
  try {
    const prev = localStorage.getItem(SEEN_KEY);
    if (prev && updated < prev) return false;
  } catch {
    /* ignore */
  }
  return true;
}

function rememberUpdated(updated: string): void {
  try {
    const prev = localStorage.getItem(SEEN_KEY);
    if (!prev || updated > prev) localStorage.setItem(SEEN_KEY, updated);
  } catch {
    /* ignore */
  }
}

async function verifyDonateSig(
  v: number,
  updated: string,
  address: string,
  label: string,
  sigB64: string,
): Promise<boolean> {
  if (!globalThis.crypto?.subtle) return false;
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      b64ToU8(DONATE_PUBKEY_SPKI_B64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      b64ToU8(sigB64),
      canonicalMsg(v, updated, address, label),
    );
  } catch {
    return false;
  }
}

export async function resolveDonate(
  fallback: { label: string; address: string } = FOOTER_DONATION,
  timeoutMs = 2500,
): Promise<DonateResolved> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(DONATE_JSON_URL, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ...fallback, source: "fallback" };
    const data = (await res.json()) as {
      v?: number;
      updated?: string;
      sig?: string;
      pulse?: { label?: string; address?: string };
      label?: string;
      address?: string;
    };
    const v = Number(data.v ?? 0);
    const updated = String(data.updated ?? "");
    const sig = String(data.sig ?? "");
    const address = data.pulse?.address ?? data.address ?? "";
    const label = data.pulse?.label ?? data.label ?? fallback.label;
    if (v !== 1 || !sig || !ADDR_RE.test(address) || !dateOk(updated)) {
      return { ...fallback, source: "fallback" };
    }
    const ok = await verifyDonateSig(v, updated, address, label, sig);
    if (!ok) return { ...fallback, source: "fallback" };
    rememberUpdated(updated);
    return { label, address, source: "remote" };
  } catch {
    return { ...fallback, source: "fallback" };
  } finally {
    window.clearTimeout(timer);
  }
}
