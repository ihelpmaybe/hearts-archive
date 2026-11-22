/**
 * Share story URL — Capacitor Share when native, else Web Share / clipboard.
 */
export async function shareStoryLink(opts: {
  url: string;
  title?: string;
}): Promise<"shared" | "copied"> {
  const title = opts.title?.trim() || "Heart’s Archive";
  const text = title;

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title,
        text,
        url: opts.url,
        dialogTitle: "Share story",
      });
      return "shared";
    }
  } catch {
    /* fall through */
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url: opts.url });
      return "shared";
    } catch (e) {
      // user cancel
      if (e instanceof Error && /abort|cancel/i.test(e.message)) {
        throw e;
      }
    }
  }

  await navigator.clipboard.writeText(opts.url);
  return "copied";
}
