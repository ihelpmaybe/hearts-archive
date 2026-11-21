import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyThemePack,
  getStoredThemeId,
  listThemeSummaries,
  resolveThemePack,
  type ThemePack,
} from "./theme";
import { ThemeStudio } from "./ThemeStudio";

type Props = {
  onApplied?: (pack: ThemePack) => void;
};

export function ThemePicker({ onApplied }: Props) {
  const [items, setItems] = useState<
    {
      id: string;
      name: string;
      swatch?: string;
      tagline?: string;
      local?: boolean;
    }[]
  >([]);
  const [active, setActive] = useState(() => getStoredThemeId("venus"));
  const [studioOpen, setStudioOpen] = useState(false);
  const [restorePack, setRestorePack] = useState<ThemePack | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  async function reload() {
    const list = await listThemeSummaries().catch(() => []);
    setItems(list);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function pick(id: string) {
    if (!id || id === active) return;
    const pack = await resolveThemePack(id);
    applyThemePack(pack);
    setActive(pack.id);
    onApplied?.(pack);
  }

  async function onMakeThemeClick() {
    // Close the theme <select> if it's open
    selectRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (studioOpen) {
      setStudioOpen(false);
      if (restorePack) applyThemePack(restorePack);
      return;
    }
    try {
      const cur = await resolveThemePack(active);
      setRestorePack(cur);
    } catch {
      setRestorePack(null);
    }
    setStudioOpen(true);
  }

  const current = items.find((t) => t.id === active) || items[0];

  return (
    <>
      <div className="theme-picker-wrap">
        {items.length > 0 && (
          <label className="theme-picker theme-picker-quiet">
            <span
              className="theme-swatch"
              style={{ background: current?.swatch || "var(--accent)" }}
              aria-hidden
            />
            <select
              ref={selectRef}
              className="theme-select"
              aria-label="Theme"
              value={
                items.some((t) => t.id === active)
                  ? active
                  : items[0]?.id || ""
              }
              onChange={(e) => void pick(e.target.value)}
            >
              {items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.local ? `${t.name} · local` : t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="ghost theme-make-btn"
          onMouseDown={(e) => {
            // Prevent select from re-opening / keeping focus when we click Make
            e.preventDefault();
            void onMakeThemeClick();
          }}
          onClick={(e) => e.preventDefault()}
          title="Make a theme for yourself or the public list"
        >
          Make theme
        </button>
      </div>
      {studioOpen &&
        createPortal(
          <ThemeStudio
            restorePack={restorePack}
            onClose={() => setStudioOpen(false)}
            onSaved={(pack) => {
              setActive(pack.id);
              onApplied?.(pack);
              void reload();
            }}
          />,
          document.body,
        )}
    </>
  );
}
