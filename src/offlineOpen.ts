/** Deep-link open when there is no cached body. */
export function offlineOpenHint(opts: {
  hasCache: boolean;
  online: boolean;
  rpcReady: boolean;
}): string | null {
  if (opts.hasCache) return null;
  if (!opts.online) {
    return "Offline and no local copy — open this link once online to cache it.";
  }
  if (!opts.rpcReady) {
    return "RPC not ready — Sync once while online, then re-open.";
  }
  return null;
}
