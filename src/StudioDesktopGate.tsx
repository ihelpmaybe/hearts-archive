import { useEffect, useState } from "react";

/** Studio is desktop-only — phones get a hard stop, not a broken Trezor path. */
export function useStudioDesktopBlocked(): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    function check() {
      const narrow = window.matchMedia("(max-width: 900px)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setBlocked(narrow || (coarse && window.innerWidth < 1024));
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return blocked;
}

export function StudioDesktopGate() {
  return (
    <div className="studio-desktop-gate" role="alert">
      <h1>Studio is desktop-only</h1>
      <p>
        Open Studio on a PC with Trezor Suite / Bridge. On a phone, use Press
        (injected wallet) or Gallery (read + tip QR).
      </p>
      <p className="meta">
        <a
          href="https://github.com/ihelpmaybe/hearts-archive/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          Releases
        </a>
      </p>
    </div>
  );
}
