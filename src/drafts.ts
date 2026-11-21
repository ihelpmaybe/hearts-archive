export type PublishDraft = {
  title: string;
  tagsRaw: string;
  note: string;
  summary: string;
  lang: string;
  license: string;
  replaces: string;
  cw: boolean;
  bodyText?: string;
  /** Type-cut / text picture (above body). */
  pictureText?: string;
  telegram?: string;
  twitter?: string;
  tipPrefs?: string;
  tipWallet?: string;
  fileName?: string;
  savedAt: number;
};

const KEY = "pulse-archive-draft-v1";

export function loadDraft(): PublishDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublishDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<PublishDraft, "savedAt">) {
  const row: PublishDraft = { ...draft, savedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(row));
}

export function clearDraft() {
  localStorage.removeItem(KEY);
}
