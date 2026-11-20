import { useEffect, useState } from "react";
import {
  applyThemePack,
  fetchThemePack,
  getStoredThemeId,
  listThemeSummaries,
  type ThemePack,
} from "./theme";

type Props = {
  onApplied?: (pack: ThemePack) => void;
};

export function ThemePicker({ onApplied }: Props) {
  const [items, setItems] = useState<
    { id: string; name: string; swatch?: string; tagline?: string }[]
  >([]);
  const [active, setActive] = useState(() => getStoredThemeId("venus"));

  useEffect(() => {
    void listThemeSummaries().then(setItems);
  }, []);

  async function pick(id: string) {
    if (!id || id === active) return;
    const pack = await fetchThemePack(id);
    applyThemePack(pack);
    setActive(pack.id);
    onApplied?.(pack);
  }

  if (items.length < 2) return null;

  const current = items.find((t) => t.id === active) || items[0];

  return (
    <label className="theme-picker">
      <span className="theme-picker-label">Theme</span>
      <span
        className="theme-swatch"
        style={{ background: current?.swatch || "var(--accent)" }}
        aria-hidden
      />
      <select
        className="theme-select"
        aria-label="Theme"
        value={active}
        onChange={(e) => void pick(e.target.value)}
      >
        {items.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
