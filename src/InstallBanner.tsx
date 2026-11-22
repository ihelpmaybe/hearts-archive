import { useEffect, useState } from "react";
import { isGalleryFace } from "./archiveFace";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "hearts-archive-a2hs-dismiss";

/**
 * Gallery / Pages: nudge Add to Home Screen (PWA).
 * Capacitor shells hide this (already an “app”).
 */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!isGalleryFace()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* */
    }
    const w = window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    if (w.Capacitor?.isNativePlatform?.()) return;

    const ua = navigator.userAgent || "";
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (standalone) return;

    if (ios) {
      setShowIos(true);
      setHidden(false);
      return;
    }

    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (hidden || !isGalleryFace()) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* */
    }
  }

  return (
    <div className="install-banner" role="status">
      <span className="meta">
        {showIos
          ? "Add to Home Screen: Share → Add to Home Screen"
          : "Install Gallery on this device for a phone-app feel"}
      </span>
      <span className="install-banner-acts">
        {deferred && (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              void deferred.prompt().then(() => setHidden(true));
            }}
          >
            Install
          </button>
        )}
        <button type="button" className="ghost" onClick={dismiss}>
          Dismiss
        </button>
      </span>
    </div>
  );
}
