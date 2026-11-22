/**
 * Real @trezor/connect-web → Bridge. Seed never enters this app.
 * First UI call must stay in the same turn as the user click (no await before it).
 */
import TrezorConnect from "@trezor/connect-web";
import { ethAccountPath } from "./paths";

let initDone = false;
let initPromise: Promise<void> | null = null;

export function isTrezorInited(): boolean {
  return initDone;
}

export async function ensureTrezorInit(): Promise<void> {
  if (initDone) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await TrezorConnect.init({
        manifest: {
          appName: "Heart’s Archive Studio",
          appUrl:
            typeof window !== "undefined"
              ? window.location.origin
              : "http://127.0.0.1:5173",
          email: "hearts-archive-studio@localhost",
        },
        lazyLoad: false,
        coreMode: "iframe",
        connectSrc: "https://connect.trezor.io/9/",
        transports: ["BridgeTransport"],
      });
      initDone = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already\s*initialized/i.test(msg)) {
        initDone = true;
        return;
      }
      initPromise = null;
      throw e;
    }
  })();
  return initPromise;
}

/** Call on Studio mount so init is warm before the Connect click. */
export async function warmTrezorConnect(): Promise<void> {
  await ensureTrezorInit();
}

const ACCOUNT_BUNDLE = 8;

/**
 * Must be invoked directly from a click handler (no await before getAddress).
 */
export function connectTrezorFromGesture(matchAddress?: string): Promise<{
  address0: string;
  derivationIndex: number;
  deviceId: string;
}> {
  if (!initDone) {
    return Promise.reject(
      new Error(
        "Trezor Connect still starting — wait a second, then click again.",
      ),
    );
  }

  const want = matchAddress?.toLowerCase();

  const addressPending = want
    ? TrezorConnect.ethereumGetAddress({
        bundle: Array.from({ length: ACCOUNT_BUNDLE }, (_, i) => ({
          path: ethAccountPath(i),
          showOnTrezor: false,
        })),
      })
    : TrezorConnect.ethereumGetAddress({
        path: ethAccountPath(0),
        showOnTrezor: false,
      });

  return (async () => {
    const res = await addressPending;
    if (!res.success) {
      throw new Error(humanTrezorError(extractErr(res)));
    }

    let address0: string | undefined;
    let derivationIndex = 0;
    const payload = res.payload as
      | { address?: string }
      | Array<{ address?: string }>;

    if (Array.isArray(payload)) {
      if (want) {
        const hit = payload.findIndex(
          (p) => (p.address || "").toLowerCase() === want,
        );
        if (hit < 0) {
          throw new Error(
            `Trezor Accounts 1–${ACCOUNT_BUNDLE} don’t include this address.`,
          );
        }
        derivationIndex = hit;
        address0 = payload[hit]?.address;
      } else {
        address0 = payload[0]?.address;
      }
    } else {
      address0 = payload.address;
    }
    if (!address0) throw new Error("Trezor returned no address.");

    let deviceId = "trezor-default";
    try {
      const feat = await TrezorConnect.getFeatures();
      if (feat.success && feat.payload) {
        const p = feat.payload as { device_id?: string; label?: string };
        if (p.device_id) deviceId = p.device_id;
        else if (p.label) deviceId = `label:${p.label}`;
      }
    } catch {
      /* address is enough */
    }

    return { address0, derivationIndex, deviceId };
  })();
}

function extractErr(res: unknown): string {
  const fail = res as {
    payload?: { error?: string };
    error?: { message?: string } | string;
  };
  return (
    fail.payload?.error ||
    (typeof fail.error === "string" ? fail.error : fail.error?.message) ||
    "Trezor not available"
  );
}

export function humanTrezorError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("manifest")) {
    return "Trezor Connect failed to init (manifest). Reload the page.";
  }
  if (
    s.includes("popup closed") ||
    s.includes("window closed") ||
    s.includes("closed by user") ||
    (s.includes("popup") && s.includes("closed"))
  ) {
    return "Trezor window closed. Try again and leave Connect open.";
  }
  if (s.includes("popup") && (s.includes("block") || s.includes("blocked"))) {
    return "Allow popups for this site, then click Connect Trezor again.";
  }
  if (
    s.includes("local network") ||
    s.includes("private network") ||
    (s.includes("permission") && s.includes("network"))
  ) {
    return "Browser blocked Local Network Access to the Trezor bridge. Allow local network, use system Chrome, then retry.";
  }
  if (
    s.includes("cancel") ||
    s.includes("rejected") ||
    s.includes("user denied")
  ) {
    return "Cancelled on Trezor — try again when ready.";
  }
  if (
    s.includes("device") &&
    (s.includes("not found") || s.includes("disconnected"))
  ) {
    return "No Trezor on the bridge. Plug in (or start Suite emu), then retry.";
  }
  if (
    (s.includes("bridge") &&
      (s.includes("21325") ||
        s.includes("not running") ||
        s.includes("failed"))) ||
    s.includes("no transport") ||
    s.includes("transport is missing")
  ) {
    return "No Trezor bridge on :21325. Start Suite / Bridge, then retry.";
  }
  return raw;
}

export { TrezorConnect };
