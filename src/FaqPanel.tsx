import { useEffect, useRef } from "react";
import { faqForFace } from "./faq";
import {
  isDeskFace,
  isGalleryFace,
  isStudioFace,
} from "./archiveFace";

function currentFace(): "gallery" | "press" | "studio" | "desk" {
  if (isGalleryFace()) return "gallery";
  if (isStudioFace()) return "studio";
  if (isDeskFace()) return "desk";
  return "press";
}

/** Paper-face FAQ — compact accordion grid; opens via #faq hash. */
export function FaqPanel() {
  const rootRef = useRef<HTMLDetailsElement>(null);
  const items = faqForFace(currentFace());

  useEffect(() => {
    function openIfHash() {
      if (typeof location === "undefined") return;
      if (location.hash.replace(/^#/, "") !== "faq") return;
      const el = rootRef.current;
      if (!el) return;
      el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    openIfHash();
    window.addEventListener("hashchange", openIfHash);
    return () => window.removeEventListener("hashchange", openIfHash);
  }, []);

  return (
    <details className="faq-panel" id="faq" ref={rootRef}>
      <summary className="faq-panel-summary">
        <span className="faq-panel-kicker">FAQ</span>
        <span className="faq-panel-dek">
          Gallery · Press · A1 · tips — short answers
        </span>
      </summary>
      <div className="faq-grid" role="list">
        {items.map((item) => (
          <details key={item.id} className="faq-item" role="listitem">
            <summary>{item.q}</summary>
            <p className="faq-a">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="faq-foot meta">
        More:{" "}
        <a
          href="https://x.com/HeartsArc"
          target="_blank"
          rel="noreferrer"
        >
          @HeartsArc
        </a>
        {" · "}
        <a
          href="https://github.com/ihelpmaybe/hearts-archive/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          Press / Studio ZIP
        </a>
      </p>
    </details>
  );
}

/** Jump to / open the in-page FAQ (rail + masthead). */
export function openFaq() {
  if (typeof location === "undefined") return;
  const el = document.getElementById("faq");
  if (el instanceof HTMLDetailsElement) {
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (location.hash !== "#faq") {
    history.replaceState(null, "", `${location.pathname}${location.search}#faq`);
  }
}
