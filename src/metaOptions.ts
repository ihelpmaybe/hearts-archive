/** Write · More — language + license picks. */

export const LANG_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Language…" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ru", label: "Russian" },
  { value: "uk", label: "Ukrainian" },
  { value: "tr", label: "Turkish" },
  { value: "ar", label: "Arabic" },
  { value: "he", label: "Hebrew" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "id", label: "Indonesian" },
];

export const LICENSE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "License…" },
  { value: "CC0-1.0", label: "CC0 — public domain" },
  { value: "CC-BY-4.0", label: "CC BY 4.0" },
  { value: "CC-BY-SA-4.0", label: "CC BY-SA 4.0" },
  { value: "CC-BY-NC-4.0", label: "CC BY-NC 4.0" },
  { value: "CC-BY-NC-SA-4.0", label: "CC BY-NC-SA 4.0" },
  { value: "MIT", label: "MIT" },
  { value: "Apache-2.0", label: "Apache 2.0" },
  { value: "Unlicense", label: "Unlicense" },
  { value: "ARR", label: "All rights reserved" },
];

/** Keep a draft value visible even if it isn’t in the canned list. */
export function withCurrentOption(
  options: { value: string; label: string }[],
  current: string,
): { value: string; label: string }[] {
  const v = current.trim();
  if (!v || options.some((o) => o.value === v)) return options;
  return [...options, { value: v, label: v }];
}
