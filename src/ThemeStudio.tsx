import { useEffect, useMemo, useState } from "react";
import {
  applyThemePack,
  deleteLocalTheme,
  downloadThemePack,
  FONT_PRESETS,
  getLocalTheme,
  saveLocalTheme,
  slugifyThemeId,
  snapshotThemeFromDom,
  THEME_COLOR_FIELDS,
  THEME_COLOR_GROUPS,
  themeSubmitUrl,
  type ThemePack,
} from "./theme";

type Props = {
  onClose: () => void;
  onSaved: (pack: ThemePack) => void;
  restorePack?: ThemePack | null;
};

function toHex(input: string): string {
  const s = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]!;
    const g = s[2]!;
    const b = s[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const h = (n: string) =>
      Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
    return `#${h(m[1]!)}${h(m[2]!)}${h(m[3]!)}`;
  }
  return "#888888";
}

function softLineFrom(line: string): string {
  const hex = toHex(line);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "rgba(128, 128, 128, 0.22)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.22)`;
}

export function ThemeStudio({ onClose, onSaved, restorePack }: Props) {
  const [draft, setDraft] = useState<ThemePack>(() =>
    snapshotThemeFromDom({
      name: "",
      tagline: "",
    }),
  );
  const [fontPreset, setFontPreset] = useState("newsprint");
  const [note, setNote] = useState<string | null>(null);

  const nameOk = draft.name.trim().length >= 2;
  const preset = FONT_PRESETS.find((p) => p.id === fontPreset) || FONT_PRESETS[0]!;

  const pack = useMemo(() => {
    const name = draft.name.trim() || "Untitled theme";
    const id = slugifyThemeId(name);
    const accent = draft.vars["--accent"] || "#888888";
    const line = draft.vars["--line"] || "#444444";
    return {
      ...draft,
      id,
      name,
      tagline: (draft.tagline || "").trim() || `${name} · community`,
      swatch: accent,
      eyebrow: `Heart’s Archive · ${name}`,
      fonts: preset.fonts,
      vars: {
        ...draft.vars,
        ...preset.vars,
        "--accent": accent,
        "--accent-hot": draft.vars["--accent-hot"] || accent,
        "--accent-dim": draft.vars["--panel-2"] || draft.vars["--panel"] || "#222",
        "--line-soft": softLineFrom(line),
        "--bg-glow": draft.vars["--bg-glow"] || "none",
        "--radius": draft.vars["--radius"] || "0px",
      },
      local: true,
    } satisfies ThemePack;
  }, [draft, preset]);

  useEffect(() => {
    applyThemePack(pack);
  }, [pack]);

  function setColor(key: string, value: string) {
    setDraft((d) => ({
      ...d,
      vars: { ...d.vars, [key]: value },
    }));
  }

  function save() {
    if (!nameOk) {
      setNote("Give it a name first");
      return;
    }
    const saved = saveLocalTheme(pack);
    applyThemePack(saved);
    onSaved(saved);
    setNote("Saved in this browser — pick it from the theme list anytime");
  }

  function download() {
    if (!nameOk) {
      setNote("Give it a name first");
      return;
    }
    downloadThemePack(pack);
    setNote(`Saved file: ${pack.id}.json`);
  }

  function submit() {
    if (!nameOk) {
      setNote("Give it a name first");
      return;
    }
    downloadThemePack(pack);
    window.open(themeSubmitUrl(pack), "_blank", "noopener,noreferrer");
    setNote("Pack downloaded · GitHub opened — attach the file and send");
  }

  function remove() {
    if (!getLocalTheme(pack.id)) return;
    deleteLocalTheme(pack.id);
    if (restorePack) applyThemePack(restorePack);
    onSaved(restorePack || pack);
    onClose();
  }

  function cancel() {
    if (restorePack) applyThemePack(restorePack);
    onClose();
  }

  return (
    <div className="theme-studio" role="dialog" aria-label="Make a theme">
      <div className="theme-studio-head">
        <div className="theme-studio-titleblock">
          <strong>Make a theme</strong>
          <p className="theme-studio-lede">
            Changes show live on the paper behind this panel. When it looks right:
            keep it here, download the pack, or send it in for the public list.
          </p>
        </div>
        <button type="button" className="ghost" onClick={cancel}>
          Close
        </button>
      </div>

      <section className="theme-studio-section">
        <h3 className="theme-studio-section-hed">1 · Name</h3>
        <div className="theme-studio-grid theme-studio-grid--identity">
          <label className="theme-studio-field">
            <span>Theme name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value.slice(0, 40) }))
              }
              maxLength={40}
              placeholder="e.g. Midnight Press"
              autoFocus
            />
          </label>
          <label className="theme-studio-field">
            <span>One-line pitch</span>
            <input
              type="text"
              value={draft.tagline || ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  tagline: e.target.value.slice(0, 60),
                }))
              }
              maxLength={60}
              placeholder="Optional — shown in the theme list"
            />
          </label>
        </div>
      </section>

      <section className="theme-studio-section">
        <h3 className="theme-studio-section-hed">2 · Type</h3>
        <p className="theme-studio-section-blurb">
          Nameplate · headlines · body — pick a set that fits the mood.
        </p>
        <div className="theme-studio-grid theme-studio-grid--type">
          <label className="theme-studio-field">
            <span>Font set</span>
            <select
              value={fontPreset}
              onChange={(e) => setFontPreset(e.target.value)}
              aria-label="Font set"
            >
              {FONT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="theme-studio-font-hint">{preset.faces}</span>
          </label>
          <label className="theme-studio-field theme-studio-field--narrow">
            <span>Corners</span>
            <select
              value={draft.vars["--radius"] || "0px"}
              onChange={(e) => setColor("--radius", e.target.value)}
            >
              <option value="0px">Sharp</option>
              <option value="8px">Soft</option>
              <option value="14px">Round</option>
            </select>
          </label>
        </div>
      </section>

      {THEME_COLOR_GROUPS.map((group) => (
        <section key={group.id} className="theme-studio-section">
          <h3 className="theme-studio-section-hed">
            {group.id === "paper"
              ? "3 · Paper"
              : group.id === "ink"
                ? "4 · Ink"
                : group.id === "accent"
                  ? "5 · Accent"
                  : "6 · Status"}
          </h3>
          <p className="theme-studio-section-blurb">{group.blurb}</p>
          <div className="theme-studio-grid">
            {THEME_COLOR_FIELDS.filter((f) => f.group === group.id).map(
              (field) => {
                const raw = draft.vars[field.key] || "#888888";
                const hex = toHex(raw);
                return (
                  <label
                    key={field.key}
                    className="theme-studio-field theme-studio-color"
                    title={field.hint}
                  >
                    <span>{field.label}</span>
                    <span className="theme-studio-color-row">
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) => setColor(field.key, e.target.value)}
                        aria-label={field.label}
                      />
                      <input
                        type="text"
                        value={raw}
                        onChange={(e) => setColor(field.key, e.target.value)}
                        spellCheck={false}
                        aria-label={`${field.label} value`}
                      />
                    </span>
                    <span className="theme-studio-font-hint">{field.hint}</span>
                  </label>
                );
              },
            )}
          </div>
        </section>
      ))}

      <div className="theme-studio-actions">
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={!nameOk}
        >
          Keep on this browser
        </button>
        <button
          type="button"
          className="ghost"
          onClick={download}
          disabled={!nameOk}
        >
          Download pack
        </button>
        <button
          type="button"
          className="ghost"
          onClick={submit}
          disabled={!nameOk}
          title="Downloads the pack and opens a GitHub theme request"
        >
          Send for the public list
        </button>
        {!!getLocalTheme(pack.id) && (
          <button type="button" className="ghost" onClick={remove}>
            Remove local copy
          </button>
        )}
        {note && <span className="theme-studio-note">{note}</span>}
      </div>
    </div>
  );
}
