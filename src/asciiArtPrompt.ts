/** Universal ASCII master prompt — authors copy into any vision AI with an image. */

export const ASCII_ART_PROMPT_URL = "/ascii-art-prompt.txt";

export async function loadAsciiArtPrompt(): Promise<string> {
  const res = await fetch(ASCII_ART_PROMPT_URL);
  if (!res.ok) throw new Error("Could not load ASCII prompt");
  return (await res.text()).trim();
}

export async function copyAsciiArtPrompt(): Promise<void> {
  const text = await loadAsciiArtPrompt();
  await navigator.clipboard.writeText(text);
}
