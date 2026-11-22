/** In-app FAQ — short answers; face notes where Gallery differs. */

export type FaqItem = {
  id: string;
  q: string;
  a: string;
  /** If set, only show on these faces (omit = all). */
  faces?: Array<"gallery" | "press" | "studio" | "desk">;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what",
    q: "What is Heart’s Archive?",
    a: "An on-chain newspaper for PulseChain. Stories, likes, and A1 front bids go to 0x…feed. Highest PLS bid owns the lead for that day’s paper.",
  },
  {
    id: "faces",
    q: "Gallery, Press, Studio — what’s the difference?",
    a: "Gallery = read + tip QR (this peek / phone PWA). Press = MetaMask/Rabby publish, like, tip, A1. Studio = same money path with Trezor Connect + Bridge on desktop. Desk = local DEV sandbox only.",
  },
  {
    id: "publish",
    q: "How do I publish?",
    a: "Download the Press ZIP from GitHub Releases → unzip → START.cmd (Windows) or ./START.sh → connect a Pulse wallet → Write → Publish. Gallery cannot publish.",
    faces: ["gallery"],
  },
  {
    id: "publish-press",
    q: "How do I publish?",
    a: "Write → title + body (optional ASCII picture, tags, tip wallet) → pick an Open edition day → Publish. Gas only on those txs. Then open the story and Buy A1 if you want the lead.",
    faces: ["press", "studio", "desk"],
  },
  {
    id: "a1",
    q: "What is A1 / Buy A1?",
    a: "A1 is the front-page lead. You bid PLS to 0x…feed for a future Open day. Highest bid wins A1; next ranks fill A2–A3, then B1–B12, then C… Publishing alone does not put you on A1.",
  },
  {
    id: "like-tip-a1",
    q: "Like vs tip vs A1 — same thing?",
    a: "No. Like = burn ≥1 PLS once per wallet (extra PLS ≠ extra likes). Tip = send the writer any asset you choose. A1 = PLS bid for the day’s lead. Each is a separate wallet confirm.",
  },
  {
    id: "tip-qr",
    q: "How does the tip QR work?",
    a: "It’s an EIP-681 pay URI for native PLS on Pulse (chain 369). Scan or copy the address, then verify the recipient on your device before sending. Gallery is scan/copy only.",
  },
  {
    id: "days",
    q: "Yesterday / Today / Tomorrow?",
    a: "Papers are daily UTC editions. Past days are Final (printed). Tomorrow and later Open days still take A1 bids. Sync pulls …feed ink into this device.",
  },
  {
    id: "phone",
    q: "Can I use this on my phone?",
    a: "Yes — open the Gallery peek and Add to Home Screen (iOS: Share → Add to Home Screen). To publish or tip in-app, use Press/Studio on a desktop browser with a wallet.",
  },
  {
    id: "oss",
    q: "Is this open source?",
    a: "No — proprietary. You can run the Press/Studio ZIPs and the Gallery peek; the protocol shape is documented in the repo.",
  },
  {
    id: "x",
    q: "Where’s the official X account?",
    a: "@HeartsArc on X — https://x.com/HeartsArc",
  },
];

export function faqForFace(
  face: "gallery" | "press" | "studio" | "desk",
): FaqItem[] {
  return FAQ_ITEMS.filter((item) => !item.faces || item.faces.includes(face));
}
