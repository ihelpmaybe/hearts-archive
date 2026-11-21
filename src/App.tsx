import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useSendTransaction,
  useWalletClient,
} from "wagmi";
import { pulsechain } from "wagmi/chains";
import {
  erc20Abi,
  parseEther,
  parseUnits,
  type Hash,
} from "viem";
import { WalletBar } from "./WalletBar";
import { ThemePicker } from "./ThemePicker";
import { TypeCutPicture } from "./TypeCutPicture";
import { copyAsciiArtPrompt } from "./asciiArtPrompt";
import {
  displayHandle,
  telegramUrl,
  twitterUrl,
} from "./authorContact";
import { normalizeTypeCut } from "./typeCut";
import { packArticle, unpackArticle } from "./articleFormat";
import { loadAndApplyTheme } from "./theme";
import {
  CUSTOM_TIP_ID,
  TIP_PRESETS,
  isAddressLike,
  loadRecentTipTokens,
  rememberTipToken,
} from "./tipTokens";
import {
  countLikesByManifest,
  dedupeBySha256,
  dedupeFrontBids,
  dedupeLikes,
  frontBidPrintedDay,
  hasLiked,
  listArchiveFromAuthor,
  listSinkBundle,
  type ArchiveEntry,
  type FrontBidEntry,
  type LikeEntry,
} from "./archive";
import {
  formatFrontPriceHint,
  formatPls,
  frontBidStats,
} from "./frontPage";
import {
  bidsForPrintedDay,
  editionCursor,
  isOpenEdition,
  isOpenPrintedDay,
  layoutEdition,
  listEditionDays,
  maxOpenEditionDay,
  openEditionBids,
  OPEN_HORIZON_DAYS,
  SYNC_LOOKBACK_DAYS,
  shiftUtcDay,
  syncLookbackCutoffUnix,
  utcDayKey,
  utcTodayKey,
  type EditionView,
} from "./editions";
import { softMuteHit } from "./softMute";
import { getCachedDoc, listCachedSummaries, putCachedDoc } from "./cache";
import {
  findCatalogBySha256,
  listCatalog,
  upsertCatalog,
} from "./catalog";
import { loadLocalCatalog } from "./catalogLocal";
import { loadLabSeed } from "./labSeed";
import { isLabMode, setLabMode } from "./labMode";
import { listCachedLikes, upsertCachedLikes } from "./likesCache";
import { clearDraft, loadDraft, saveDraft } from "./drafts";
import {
  clearIncomplete,
  incompleteDoneCount,
  loadIncomplete,
  saveIncomplete,
  type IncompletePublish,
} from "./incomplete";
import {
  applyDatePreset,
  buildBodyIndex,
  matchEntry,
  parseQuery,
  sortEntries,
  type DatePreset,
  type SearchScope,
  type SearchSort,
} from "./search";
import {
  estimatePublishCostLocal,
  formatCitation,
  makeObjectUrl,
  parseRouteHash,
  parseTags,
  clearDocRoute,
  preparePublishPayload,
  publishPrepared,
  readDocument,
  SCAN_TX,
  sharePath,
  shareUrl,
  MAX_PUBLISH_BYTES,
  sendFrontBid,
  sendLike,
  sha256Hex,
  type ChunkProgress,
  type DocType,
  type PreparedPublish,
} from "./protocol";
import { loadLocalFronts, saveLocalFronts } from "./frontsLocal";
import {
  listShelf,
  mergeShelfAndRemote,
  pinToShelf,
  unpinFromShelf,
} from "./shelf";

/** Retired lab series demo — purge leftover A1 / shelf pins. */
const RETIRED_LAB_SERIES = new Set([
  "0xbd0ad0de73324bb9c0f6815921b0862dfce5a631d4f1318b7709ed2736bb7c1d",
  "0x3a7d71e392474a52d10077191a324d2c88bcefc399dfdf681fb73d92ecbe22da",
  "0x6c4264d478d900cf7ac4b30e48afb45ab7d511c50cd2427c2e3e9a476bf2f549",
]);

/** Old labSeed synthetic A1 tx hashes (eee… / fff…). */
const RETIRED_FAKE_FRONT_TX = new Set([
  "0x" + "e".repeat(64),
  "0x" + "f".repeat(64),
]);

function isRetiredFront(b: FrontBidEntry): boolean {
  const m = b.manifest.toLowerCase();
  const h = b.hash.toLowerCase();
  return RETIRED_LAB_SERIES.has(m) || RETIRED_FAKE_FRONT_TX.has(h);
}
import {
  applyLocalBackup,
  buildLocalBackup,
  downloadBackupJson,
} from "./shelfBackup";
import { collapseSeriesCards } from "./series";
import { offlineOpenHint } from "./offlineOpen";
import {
  LANG_OPTIONS,
  LICENSE_OPTIONS,
  withCurrentOption,
} from "./metaOptions";

type LoadedDoc = {
  mimeType: string;
  title?: string;
  tags?: string[];
  note?: string;
  summary?: string;
  type?: DocType;
  sha256?: string;
  encoding?: string;
  replaces?: string;
  cw?: boolean;
  telegram?: string;
  twitter?: string;
  tipPrefs?: string;
  tipWallet?: string;
  objectUrl: string;
  size: number;
  chunkCount: number;
  manifestHash: Hash;
  from?: string;
  postedAt?: number;
};

/** Local Preview face only — never lands on the front page. */
const PREVIEW_FROM = "0xpreview00000000000000000000000000000001";
/** Dev / Lab publish — local shelf only, not Pulse. */
const LAB_FROM = "0xlab000000000000000000000000000000000001";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function isLocalPreviewDoc(from?: string) {
  return (from || "").toLowerCase() === PREVIEW_FROM;
}

function isLabTestDoc(from?: string) {
  return (from || "").toLowerCase() === LAB_FROM;
}

function formatPostedAt(unixSec?: number): string {
  if (!unixSec || unixSec <= 0) return "";
  const d = new Date(unixSec * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Preview({ doc }: { doc: LoadedDoc }) {
  const { mimeType, objectUrl } = doc;
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml")
  ) {
    return <TextPreview url={objectUrl} title={doc.title} />;
  }
  return (
    <p className="meta">
      Not text ({mimeType || "unknown"}). This app is text-only — open the Tx
      link if you need the raw payload.
    </p>
  );
}

function SoftHeld({
  hit,
  children,
  label = "Held from the face — open anyway",
}: {
  hit: boolean;
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!hit || open) return <>{children}</>;
  return (
    <div className="soft-held">
      <p className="soft-held-note">
        Soft mute — wording looked too graphic for the paper face.
      </p>
      <button type="button" className="ghost" onClick={() => setOpen(true)}>
        {label}
      </button>
    </div>
  );
}

function TextPreview({ url, title }: { url: string; title?: string }) {
  const [text, setText] = useState("Loading…");
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((e) => {
        if (!cancelled) setText(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  const loading = text === "Loading…";
  const parts = loading ? { picture: "", body: text } : unpackArticle(text);
  const hit = softMuteHit(title, parts.picture, parts.body);
  return (
    <SoftHeld hit={hit} label="Read anyway">
      <div className="article-stack">
        {parts.picture.trim() ? (
          <TypeCutPicture text={parts.picture} className="article-picture" />
        ) : null}
        {parts.body.trim() || !parts.picture.trim() ? (
          <pre className="article-body">{parts.body || (loading ? text : "")}</pre>
        ) : null}
      </div>
    </SoftHeld>
  );
}

export function App() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: pulsechain.id });
  const { data: walletClient } = useWalletClient({ chainId: pulsechain.id });
  const { sendTransactionAsync } = useSendTransaction();
  const { data: plsBalance } = useBalance({
    address,
    chainId: pulsechain.id,
    query: {
      enabled: !!address,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const [hashInput, setHashInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [pictureText, setPictureText] = useState("");
  const [asciiPromptMsg, setAsciiPromptMsg] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [summary, setSummary] = useState("");
  const [lang, setLang] = useState("");
  const [license, setLicense] = useState("");
  const [replaces, setReplaces] = useState("");
  const [telegram, setTelegram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [tipWallet, setTipWallet] = useState("");
  const [prepared, setPrepared] = useState<PreparedPublish | null>(null);
  const [gasHint, setGasHint] = useState<string | null>(null);
  const [costWei, setCostWei] = useState<bigint | null>(null);
  const [reading, setReading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [pubError, setPubError] = useState<string | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [chunks, setChunks] = useState<ChunkProgress[]>([]);
  const [lastManifest, setLastManifest] = useState<Hash | null>(null);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("text");
  const archiveOnly = true;
  const searchBodies = true;
  const [sortBy, setSortBy] = useState<SearchSort>("newest");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [scope, setScope] = useState<SearchScope>("all");
  const [bodyByHash, setBodyByHash] = useState<Map<string, string>>(new Map());
  const [tipAmount, setTipAmount] = useState("1");
  const [tipTokenId, setTipTokenId] = useState("PLS");
  const [tipCustom, setTipCustom] = useState("");
  const [tipping, setTipping] = useState(false);
  const [tipError, setTipError] = useState<string | null>(null);
  const [tipOk, setTipOk] = useState<string | null>(null);
  const [citeMsg, setCiteMsg] = useState<string | null>(null);
  const [, setLoadSource] = useState<string | null>(null);
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [fronts, setFronts] = useState<FrontBidEntry[]>(() =>
    loadLocalFronts().filter((b) => !isRetiredFront(b)),
  );
  const [liking, setLiking] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [frontAmount, setFrontAmount] = useState("10");
  const [fronting, setFronting] = useState(false);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [frontOk, setFrontOk] = useState<string | null>(null);
  const [labNote, setLabNote] = useState<string | undefined>();
  const [labOn, setLabOn] = useState(() => isLabMode());
  const [expandSeries] = useState<Set<string>>(() => new Set());
  const [recentTips, setRecentTips] = useState<`0x${string}`[]>(() =>
    loadRecentTipTokens(),
  );
  const [likesRefreshing, setLikesRefreshing] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [likeOk, setLikeOk] = useState<string | null>(null);
  /** Write: edit form vs local article preview (not the archive reader). */
  const [writeMode, setWriteMode] = useState<"compose" | "preview">("compose");
  const [tab, setTab] = useState<"library" | "post">(() => {
    try {
      const t = sessionStorage.getItem("hearts-archive-tab");
      if (t === "post" || t === "library") return t;
    } catch {
      /* */
    }
    return "library";
  });
  /** Default = tomorrow’s Open (where new A1 bids land). ← for today’s Final. */
  const [editionDay, setEditionDay] = useState<EditionView>(() =>
    shiftUtcDay(utcTodayKey(), 1),
  );
  /** Which open printed day A1 / test-publish claims (default tomorrow). */
  const [bidForDay, setBidForDay] = useState(() =>
    shiftUtcDay(utcTodayKey(), 1),
  );
  const [leadPicture, setLeadPicture] = useState("");

  useEffect(() => {
    try {
      sessionStorage.setItem("hearts-archive-tab", tab);
    } catch {
      /* */
    }
  }, [tab]);
  const [incomplete, setIncomplete] = useState<IncompletePublish | null>(() =>
    loadIncomplete(),
  );
  const [recentLocal, setRecentLocal] = useState<
    { hash: Hash; title: string; mimeType: string; savedAt: number }[]
  >([]);

  const wrongChain = isConnected && chainId !== pulsechain.id;
  /** Dev / Lab: no wallet chrome — Preview + Lab cover testing without a wallet. */
  const walletUiOff = labOn || import.meta.env.DEV;
  const entriesRef = useRef(entries);
  const openHashRef = useRef<string | null>(null);
  const loadRef = useRef<(h: Hash, opts?: { goRead?: boolean }) => Promise<void>>(
    async () => {},
  );

  /** Leave the interior reader — Front page / Esc / cleared deep-link. */
  const closeReader = useCallback(() => {
    setDoc((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
    openHashRef.current = null;
    setReading(false);
    setReadError(null);
    setLoadSource(null);
    clearDocRoute();
  }, []);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const refreshRecentLocal = useCallback(async () => {
    const next = await listCachedSummaries();
    setRecentLocal((prev) => {
      if (
        prev.length === next.length &&
        prev.every((p, i) => p.hash === next[i]?.hash && p.savedAt === next[i]?.savedAt)
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  /** Autosave only after hydrate re-render — empty first paint must not wipe title. */
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    const stuck = loadIncomplete();
    if (stuck) {
      setIncomplete(stuck);
      setTitle(stuck.title);
      setTagsRaw(stuck.tagsRaw);
      setSummary(stuck.summary);
      setLang(stuck.lang);
      setLicense(stuck.license);
      setReplaces(stuck.replaces);
      setChunks(stuck.progress);
      setDraftHydrated(true);
      return;
    }
    const d = loadDraft();
    if (d) {
      setTitle(d.title || "");
      setTagsRaw(d.tagsRaw || "");
      setSummary(d.summary || "");
      setLang(d.lang || "");
      setLicense(d.license || "");
      setReplaces(d.replaces || "");
      setTelegram(d.telegram || "");
      setTwitter(d.twitter || "");
      setTipWallet(d.tipWallet || "");
      if (d.bodyText) setBodyText(d.bodyText);
      if (d.pictureText) setPictureText(d.pictureText);
    }
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    saveDraft({
      title,
      tagsRaw,
      note: "",
      summary,
      lang,
      license,
      replaces,
      cw: false,
      bodyText,
      pictureText,
      telegram,
      twitter,
      tipWallet,
    });
  }, [
    draftHydrated,
    title,
    tagsRaw,
    summary,
    lang,
    license,
    replaces,
    bodyText,
    pictureText,
    telegram,
    twitter,
    tipWallet,
  ]);

  const applyLoaded = useCallback(
    (opts: {
      manifestHash: Hash;
      mimeType: string;
      title?: string;
      tags?: string[];
      note?: string;
      summary?: string;
      type?: DocType;
      sha256?: string;
      encoding?: string;
      replaces?: string;
      cw?: boolean;
      telegram?: string;
      twitter?: string;
      tipPrefs?: string;
      tipWallet?: string;
      bytes: Uint8Array;
      chunkCount: number;
      from?: string;
      postedAt?: number;
      source: string;
    }) => {
      // Old local-preview shelf fakes — not real articles
      if (isLocalPreviewDoc(opts.from)) {
        setDoc(null);
        clearDocRoute();
        return;
      }
      const {
        manifestHash,
        mimeType,
        bytes,
        chunkCount,
        from,
        postedAt,
        source,
      } = opts;
      pinToShelf({
        hash: manifestHash,
        from: from || "",
        timeStamp: postedAt || Math.floor(Date.now() / 1000),
        title: opts.title?.trim() || "(untitled)",
        mimeType,
        type: opts.type,
        tags: opts.tags ?? [],
        note: opts.note,
        summary: opts.summary,
        sha256: opts.sha256,
        encoding: opts.encoding,
        replaces: opts.replaces,
        chunkCount,
        kind: "pulse-archive",
        cw: opts.cw,
      });
      setDoc((prev) => {
        if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
        return {
          mimeType,
          title: opts.title,
          tags: opts.tags,
          note: opts.note,
          summary: opts.summary,
          type: opts.type,
          sha256: opts.sha256,
          encoding: opts.encoding,
          replaces: opts.replaces,
          cw: opts.cw,
          telegram: opts.telegram,
          twitter: opts.twitter,
          tipPrefs: opts.tipPrefs,
          tipWallet: opts.tipWallet,
          objectUrl: makeObjectUrl(bytes, mimeType),
          size: bytes.length,
          chunkCount,
          manifestHash,
          from,
          postedAt,
        };
      });
      setLoadSource(source);
      const path = sharePath(manifestHash);
      // push so browser ← can leave the article (hashchange clears reader)
      if (window.location.hash !== path) {
        window.history.pushState(null, "", path);
      }
      setHashInput(manifestHash);
      setEntries((prev) => {
        if (prev.some((e) => e.hash === manifestHash)) return prev;
        return dedupeBySha256(mergeShelfAndRemote(listShelf(), prev));
      });
      void refreshRecentLocal();
    },
    [refreshRecentLocal],
  );

  const load = useCallback(
    async (manifestHash: Hash, opts?: { goRead?: boolean }) => {
      const key = manifestHash.toLowerCase();
      // Same doc already showing — don't tear down reader (stops flash)
      if (openHashRef.current === key && opts?.goRead !== false) {
        return;
      }
      openHashRef.current = key;
      if (opts?.goRead !== false) setTab("library");
      setReadError(null);
      setCiteMsg(null);
      setLikeOk(null);
      setTipOk(null);
      setTipError(null);
      const cached = await getCachedDoc(manifestHash);
      try {
        // Local-first: cached body = no RPC (cuts chain pressure on re-read)
        if (cached) {
          applyLoaded({
            manifestHash,
            mimeType: cached.mimeType,
            title: cached.title,
            tags: cached.tags,
            note: cached.note,
            summary: cached.summary,
            type: cached.type,
            sha256: cached.sha256,
            encoding: cached.encoding,
            replaces: cached.replaces,
            cw: cached.cw,
            telegram: cached.telegram,
            twitter: cached.twitter,
            tipPrefs: cached.tipPrefs,
            tipWallet: cached.tipWallet,
            bytes: new Uint8Array(cached.bytes),
            chunkCount: cached.chunkCount,
            from: cached.from,
            postedAt: cached.postedAt,
            source: "Local copy",
          });
          return;
        }

        setReading(true);
        setLoadSource(null);

        if (!publicClient) {
          setReadError(
            offlineOpenHint({
              hasCache: false,
              online:
                typeof navigator === "undefined" ? true : navigator.onLine,
              rpcReady: false,
            }) || "RPC not ready — Sync once while online, then re-open.",
          );
          return;
        }

        const { meta, bytes, from: txFrom } = await readDocument(
          publicClient,
          manifestHash,
        );
        // Prefer catalog timestamps — skip getBlock RPC
        const known = entriesRef.current.find(
          (e) => e.hash.toLowerCase() === key,
        );
        const from = (txFrom || known?.from || "").toLowerCase();
        const postedAt = known?.timeStamp || 0;
        await putCachedDoc({
          hash: manifestHash,
          mimeType: meta.mimeType,
          title: meta.title,
          tags: meta.tags,
          note: meta.note,
          summary: meta.summary,
          type: meta.type,
          sha256: meta.sha256,
          encoding: meta.encoding,
          replaces: meta.replaces,
          cw: meta.cw,
          telegram: meta.telegram,
          twitter: meta.twitter,
          tipPrefs: meta.tipPrefs,
          tipWallet: meta.tipWallet,
          from,
          postedAt: postedAt || undefined,
          chunkCount: meta.chunkHashes.length,
          bytes: bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
          savedAt: Date.now(),
        });
        applyLoaded({
          manifestHash,
          mimeType: meta.mimeType,
          title: meta.title,
          tags: meta.tags,
          note: meta.note,
          summary: meta.summary,
          type: meta.type,
          sha256: meta.sha256,
          encoding: meta.encoding,
          replaces: meta.replaces,
          cw: meta.cw,
          telegram: meta.telegram,
          twitter: meta.twitter,
          tipPrefs: meta.tipPrefs,
          tipWallet: meta.tipWallet,
          bytes,
          chunkCount: meta.chunkHashes.length,
          from,
          postedAt: postedAt || undefined,
          source: "Fetched from Pulse · saved locally",
        });
      } catch (e) {
        const online =
          typeof navigator === "undefined" ? true : navigator.onLine;
        const offlineMsg = offlineOpenHint({
          hasCache: false,
          online,
          rpcReady: true,
        });
        const msg = e instanceof Error ? e.message : String(e);
        setReadError(!online && offlineMsg ? offlineMsg : msg);
        setDoc(null);
        openHashRef.current = null;
      } finally {
        setReading(false);
      }
    },
    [publicClient, applyLoaded],
  );

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const likeCounts = useMemo(() => countLikesByManifest(likes), [likes]);

  /** Paint Library from IndexedDB / shelf — zero RPC. */
  const loadLocalLibrary = useCallback(async () => {
    setBrowsing(true);
    setBrowseError(null);
    try {
      const shelf = listShelf();
      const [staticCat, idbCat] = await Promise.all([
        loadLocalCatalog(),
        listCatalog(),
      ]);
      const base = dedupeBySha256(
        mergeShelfAndRemote(
          mergeShelfAndRemote(shelf, staticCat),
          idbCat,
        ),
      );
      setEntries(base);
      const cachedLikes = await listCachedLikes();
      if (cachedLikes.length) {
        setLikes((prev) => dedupeLikes([...cachedLikes, ...prev]));
      }
    } finally {
      setBrowsing(false);
      void refreshRecentLocal();
    }
  }, [refreshRecentLocal]);

  /** Pull …feed since last Sync (capped at 30d). Explorer only — no story bodies. */
  const refreshLibrary = useCallback(async () => {
    let lastSyncMs = 0;
    try {
      lastSyncMs = Number(
        localStorage.getItem("hearts-archive-last-sync") || "0",
      );
      if (lastSyncMs && Date.now() - lastSyncMs < 20_000) {
        setBrowseError("Sync cooling down — try again in a few seconds.");
        return;
      }
    } catch {
      /* */
    }
    setBrowsing(true);
    setBrowseError(null);
    const shelf = listShelf();
    const [staticCat, idbCat] = await Promise.all([
      loadLocalCatalog(),
      listCatalog(),
    ]);
    const base = dedupeBySha256(
      mergeShelfAndRemote(
        mergeShelfAndRemote(shelf, staticCat),
        idbCat,
      ),
    );
    setEntries(base);
    try {
      const author = authorInput.trim();
      const knownHashes = new Set(base.map((e) => e.hash.toLowerCase()));
      for (const l of likes) knownHashes.add(l.hash.toLowerCase());
      for (const f of fronts) knownHashes.add(f.hash.toLowerCase());

      // Gone 29d → walk ~29d. Cap = 60d (2× schedule) so +30d posts survive a long absence.
      // Daily user → tip only (known streak stops early). One stream, not per-day calls.
      const cutoff = syncLookbackCutoffUnix({ lastSyncMs: lastSyncMs || null });
      const gapSec = Math.max(0, Math.floor(Date.now() / 1000) - cutoff);
      const gapDays = Math.min(
        SYNC_LOOKBACK_DAYS,
        Math.max(1, Math.ceil(gapSec / 86400)),
      );
      const maxItems = Math.min(800, Math.max(100, gapDays * 25));
      const maxPages = Math.min(20, Math.max(4, Math.ceil(maxItems / 50)));

      if (/^0x[a-fA-F0-9]{40}$/.test(author)) {
        const remote = await listArchiveFromAuthor(author as `0x${string}`, {
          maxItems,
          maxPages,
          knownHashes,
          stopOlderThanUnix: cutoff,
        });
        await upsertCatalog(remote);
        setEntries(dedupeBySha256(mergeShelfAndRemote(base, remote)));
        const bundle = await listSinkBundle({
          onlyArchiveKind: false,
          maxItems,
          maxPages,
          knownHashes,
          stopOlderThanUnix: cutoff,
        });
        setLikes((prev) => dedupeLikes([...prev, ...bundle.likes]));
        setFronts((prev) => dedupeFrontBids([...prev, ...bundle.fronts]));
        void upsertCachedLikes(bundle.likes);
      } else {
        const bundle = await listSinkBundle({
          onlyArchiveKind: archiveOnly,
          maxItems,
          maxPages,
          knownHashes,
          stopOlderThanUnix: cutoff,
        });
        await upsertCatalog(bundle.entries);
        setEntries(dedupeBySha256(mergeShelfAndRemote(base, bundle.entries)));
        setLikes((prev) => dedupeLikes([...prev, ...bundle.likes]));
        setFronts((prev) => dedupeFrontBids([...prev, ...bundle.fronts]));
        void upsertCachedLikes(bundle.likes);
      }
      try {
        localStorage.setItem(
          "hearts-archive-last-sync",
          String(Date.now()),
        );
      } catch {
        /* */
      }
    } catch (e) {
      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      const detail = offline
        ? "You’re offline"
        : e instanceof Error
          ? e.message
          : String(e);
      setBrowseError(
        detail +
          (base.length
            ? ` — still showing your local library (${base.length}). Try Sync later.`
            : " — nothing local yet. Connect, then Sync when the network is up."),
      );
      setEntries(base);
    } finally {
      setBrowsing(false);
      void refreshRecentLocal();
    }
  }, [authorInput, archiveOnly, refreshRecentLocal, likes, fronts]);

  useEffect(() => {
    const fromRoute = parseRouteHash(window.location.hash);
    if (fromRoute) {
      setHashInput(fromRoute);
      void loadRef.current(fromRoute);
    }
    const onHash = () => {
      const h = parseRouteHash(window.location.hash);
      if (h) {
        setHashInput(h);
        void loadRef.current(h);
        return;
      }
      // Browser ← / cleared # — drop the reader (was a no-op before)
      setDoc((prev) => {
        if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
        return null;
      });
      openHashRef.current = null;
      setReading(false);
      setReadError(null);
      setLoadSource(null);
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);

  useEffect(() => {
    void loadAndApplyTheme().catch(() => {
      /* Venus CSS defaults still apply */
    });
  }, []);

  // Persist A1 bids (local test + synced) so sole bidder keeps the lead after refresh
  useEffect(() => {
    saveLocalFronts(fronts);
  }, [fronts]);

  // Keep Open date fresh across UTC midnight
  useEffect(() => {
    if (!isOpenPrintedDay(bidForDay)) {
      setBidForDay(shiftUtcDay(utcTodayKey(), 1));
    }
  }, [bidForDay]);

  // If Open has your local-test story but no A1 bid, claim the lead (sole publisher)
  useEffect(() => {
    if (!isOpenEdition(editionDay)) return;
    const printed = editionCursor(editionDay);
    if (bidsForPrintedDay(fronts, printed).length > 0) return;
    const fileDay = shiftUtcDay(printed, -1);
    const mine = entries.filter(
      (e) =>
        (e.from || "").toLowerCase() === LAB_FROM &&
        utcDayKey(e.timeStamp) === fileDay,
    );
    if (!mine.length) return;
    // Newest local-test story gets floor A1 so Open isn’t “unpublished”
    const story = [...mine].sort(
      (a, b) => (b.timeStamp || 0) - (a.timeStamp || 0),
    )[0]!;
    const now = Math.floor(Date.now() / 1000);
    setFronts((prev) => {
      if (bidsForPrintedDay(prev, printed).length > 0) return prev;
      return dedupeFrontBids([
        {
          hash: (story.hash.slice(0, 65) + "b") as Hash,
          from: LAB_FROM,
          timeStamp: now,
          manifest: story.hash,
          valueWei: 25n * 10n ** 18n,
          forDay: printed,
        },
        ...prev,
      ]);
    });
  }, [editionDay, entries, fronts]);

  useEffect(() => {
    void (async () => {
      const cachedLikes = await listCachedLikes();
      if (cachedLikes.length) {
        setLikes((prev) => dedupeLikes([...cachedLikes, ...prev]));
      }
      // Drop retired series demo from local shelf / fronts
      for (const h of RETIRED_LAB_SERIES) {
        try {
          unpinFromShelf(h as Hash);
        } catch {
          /* */
        }
      }
      setFronts((prev) =>
        dedupeFrontBids(
          [...loadLocalFronts(), ...prev].filter((b) => !isRetiredFront(b)),
        ),
      );
      let seeded = false;
      if (isLabMode()) {
        const seed = await loadLabSeed();
        if (seed) {
          seeded = true;
          setLabNote(seed.meta.note);
          setLikes((prev) => dedupeLikes([...seed.likes, ...prev]));
          // Don’t let Lab seed steal A1 on a day you already bid
          setFronts((prev) => {
            const claimed = new Set(prev.map((b) => frontBidPrintedDay(b)));
            const extra = seed.fronts.filter(
              (f) => !claimed.has(frontBidPrintedDay(f)),
            );
            return dedupeFrontBids([...prev, ...extra]);
          });
          setEntries((prev) =>
            dedupeBySha256(mergeShelfAndRemote(seed.entries, prev)),
          );
          if (seed.likes?.length) void upsertCachedLikes(seed.likes);
        }
      }
      await loadLocalLibrary();
      const cat = await listCatalog();
      if (cat.length === 0 && !seeded) {
        await refreshLibrary();
      }
      await refreshRecentLocal();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishSource = useMemo(() => {
    const packed = packArticle(pictureText, bodyText);
    if (!packed.trim() || packed === " ") return null;
    const name =
      (title.trim() || "note").replace(/[^\w.-]+/g, "_").slice(0, 48) + ".txt";
    return new File([packed], name, { type: "text/plain;charset=utf-8" });
  }, [bodyText, pictureText, title]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!publishSource) {
        setPrepared(null);
        setGasHint(null);
        setCostWei(null);
        return;
      }
      try {
        const p = await preparePublishPayload(publishSource);
        if (cancelled) return;
        setPrepared(p);
        // Local heuristic only — no estimateGas / getGasPrice while typing
        const est = estimatePublishCostLocal({
          prepared: p,
          meta: {
            title,
            tags: parseTags(tagsRaw),
            summary,
            lang,
            license,
            replaces,
            telegram,
            twitter,
            tipWallet,
          },
        });
        if (!cancelled) {
          setCostWei(est.wei);
          setGasHint(
            `~${est.txs} txs · ~${Number(est.pls).toPrecision(3)} PLS · free est` +
              (p.encoding === "gzip" ? ` · gzip −${p.savedPct}%` : ""),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setPrepared(null);
          setCostWei(null);
          setGasHint(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    publishSource,
    title,
    tagsRaw,
    summary,
    lang,
    license,
    replaces,
    telegram,
    twitter,
    tipWallet,
  ]);

  const localHashes = useMemo(() => {
    const shelf = new Set(listShelf().map((s) => s.hash.toLowerCase()));
    for (const r of recentLocal) shelf.add(r.hash.toLowerCase());
    return shelf;
  }, [recentLocal]);

  useEffect(() => {
    if (!searchBodies || entries.length === 0) {
      setBodyByHash(new Map());
      return;
    }
    let cancelled = false;
    void buildBodyIndex(entries.map((e) => e.hash)).then((map) => {
      if (!cancelled) setBodyByHash(map);
    });
    return () => {
      cancelled = true;
    };
  }, [entries, searchBodies]);

  const filtered = useMemo(() => {
    const q = parseQuery(filter);
    let rows = entries.filter((e) => {
      if (isLocalPreviewDoc(e.from)) return false;
      if (typeFilter !== "all" && (e.type || "other") !== typeFilter) return false;
      if (scope === "local" && !localHashes.has(e.hash.toLowerCase())) return false;
      if (!applyDatePreset(e, datePreset)) return false;
      return matchEntry(e, q, {
        bodyByHash: searchBodies ? bodyByHash : undefined,
      });
    });
    rows = sortEntries(rows, sortBy);
    return rows;
  }, [
    entries,
    filter,
    typeFilter,
    scope,
    localHashes,
    datePreset,
    sortBy,
    searchBodies,
    bodyByHash,
  ]);

  const libraryCards = useMemo(
    () => collapseSeriesCards(filtered, expandSeries),
    [filtered, expandSeries],
  );

  const press = useMemo(
    () => layoutEdition(libraryCards, fronts, editionDay),
    [libraryCards, fronts, editionDay],
  );
  /** A1 race for the selected open day (default tomorrow, up to +7). */
  const openPress = useMemo(
    () => layoutEdition(libraryCards, fronts, bidForDay),
    [libraryCards, fronts, bidForDay],
  );

  const frontWinner = openPress.front;
  const editionDays = useMemo(() => listEditionDays(fronts), [fronts]);
  const minOpenDay = useMemo(() => shiftUtcDay(utcTodayKey(), 1), []);
  const maxOpenDay = useMemo(() => maxOpenEditionDay(), []);
  const a1PriceHint = useMemo(
    () =>
      formatFrontPriceHint(
        frontBidStats(openEditionBids(fronts, bidForDay)),
        bidForDay,
      ),
    [fronts, bidForDay],
  );
  const editionOpen = isOpenEdition(editionDay);

  useEffect(() => {
    const h = press.lead?.entry.hash;
    if (!h) {
      setLeadPicture("");
      return;
    }
    // Must read raw cache — bodyByHash is lowercased for search and breaks markers.
    let cancelled = false;
    void getCachedDoc(h).then((cached) => {
      if (cancelled) return;
      if (!cached?.bytes) {
        setLeadPicture("");
        return;
      }
      try {
        const text = new TextDecoder().decode(new Uint8Array(cached.bytes));
        setLeadPicture(unpackArticle(text).picture);
      } catch {
        setLeadPicture("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [press.lead?.entry.hash]);

  const shortFunds =
    !!plsBalance &&
    costWei != null &&
    plsBalance.value < (costWei * 12n) / 10n;

  const hasActiveSearch =
    !!filter.trim() ||
    typeFilter !== "text" ||
    datePreset !== "all" ||
    scope !== "all" ||
    sortBy !== "newest";

  function clearSearch() {
    setFilter("");
    setTypeFilter("text");
    setDatePreset("all");
    setScope("all");
    setSortBy("newest");
    setAuthorInput("");
  }

  /** Local look only — stays on Write; does not touch shelf / archive reader. */
  function previewLocalPost() {
    const packed = packArticle(pictureText, bodyText);
    if (!packed.trim() || packed === " ") {
      setPubError("Add a picture and/or body first.");
      return;
    }
    setPubError(null);
    setWriteMode("preview");
  }

  /** Empty Write after publish / Clear — draft must not look “still there”. */
  function resetCompose() {
    clearDraft();
    setWriteMode("compose");
    setTitle("");
    setBodyText("");
    setPictureText("");
    setTagsRaw("");
    setSummary("");
    setLang("");
    setLicense("");
    setReplaces("");
    setTelegram("");
    setTwitter("");
    setTipWallet("");
    setChunks([]);
    setPubError(null);
  }

  /** Test publish: local shelf + A1 bid on current Open day. No wallet. */
  async function publishLocalTest() {
    const packed = packArticle(pictureText, bodyText);
    if (!packed.trim() || packed === " ") {
      setPubError("Add a picture and/or body first.");
      return;
    }
    setPublishing(true);
    setPubError(null);
    try {
      const bytes = new TextEncoder().encode(packed);
      const digest = await sha256Hex(bytes);
      const manifestHash = (`0x${digest}`) as Hash;
      const mimeType = "text/plain;charset=utf-8";
      const now = Math.floor(Date.now() / 1000);
      const t = (title.trim() || "(test)").slice(0, 72);
      const tags = parseTags(tagsRaw);
      // Never use a stale date — A1 must land on a live Open day
      const forDay = isOpenPrintedDay(bidForDay)
        ? bidForDay
        : shiftUtcDay(utcTodayKey(), 1);
      setBidForDay(forDay);
      const shelfRow = {
        hash: manifestHash,
        from: LAB_FROM,
        timeStamp: now,
        title: t,
        mimeType,
        type: "text" as DocType,
        tags,
        summary: summary.trim().slice(0, 80) || undefined,
        sha256: `0x${digest}`,
        encoding: "raw" as const,
        replaces: replaces.trim() || undefined,
        chunkCount: 1,
        kind: "pulse-archive" as const,
        cw: false,
      };
      pinToShelf(shelfRow);
      await upsertCatalog([shelfRow]);
      await putCachedDoc({
        hash: manifestHash,
        mimeType,
        title: t,
        tags,
        summary: shelfRow.summary,
        type: "text",
        sha256: shelfRow.sha256,
        encoding: "raw",
        replaces: shelfRow.replaces,
        cw: false,
        telegram: telegram.trim().replace(/^@+/g, "") || undefined,
        twitter: twitter.trim().replace(/^@+/g, "") || undefined,
        tipWallet:
          tipWallet.trim() && isAddressLike(tipWallet.trim())
            ? tipWallet.trim().toLowerCase()
            : undefined,
        from: LAB_FROM,
        postedAt: now,
        chunkCount: 1,
        bytes: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
        savedAt: Date.now(),
      });
      // Floor A1 so sole publisher owns the lead until outbid
      setFronts((prev) =>
        dedupeFrontBids([
          {
            hash: (`0x${digest.slice(0, 63)}a`) as Hash,
            from: LAB_FROM,
            timeStamp: now,
            manifest: manifestHash,
            valueWei: 25n * 10n ** 18n,
            forDay,
          },
          ...prev,
        ]),
      );
      setEntries((prev) =>
        dedupeBySha256(mergeShelfAndRemote(listShelf(), prev)),
      );
      setLastManifest(manifestHash);
      resetCompose();
      closeReader();
      setEditionDay(forDay);
      setTab("library");
      void refreshRecentLocal();
    } catch (e) {
      setPubError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  function clickPublish() {
    if (walletUiOff || !isConnected || !walletClient) {
      void publishLocalTest();
      return;
    }
    void runPublish(false);
  }

  async function runPublish(resume: boolean) {
    if (!publishSource || !prepared || !walletClient || !publicClient || !address)
      return;
    setPublishing(true);
    setPubError(null);
    if (!resume) setChunks([]);
    setLastManifest(null);
    try {
      if (chainId !== pulsechain.id) {
        throw new Error("Wrong network — hit Switch to Pulse in the top bar.");
      }
      if (
        !resume &&
        costWei != null &&
        plsBalance &&
        plsBalance.value < (costWei * 12n) / 10n
      ) {
        throw new Error(
          "Not enough PLS for gas — add PLS or shorten the post.",
        );
      }
      if (!resume && prepared.sha256) {
        const known =
          entries.find((e) => e.sha256 === prepared.sha256) ||
          listShelf().find((e) => e.sha256 === prepared.sha256) ||
          (await findCatalogBySha256(prepared.sha256));
        if (known) {
          throw new Error(
            `Same text already archived (${known.hash.slice(0, 10)}…). Change the body to post again.`,
          );
        }
      }
      if (resume && incomplete && prepared.sha256 !== incomplete.sha256) {
        throw new Error(
          `Body changed — restore the stuck draft text (sha ${incomplete.sha256.slice(0, 12)}…) to retry.`,
        );
      }
      const tags = parseTags(tagsRaw);
      const { manifestHash, mimeType, chunkHashes, sha256, progress } =
        await publishPrepared({
          prepared,
          meta: {
            title,
            tags,
            summary,
            lang,
            license,
            replaces,
            telegram,
            twitter,
            tipWallet,
          },
          walletClient,
          publicClient,
          account: address,
          prior: resume
            ? incomplete?.progress?.length === prepared.parts.length
              ? incomplete.progress
              : chunks
            : undefined,
          onProgress: (p) => {
            setChunks(p);
            const row = saveIncomplete({
              id: incomplete?.id,
              title: title.trim() || publishSource.name || "(untitled)",
              sha256: prepared.sha256,
              mimeType: prepared.mimeType,
              encoding: prepared.encoding,
              originalBytes: prepared.originalBytes,
              storedBytes: prepared.storedBytes,
              partsCount: prepared.parts.length,
              progress: p,
              tagsRaw,
              note: "",
              summary,
              lang,
              license,
              replaces,
              cw: false,
            });
            setIncomplete(row);
          },
        });
      setChunks(progress);
      const shelfRow = {
        hash: manifestHash,
        from: address.toLowerCase(),
        timeStamp: Math.floor(Date.now() / 1000),
        title: title.trim() || publishSource.name || "(untitled)",
        mimeType,
        type: prepared.type,
        tags,
        summary: summary.trim() || undefined,
        sha256,
        encoding: prepared.encoding,
        replaces: replaces.trim() || undefined,
        chunkCount: chunkHashes.length,
        kind: "pulse-archive" as const,
        cw: false,
      };
      pinToShelf(shelfRow);
      await upsertCatalog([shelfRow]);
      const textBytes = new TextEncoder().encode(
        packArticle(pictureText, bodyText),
      );
      await putCachedDoc({
        hash: manifestHash,
        mimeType: mimeType || "text/plain;charset=utf-8",
        title: shelfRow.title,
        tags,
        summary: shelfRow.summary,
        type: prepared.type,
        sha256,
        encoding: prepared.encoding,
        replaces: shelfRow.replaces,
        cw: false,
        telegram: telegram.trim().replace(/^@+/g, "") || undefined,
        twitter: twitter.trim().replace(/^@+/g, "") || undefined,
        tipWallet:
          tipWallet.trim() && isAddressLike(tipWallet.trim())
            ? tipWallet.trim().toLowerCase()
            : undefined,
        from: address.toLowerCase(),
        postedAt: shelfRow.timeStamp,
        chunkCount: chunkHashes.length,
        bytes: textBytes.buffer.slice(
          textBytes.byteOffset,
          textBytes.byteOffset + textBytes.byteLength,
        ) as ArrayBuffer,
        savedAt: Date.now(),
      });
      clearIncomplete();
      setIncomplete(null);
      setLastManifest(manifestHash);
      resetCompose();
      window.location.hash = sharePath(manifestHash);
      setTab("library");
      await load(manifestHash);
      void refreshLibrary();
    } catch (e) {
      setPubError(e instanceof Error ? e.message : String(e));
      setIncomplete(loadIncomplete());
    } finally {
      setPublishing(false);
    }
  }

  async function copyCite() {
    if (!doc) return;
    const text = formatCitation({
      title: doc.title,
      from: doc.from,
      postedAt: doc.postedAt,
      manifestHash: doc.manifestHash,
      sha256: doc.sha256,
    });
    await navigator.clipboard.writeText(text);
    setCiteMsg("Citation copied");
  }

  async function tipAuthor() {
    if (!doc?.from || !walletClient || !publicClient || !address) return;
    if (wrongChain) {
      setTipError("Wrong network — hit Switch to Pulse.");
      return;
    }
    setTipping(true);
    setTipError(null);
    setTipOk(null);
    try {
      const tipTo =
        doc.tipWallet && isAddressLike(doc.tipWallet)
          ? (doc.tipWallet as `0x${string}`)
          : (doc.from as `0x${string}`);
      const to = tipTo;
      const preset = TIP_PRESETS.find((t) => t.id === tipTokenId);

      if (tipTokenId === "PLS" || (preset && !preset.address)) {
        const value = parseEther(tipAmount || "0");
        if (value <= 0n) throw new Error("Enter an amount");
        const hash = await sendTransactionAsync({
          to,
          value,
          chainId: pulsechain.id,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("Tip reverted");
        setTipOk(`Sent ${tipAmount} PLS`);
        return;
      }

      let tokenAddr: `0x${string}`;
      let decimals = preset?.decimals ?? 18;
      let symbol = preset?.symbol || "token";

      if (tipTokenId === CUSTOM_TIP_ID) {
        if (!isAddressLike(tipCustom)) {
          throw new Error("Paste a token contract 0x…");
        }
        tokenAddr = tipCustom.trim() as `0x${string}`;
        try {
          decimals = Number(
            await publicClient.readContract({
              address: tokenAddr,
              abi: erc20Abi,
              functionName: "decimals",
            }),
          );
          symbol = (await publicClient.readContract({
            address: tokenAddr,
            abi: erc20Abi,
            functionName: "symbol",
          })) as string;
        } catch {
          decimals = 18;
        }
      } else if (preset?.address) {
        tokenAddr = preset.address;
      } else {
        throw new Error("Pick a token");
      }

      const value = parseUnits(tipAmount || "0", decimals);
      if (value <= 0n) throw new Error("Enter an amount");
      const hash = await walletClient.writeContract({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, value],
        account: address,
        chain: pulsechain,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Tip reverted");
      setRecentTips(rememberTipToken(tokenAddr));
      setTipOk(`Sent ${tipAmount} ${symbol}`);
    } catch (e) {
      setTipError(e instanceof Error ? e.message : String(e));
    } finally {
      setTipping(false);
    }
  }

  async function refreshLikesOnly() {
    setLikesRefreshing(true);
    setBrowseError(null);
    try {
      const known = new Set(likes.map((l) => l.hash.toLowerCase()));
      const bundle = await listSinkBundle({
        onlyArchiveKind: false,
        maxItems: 100,
        knownHashes: known,
        stopAfterKnown: 5,
      });
      setLikes((prev) => dedupeLikes([...prev, ...bundle.likes]));
      setFronts((prev) => dedupeFrontBids([...prev, ...bundle.fronts]));
      void upsertCachedLikes(bundle.likes);
    } catch (e) {
      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      setBrowseError(
        offline
          ? "Offline — likes stay on what you already cached."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setLikesRefreshing(false);
    }
  }

  async function exportBackup() {
    try {
      const backup = await buildLocalBackup();
      downloadBackupJson(backup);
      setBackupMsg(
        `Exported ${backup.shelf.length} shelf · ${backup.catalog.length} catalog`,
      );
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function importBackupFile(file: File) {
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const n = await applyLocalBackup(raw);
      await loadLocalLibrary();
      setBackupMsg(`Imported ${n.shelf} shelf · ${n.catalog} catalog`);
    } catch (e) {
      setBackupMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function buyFrontPage() {
    if (!doc || !walletClient || !publicClient || !address) return;
    if (wrongChain) {
      setFrontError("Wrong network — hit Switch to Pulse.");
      return;
    }
    let valueWei: bigint;
    try {
      valueWei = parseEther(frontAmount || "0");
    } catch {
      setFrontError("Enter a PLS amount");
      return;
    }
    if (valueWei <= 0n) {
      setFrontError("Enter a PLS amount");
      return;
    }
    const need = frontWinner ? frontWinner.valueWei + 1n : 1n;
    if (valueWei < need) {
      setFrontError(
        frontWinner
          ? `Need more than ${formatPls(frontWinner.valueWei)} PLS to take the front`
          : "Enter a PLS amount",
      );
      return;
    }
    setFronting(true);
    setFrontError(null);
    setFrontOk(null);
    try {
      const forDay = bidForDay;
      if (!isOpenPrintedDay(forDay)) {
        throw new Error(
          `A1 only schedules ${OPEN_HORIZON_DAYS} days ahead (Sync tip depth)`,
        );
      }
      const txHash = await sendFrontBid({
        walletClient,
        publicClient,
        account: address,
        manifestHash: doc.manifestHash,
        valueWei,
        forDay,
      });
      const row: FrontBidEntry = {
        hash: txHash,
        from: address.toLowerCase(),
        timeStamp: Math.floor(Date.now() / 1000),
        manifest: doc.manifestHash.toLowerCase() as Hash,
        valueWei,
        forDay,
      };
      setFronts((prev) => dedupeFrontBids([row, ...prev]));
      setFrontOk(`A1 for ${forDay} — ${formatPls(valueWei)} PLS`);
    } catch (e) {
      setFrontError(e instanceof Error ? e.message : String(e));
      setFrontOk(null);
    } finally {
      setFronting(false);
    }
  }

  async function likeDoc() {
    if (!doc) return;
    const localTest = walletUiOff || !walletClient || !address;
    const likeFrom = localTest ? LAB_FROM : address!.toLowerCase();
    if (!localTest && wrongChain) {
      setLikeError("Wrong network — hit Switch to Pulse.");
      return;
    }
    if (hasLiked(likes, doc.manifestHash, likeFrom)) {
      setLikeError(localTest ? "Already liked (local test)" : "Already liked from this wallet");
      return;
    }
    setLiking(true);
    setLikeError(null);
    try {
      if (localTest) {
        const salt = new TextEncoder().encode(
          `${doc.manifestHash}:${likeFrom}:${Date.now()}`,
        );
        const digest = await sha256Hex(salt);
        const row = {
          hash: (`0x${digest}`) as Hash,
          from: likeFrom,
          timeStamp: Math.floor(Date.now() / 1000),
          manifest: doc.manifestHash.toLowerCase() as Hash,
        };
        setLikes((prev) => dedupeLikes([row, ...prev]));
        void upsertCachedLikes([row]);
        setLikeOk("Liked (local test)");
        setCiteMsg("Liked (local test)");
        return;
      }
      if (!walletClient || !publicClient || !address) return;
      const txHash = await sendLike({
        walletClient,
        publicClient,
        account: address,
        manifestHash: doc.manifestHash,
      });
      const row = {
        hash: txHash,
        from: address.toLowerCase(),
        timeStamp: Math.floor(Date.now() / 1000),
        manifest: doc.manifestHash.toLowerCase() as Hash,
      };
      setLikes((prev) => dedupeLikes([row, ...prev]));
      void upsertCachedLikes([row]);
      setLikeOk("Signed off — like confirmed on-chain");
      setCiteMsg("Like confirmed");
    } catch (e) {
      setLikeError(e instanceof Error ? e.message : String(e));
      setLikeOk(null);
    } finally {
      setLiking(false);
    }
  }

  const canRetry = chunks.some((c) => c.status === "error");

  useEffect(() => {
    if (!citeMsg) return;
    const t = window.setTimeout(() => setCiteMsg(null), 2200);
    return () => window.clearTimeout(t);
  }, [citeMsg]);

  useEffect(() => {
    if (!likeOk) return;
    const t = window.setTimeout(() => setLikeOk(null), 3200);
    return () => window.clearTimeout(t);
  }, [likeOk]);

  useEffect(() => {
    if (!tipOk) return;
    const t = window.setTimeout(() => setTipOk(null), 3200);
    return () => window.clearTimeout(t);
  }, [tipOk]);

  useEffect(() => {
    if (!backupMsg) return;
    const t = window.setTimeout(() => setBackupMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [backupMsg]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (tab !== "library") return;
      if (e.key === "Escape") {
        closeReader();
        return;
      }
      if (e.key !== "j" && e.key !== "k") return;
      e.preventDefault();
      const hashes = press.flat.map((c) => c.entry.hash.toLowerCase());
      if (!hashes.length) return;
      const cur = doc?.manifestHash.toLowerCase() || "";
      let idx = hashes.indexOf(cur);
      if (idx < 0) idx = e.key === "j" ? -1 : 0;
      const next =
        e.key === "j"
          ? Math.min(hashes.length - 1, idx + 1)
          : Math.max(0, idx <= 0 ? 0 : idx - 1);
      const h = press.flat[next]?.entry.hash;
      if (h) void load(h);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, press.flat, doc, load, closeReader]);

  const editionDate = useMemo(() => {
    const key = editionCursor(editionDay);
    const [y, m, d] = key.split("-").map(Number);
    const months = [
      "JANUARY",
      "FEBRUARY",
      "MARCH",
      "APRIL",
      "MAY",
      "JUNE",
      "JULY",
      "AUGUST",
      "SEPTEMBER",
      "OCTOBER",
      "NOVEMBER",
      "DECEMBER",
    ];
    return `${months[(m || 1) - 1]} ${d}, ${y}`;
  }, [editionDay]);

  const colLead = press.secondary[0] || null;
  const colMid = press.secondary[1] || press.briefs[0] || null;
  const colRight = press.briefs[press.secondary.length >= 2 ? 0 : 1] || null;
  const colARest = (
    press.secondary[0]
      ? press.briefs.slice(0, 2)
      : press.briefs.slice(0, 3)
  ).filter((c) => c.entry.hash !== colMid?.entry.hash && c.entry.hash !== colRight?.entry.hash);
  const colCRest = press.briefs
    .slice(press.secondary.length >= 2 ? 1 : 2)
    .filter(
      (c) =>
        c.entry.hash !== colMid?.entry.hash &&
        c.entry.hash !== colRight?.entry.hash &&
        !colARest.some((a) => a.entry.hash === c.entry.hash),
    )
    .slice(0, 2);

  return (
    <div className="app">
      <div className="rail">
        {tab === "library" ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setWriteMode("compose");
              setTab("post");
            }}
          >
            Write
            {incomplete ? <span className="tab-dot warn" aria-hidden /> : null}
          </button>
        ) : (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setWriteMode("compose");
              setTab("library");
            }}
          >
            Front page
          </button>
        )}
        <button
          type="button"
          className="ghost"
          disabled={browsing}
          onClick={() => void refreshLibrary()}
        >
          {browsing ? "…" : "Sync"}
        </button>
        <ThemePicker />
        {!walletUiOff && (
          <WalletBar
            onUseAsAuthor={(a) => {
              setAuthorInput(a);
              setTab("library");
            }}
          />
        )}
        {walletUiOff && (
          <span
            className="meta rail-lab"
            title="Wallet chrome off for testing (dev / lab)"
          >
            Wallet off
          </span>
        )}
      </div>

      {/* Masthead + edition ← → only on the front — not while reading (that ← looked like Back) */}
      {tab === "library" && !doc && (
        <header className="masthead">
          <div className="ornament-bar" aria-hidden>
            <span>Archive edition</span>
            <span className="ornament">⬢ ⬡ ⬡ ⬡ ⬢</span>
            <span>Archive edition</span>
          </div>
          <h1 className="nameplate">Heart’s Archive</h1>
          <hr className="double-rule" />
          <div className="edition-line">
            <span>Est · Pulse</span>
            <span>On-chain press</span>
            <span className="edition-nav">
              <button
                type="button"
                className="edition-arrow"
                aria-label="Earlier edition"
                title="Earlier"
                disabled={
                  editionCursor(editionDay) <=
                  (editionDays[editionDays.length - 1] ||
                    shiftUtcDay(utcTodayKey(), -30))
                }
                onClick={() => {
                  const c = editionCursor(editionDay);
                  const today = utcTodayKey();
                  const prev = shiftUtcDay(c, -1);
                  setEditionDay(prev);
                  if (prev > today) setBidForDay(prev);
                }}
              >
                ←
              </button>
              <button
                type="button"
                className="edition-date-btn"
                title={
                  editionOpen
                    ? `Open paper — A1 up to +${OPEN_HORIZON_DAYS}d (Sync tip)`
                    : "Jump to today’s closed final"
                }
                onClick={() => setEditionDay(utcTodayKey())}
              >
                {editionDate}
                {editionOpen ? " · Open" : " · Final"}
              </button>
              <button
                type="button"
                className="edition-arrow"
                aria-label="Later open edition"
                title={`Later open (max +${OPEN_HORIZON_DAYS}d)`}
                disabled={editionCursor(editionDay) >= maxOpenDay}
                onClick={() => {
                  const today = utcTodayKey();
                  const c = editionCursor(editionDay);
                  const next =
                    c <= today
                      ? shiftUtcDay(today, 1)
                      : shiftUtcDay(c, 1);
                  if (next > maxOpenDay) return;
                  setEditionDay(next);
                  setBidForDay(next);
                }}
              >
                →
              </button>
            </span>
          </div>
          <hr className="double-rule" />
        </header>
      )}

      {tab === "library" && (
        <section className="panel page library-page">
          <details className="filters-drawer">
            <summary>Search &amp; tools</summary>
            <div className="filters-body">
              <input
                className="grow"
                type="text"
                placeholder="Search…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                spellCheck={false}
                style={{ maxWidth: "100%", flex: "1 1 14rem" }}
              />
              {hasActiveSearch && (
                <button type="button" className="ghost" onClick={clearSearch}>
                  Clear
                </button>
              )}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Type"
              >
                <option value="text">text</option>
                <option value="all">all (feed)</option>
                <option value="json">json</option>
                <option value="html">html</option>
                <option value="other">other</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SearchSort)}
                aria-label="Sort"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
              </select>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                aria-label="Date"
              >
                <option value="all">Any time</option>
                <option value="7d">7d</option>
                <option value="30d">30d</option>
              </select>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as SearchScope)}
                aria-label="Scope"
              >
                <option value="all">All</option>
                <option value="local">Local</option>
              </select>
              <input
                type="text"
                placeholder="Author 0x…"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value.trim())}
                spellCheck={false}
              />
              <button
                type="button"
                className="ghost"
                disabled={likesRefreshing || browsing}
                onClick={() => void refreshLikesOnly()}
              >
                {likesRefreshing ? "…" : "Likes"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => void exportBackup()}
              >
                Export
              </button>
              <label className="ghost file-btn" title="Import backup JSON">
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void importBackupFile(f);
                  }}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={labOn}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setLabMode(on);
                    setLabOn(on);
                    if (!on) setLabNote(undefined);
                    else {
                      void loadLabSeed().then((seed) => {
                        if (!seed) return;
                        setLabNote(seed.meta.note);
                        setLikes((prev) =>
                          dedupeLikes([...seed.likes, ...prev]),
                        );
                        setFronts((prev) => {
                          const claimed = new Set(
                            prev.map((b) => frontBidPrintedDay(b)),
                          );
                          const extra = seed.fronts.filter(
                            (f) => !claimed.has(frontBidPrintedDay(f)),
                          );
                          return dedupeFrontBids([...prev, ...extra]);
                        });
                        setEntries((prev) =>
                          dedupeBySha256(
                            mergeShelfAndRemote(seed.entries, prev),
                          ),
                        );
                      });
                    }
                  }}
                />
                Lab seed
              </label>
              <details className="hash-open" style={{ width: "100%" }}>
                <summary>Open by link</summary>
                <div className="row">
                  <input
                    type="text"
                    placeholder="Paste 0x… or #/369/0x…"
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value.trim())}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="primary"
                    disabled={reading || !parseRouteHash(hashInput)}
                    onClick={() => {
                      const h = parseRouteHash(hashInput);
                      if (h) void load(h);
                    }}
                  >
                    {reading ? "…" : "Open"}
                  </button>
                </div>
              </details>
            </div>
          </details>
          {backupMsg && <p className="meta">{backupMsg}</p>}
          {browseError && <p className="status bad">{browseError}</p>}
          {labNote && labOn && (
            <p className="meta lab-banner">{labNote}</p>
          )}

          {!(doc && !isLocalPreviewDoc(doc.from)) && !reading && (
            <>
              {!browsing && filtered.length === 0 ? (
                <div className="empty first-path">
                  <p className="empty-title">No stories in this edition</p>
                  <ol className="empty-steps">
                    <li>Connect on Pulse</li>
                    <li>Write · Publish</li>
                    <li>Sync the feed</li>
                    <li>Buy A1 with PLS to own the lead</li>
                  </ol>
                </div>
              ) : (
                <div className="broadsheet">
                  {press.lead ? (
                    <>
                      <SoftHeld
                        hit={softMuteHit(
                          press.lead.entry.title,
                          press.lead.entry.summary,
                          leadPicture,
                        )}
                      >
                        <button
                          type="button"
                          className="a1-banner"
                          onClick={() => void load(press.lead!.entry.hash)}
                        >
                          <span className="a1-hed">
                            {press.lead.entry.title}
                          </span>
                          {press.lead.entry.summary && (
                            <span className="a1-dek">
                              {press.lead.entry.summary}
                            </span>
                          )}
                        </button>
                      </SoftHeld>
                      {leadPicture.trim() ? (
                        <button
                          type="button"
                          className="a1-cut"
                          onClick={() => void load(press.lead!.entry.hash)}
                          aria-label="Open lead story"
                        >
                          <TypeCutPicture
                            text={leadPicture}
                            className="a1-cut-pic"
                          />
                        </button>
                      ) : null}
                      <p className="a1-byline">
                        By {shortAddr(press.lead.entry.from)}
                        {formatPostedAt(press.lead.entry.timeStamp)
                          ? ` · ${formatPostedAt(press.lead.entry.timeStamp)}`
                          : ""}
                        {press.front &&
                        press.front.manifest.toLowerCase() ===
                          press.lead.entry.hash.toLowerCase()
                          ? editionOpen
                            ? ` · A1 ${formatPls(press.front.valueWei)} PLS (open)`
                            : ` · A1 ${formatPls(press.front.valueWei)} PLS (final)`
                          : ""}
                        {` · ${likeCounts.get(press.lead.entry.hash.toLowerCase()) || 0} likes`}
                        {" · Continued inside →"}
                      </p>
                    </>
                  ) : editionOpen ? (
                    <div className="a1-unpublished">
                      <p className="a1-hed">Tomorrow’s paper — unpublished</p>
                      <p className="a1-dek">
                        No A1 bid yet today. Bid PLS on a story to set the lead
                        before UTC midnight.
                      </p>
                    </div>
                  ) : null}
                  <hr className="single-rule" />
                  <div className="a1-grid">
                    <div className="a1-col">
                      {colLead ? (
                        <SoftHeld
                          hit={softMuteHit(
                            colLead.entry.title,
                            colLead.entry.summary,
                          )}
                        >
                          <button
                            type="button"
                            className="story-item lead-col"
                            onClick={() => void load(colLead.entry.hash)}
                          >
                            <span className="a1-col-hed">
                              {colLead.entry.title}
                            </span>
                            {colLead.entry.summary && (
                              <span className="story-dek">
                                {colLead.entry.summary}
                              </span>
                            )}
                            <span className="story-meta">
                              {shortAddr(colLead.entry.from)} ·{" "}
                              {likeCounts.get(
                                colLead.entry.hash.toLowerCase(),
                              ) || 0}{" "}
                              likes
                            </span>
                          </button>
                        </SoftHeld>
                      ) : (
                        <p className="a1-col-hed">Inside</p>
                      )}
                      <div className="story-stack">
                        {colARest.map(({ entry: e }) => (
                          <SoftHeld
                            key={e.hash}
                            hit={softMuteHit(e.title, e.summary)}
                          >
                            <button
                              type="button"
                              className="story-item"
                              onClick={() => void load(e.hash)}
                            >
                              <span className="story-hed">{e.title}</span>
                              {e.summary && (
                                <span className="story-dek">{e.summary}</span>
                              )}
                              <span className="story-meta">
                                {shortAddr(e.from)}
                              </span>
                            </button>
                          </SoftHeld>
                        ))}
                      </div>
                    </div>
                    <div className="a1-col a1-col-mid">
                      {colMid ? (
                        <SoftHeld
                          hit={softMuteHit(
                            colMid.entry.title,
                            colMid.entry.summary,
                          )}
                        >
                          <button
                            type="button"
                            className="story-item mid-wrap"
                            onClick={() => void load(colMid.entry.hash)}
                          >
                            {colMid.entry.summary && (
                              <span className="story-dek mid-dek-top">
                                {colMid.entry.summary.slice(0, 120)}
                                {colMid.entry.summary.length > 120 ? "…" : ""}
                              </span>
                            )}
                            <span className="story-hed mid-hed">
                              {colMid.entry.title}
                            </span>
                            <span className="story-meta">
                              {shortAddr(colMid.entry.from)}
                            </span>
                          </button>
                        </SoftHeld>
                      ) : (
                        <p className="story-meta">More stories after Sync.</p>
                      )}
                    </div>
                    <div className="a1-col">
                      {colRight ? (
                        <SoftHeld
                          hit={softMuteHit(
                            colRight.entry.title,
                            colRight.entry.summary,
                          )}
                        >
                          <button
                            type="button"
                            className="story-item"
                            onClick={() => void load(colRight.entry.hash)}
                          >
                            <span className="story-hed right-hed">
                              {colRight.entry.title}
                            </span>
                            {colRight.entry.summary && (
                              <span className="story-dek">
                                {colRight.entry.summary}
                              </span>
                            )}
                            <span className="story-meta">
                              {shortAddr(colRight.entry.from)}
                            </span>
                          </button>
                        </SoftHeld>
                      ) : null}
                      <div className="story-stack">
                        {colCRest.map(({ entry: e }) => (
                          <button
                            key={e.hash}
                            type="button"
                            className="story-item"
                            onClick={() => void load(e.hash)}
                          >
                            <span className="story-hed">{e.title}</span>
                            <span className="story-meta">
                              {shortAddr(e.from)}
                            </span>
                          </button>
                        ))}
                        {!colMid && !colRight && !colLead && (
                          <p className="story-meta">More stories after Sync.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {(doc || reading || readError) &&
            !isLocalPreviewDoc(doc?.from) && (
            <div className="interior">
              <button
                type="button"
                className="interior-back"
                onClick={() => closeReader()}
              >
                ← Front page
              </button>
              {readError && (
                <div className="status-block bad">
                  <p className="status bad">{readError}</p>
                </div>
              )}
              {reading && !doc && (
                <p className="meta">Loading from Pulse…</p>
              )}
              {doc && (
                <article className="article article-full">
                  <p className="side-label">Full article</p>
                  <h2 className="doc-title">
                    {doc.title || "(untitled)"}
                  </h2>
                  <p className="article-byline">
                    {isLabTestDoc(doc.from)
                      ? "local test"
                      : doc.from
                        ? shortAddr(doc.from)
                        : "unknown"}
                    {formatPostedAt(doc.postedAt)
                      ? ` · ${formatPostedAt(doc.postedAt)}`
                      : ""}
                    {` · ${likeCounts.get(doc.manifestHash.toLowerCase()) || 0} likes`}
                  </p>
                  {(doc.telegram || doc.twitter || doc.tipWallet) && (
                    <p className="article-contact meta">
                      {telegramUrl(doc.telegram) && (
                        <a
                          href={telegramUrl(doc.telegram)!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          TG {displayHandle(doc.telegram)}
                        </a>
                      )}
                      {twitterUrl(doc.twitter) && (
                        <a
                          href={twitterUrl(doc.twitter)!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          X {displayHandle(doc.twitter)}
                        </a>
                      )}
                      {doc.tipWallet && isAddressLike(doc.tipWallet)
                        ? ` · tip ${shortAddr(doc.tipWallet)}`
                        : ""}
                    </p>
                  )}
                  <div className="reader-actions">
                    <button
                      type="button"
                      className={
                        hasLiked(
                          likes,
                          doc.manifestHash,
                          walletUiOff || !address ? LAB_FROM : address,
                        )
                          ? "primary"
                          : "ghost"
                      }
                      disabled={
                        liking ||
                        (!walletUiOff &&
                          (!isConnected ||
                            wrongChain ||
                            !walletClient)) ||
                        hasLiked(
                          likes,
                          doc.manifestHash,
                          walletUiOff || !address ? LAB_FROM : address,
                        )
                      }
                      onClick={() => void likeDoc()}
                      title={
                        walletUiOff || !address
                          ? "Local test like — not on-chain"
                          : "Burns ≥1 PLS to …feed · extra PLS still one like"
                      }
                    >
                      {liking
                        ? "…"
                        : `Like · 1 PLS · ${likeCounts.get(doc.manifestHash.toLowerCase()) || 0}`}
                    </button>
                    {doc.from && isConnected && (
                      <>
                        <input
                          type="text"
                          value={tipAmount}
                          onChange={(e) => setTipAmount(e.target.value)}
                          aria-label="Tip amount"
                          placeholder="Amt"
                          style={{ maxWidth: "4.5rem" }}
                        />
                        <select
                          value={tipTokenId}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v.startsWith("recent:")) {
                              setTipTokenId(CUSTOM_TIP_ID);
                              setTipCustom(v.slice("recent:".length));
                              return;
                            }
                            setTipTokenId(v);
                          }}
                          aria-label="Tip token"
                        >
                          {TIP_PRESETS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.symbol}
                            </option>
                          ))}
                          {recentTips.map((a) => (
                            <option key={a} value={`recent:${a}`}>
                              Recent {shortAddr(a)}
                            </option>
                          ))}
                          <option value={CUSTOM_TIP_ID}>Custom…</option>
                        </select>
                        <button
                          type="button"
                          className="ghost"
                          disabled={wrongChain || tipping || !walletClient}
                          onClick={() => void tipAuthor()}
                          title="Tip the writer any Pulse asset — publish/A1 stay PLS-only"
                        >
                          {tipping ? "…" : "Tip"}
                        </button>
                      </>
                    )}
                  </div>
                  {likeError && <p className="status bad">{likeError}</p>}
                  {likeOk && <p className="status ok">{likeOk}</p>}
                  {tipError && <p className="status bad">{tipError}</p>}
                  {tipOk && <p className="status ok">{tipOk}</p>}
                  {isConnected && (
                    <div className="front-bid-bar">
                      <span className="front-bid-label">
                        {frontWinner &&
                        frontWinner.manifest.toLowerCase() ===
                          doc.manifestHash.toLowerCase()
                          ? `Leading ${bidForDay} A1 · ${formatPls(frontWinner.valueWei)} PLS — rebid if outbid`
                          : frontWinner
                            ? `${bidForDay} A1 is ${formatPls(frontWinner.valueWei)} PLS — bid more to take it`
                            : `${bidForDay} A1 open — set the lead with PLS`}
                      </span>
                      <input
                        type="date"
                        value={bidForDay}
                        min={minOpenDay}
                        max={maxOpenDay}
                        onChange={(e) => {
                          const d = e.target.value;
                          if (!isOpenPrintedDay(d)) return;
                          setBidForDay(d);
                          setEditionDay(d);
                        }}
                        aria-label="Open edition day for A1"
                      />
                      <input
                        type="text"
                        value={frontAmount}
                        onChange={(e) => setFrontAmount(e.target.value)}
                        aria-label="Front page PLS bid"
                        placeholder="PLS"
                      />
                      <button
                        type="button"
                        className="primary"
                        disabled={
                          fronting ||
                          wrongChain ||
                          !walletClient ||
                          !publicClient
                        }
                        onClick={() => void buyFrontPage()}
                      >
                        {fronting ? "…" : "Buy A1"}
                      </button>
                    </div>
                  )}
                  {frontError && <p className="status bad">{frontError}</p>}
                  {frontOk && <p className="status ok">{frontOk}</p>}
                  <details className="more reader-more">
                    <summary>Cite &amp; tools</summary>
                    <div className="row wrap">
                      <a
                        href={doc.objectUrl}
                        download={`pulse-doc-${doc.manifestHash.slice(2, 10)}`}
                      >
                        <button type="button" className="ghost">
                          Save
                        </button>
                      </a>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void copyCite()}
                      >
                        Cite
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            shareUrl(doc.manifestHash),
                          )
                        }
                      >
                        Link
                      </button>
                      <a
                        href={SCAN_TX(doc.manifestHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="ghost link-btn"
                      >
                        Tx
                      </a>
                    </div>
                  </details>
                  <div className="preview">
                    <Preview doc={doc} />
                  </div>
                </article>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "post" && (
        <section className="panel page">
          <button
            type="button"
            className="ghost edition-back"
            onClick={() => {
              setWriteMode("compose");
              setTab("library");
            }}
          >
            ← Back to edition
          </button>
          {incomplete && (
            <div className="incomplete-rail">
              <p className="meta" style={{ margin: 0 }}>
                <strong>Publish paused</strong> — “{incomplete.title}” is{" "}
                {incompleteDoneCount(incomplete)} of {incomplete.partsCount}{" "}
                done. Don’t change the text — hit Retry to finish, or Give up
                to drop it.
              </p>
              <div className="row wrap" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="primary"
                  disabled={
                    publishing ||
                    !prepared ||
                    prepared.sha256 !== incomplete.sha256 ||
                    !walletClient
                  }
                  onClick={() => void runPublish(true)}
                >
                  {publishing ? "Finishing…" : "Retry"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={publishing}
                  onClick={() => {
                    clearIncomplete();
                    setIncomplete(null);
                    setChunks([]);
                  }}
                >
                  Give up
                </button>
              </div>
              {prepared && prepared.sha256 !== incomplete.sha256 && (
                <p className="status bad" style={{ margin: "0.35rem 0 0" }}>
                  Text changed — paste the original draft back to Retry.
                </p>
              )}
            </div>
          )}
          {writeMode === "preview" ? (
            <div className="write-preview">
              <div className="preview-local-banner">
                <p className="meta" style={{ margin: 0 }}>
                  Preview — A1 lead, inside card, and full article. Nothing
                  on-chain yet.
                </p>
                <div className="row wrap" style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setWriteMode("compose")}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={!prepared || publishing}
                    onClick={() => clickPublish()}
                    title={
                      walletUiOff || !isConnected
                        ? "Local test — front page, not on-chain"
                        : undefined
                    }
                  >
                    {publishing ? "…" : "Publish"}
                  </button>
                </div>
              </div>
              {pubError && <p className="status bad">{pubError}</p>}
              <div className="write-preview-faces">
                <section className="write-preview-face write-preview-face--a1">
                  <p className="side-label">If you win A1</p>
                  <div className="broadsheet write-preview-mock">
                    <div className="a1-banner" role="presentation">
                      <span className="a1-hed">
                        {title.trim() || "(untitled)"}
                      </span>
                      {summary.trim() ? (
                        <span className="a1-dek">{summary.trim()}</span>
                      ) : null}
                    </div>
                    {pictureText.trim() ? (
                      <div className="a1-cut" role="presentation">
                        <TypeCutPicture
                          text={pictureText}
                          className="a1-cut-pic"
                        />
                      </div>
                    ) : null}
                    <p className="a1-byline">
                      By {address ? shortAddr(address) : "you"}
                      {" · A1 preview · Continued inside →"}
                    </p>
                  </div>
                </section>
                <section className="write-preview-face write-preview-face--inside">
                  <p className="side-label">If you don’t get A1</p>
                  <div className="a1-col write-preview-mock">
                    <div className="story-item lead-col" role="presentation">
                      <span className="a1-col-hed">
                        {title.trim() || "(untitled)"}
                      </span>
                      {summary.trim() ? (
                        <span className="story-dek">{summary.trim()}</span>
                      ) : null}
                      <span className="story-meta">
                        {address ? shortAddr(address) : "you"} · inside card
                      </span>
                    </div>
                  </div>
                  <p className="meta write-preview-note">
                    Column / brief face — no A1 banner, picture stays inside the
                    full article.
                  </p>
                </section>
              </div>
              <article className="article article-preview">
                <p className="side-label">Full article</p>
                <h2 className="doc-title">{title.trim() || "(untitled)"}</h2>
                <p className="article-byline">Local preview · not published</p>
                {summary.trim() ? (
                  <p className="a1-dek write-preview-dek">{summary.trim()}</p>
                ) : null}
                {(telegram.trim() ||
                  twitter.trim() ||
                  tipWallet.trim()) && (
                  <p className="article-contact meta">
                    {telegramUrl(telegram) && (
                      <a
                        href={telegramUrl(telegram)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        TG {displayHandle(telegram)}
                      </a>
                    )}
                    {twitterUrl(twitter) && (
                      <a
                        href={twitterUrl(twitter)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        X {displayHandle(twitter)}
                      </a>
                    )}
                    {tipWallet.trim() && isAddressLike(tipWallet.trim())
                      ? ` · tip ${shortAddr(tipWallet.trim())}`
                      : ""}
                  </p>
                )}
                <SoftHeld
                  hit={softMuteHit(title, pictureText, bodyText)}
                  label="Read anyway"
                >
                  <div className="article-stack">
                    {pictureText.trim() ? (
                      <TypeCutPicture
                        text={pictureText}
                        className="article-picture"
                      />
                    ) : null}
                    {bodyText.trim() || !pictureText.trim() ? (
                      <pre className="article-body">{bodyText}</pre>
                    ) : null}
                  </div>
                </SoftHeld>
              </article>
            </div>
          ) : (
          <div className="post-layout">
            <div className="post-compose">
              <div className="row">
                <input
                  type="text"
                  placeholder="Title · max 72 chars"
                  maxLength={72}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="compose-picture">
                <div className="compose-picture-head">
                  <p className="meta type-cut-hint">
                    Picture (type cut) — optional · paste ASCII · click to edit
                  </p>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      void (async () => {
                        try {
                          await copyAsciiArtPrompt();
                          setAsciiPromptMsg(
                            "Prompt copied — paste into any AI with your image",
                          );
                        } catch {
                          setAsciiPromptMsg(
                            "Copy failed — open /ascii-art-prompt.txt",
                          );
                        }
                      })();
                    }}
                  >
                    Copy AI prompt
                  </button>
                </div>
                {asciiPromptMsg && (
                  <p className="meta">{asciiPromptMsg}</p>
                )}
                <textarea
                  className="type-cut-paste compose-paste"
                  rows={Math.min(
                    28,
                    Math.max(10, pictureText.split("\n").length + 2),
                  )}
                  spellCheck={false}
                  wrap="off"
                  placeholder="Paste ASCII here, then click and edit by hand…"
                  aria-label="ASCII picture — editable"
                  value={pictureText}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (!text.trim()) return;
                    e.preventDefault();
                    setPictureText(normalizeTypeCut(text));
                  }}
                  onChange={(e) => setPictureText(e.target.value)}
                  onBlur={() => {
                    if (pictureText.trim()) {
                      setPictureText(normalizeTypeCut(pictureText));
                    }
                  }}
                />
                {pictureText.trim() ? (
                  <>
                    <TypeCutPicture
                      text={pictureText}
                      className="compose-picture-fit"
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setPictureText("")}
                    >
                      Remove picture
                    </button>
                  </>
                ) : null}
              </div>
              <textarea
                placeholder="Body — story text below the picture…"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={12}
              />
            </div>
            <aside className="post-side">
              <div className="post-side-card">
                <p className="side-label">Ready</p>
                {prepared ? (
                  <ul className="side-stats">
                    <li>{(prepared.originalBytes / 1024).toFixed(1)} KB</li>
                    <li>
                      {prepared.encoding === "gzip"
                        ? `gz −${prepared.savedPct}%`
                        : "raw"}
                    </li>
                    <li>{prepared.parts.length + 1} txs</li>
                    <li>cap {MAX_PUBLISH_BYTES / 1024} KB</li>
                  </ul>
                ) : (
                  <p className="meta">
                    {gasHint && !prepared
                      ? gasHint
                      : "Type some text (under cap)."}
                  </p>
                )}
                {gasHint && prepared && (
                  <p className="meta">{gasHint}</p>
                )}
                {shortFunds && prepared && (
                  <p className="status bad">
                    Not enough PLS for gas — add PLS or shorten the post.
                  </p>
                )}
                <label className="post-meta-field">
                  <span>Open edition</span>
                  <input
                    type="date"
                    value={bidForDay}
                    min={minOpenDay}
                    max={maxOpenDay}
                    onChange={(e) => {
                      const d = e.target.value;
                      if (!isOpenPrintedDay(d)) return;
                      setBidForDay(d);
                    }}
                    aria-label="Which open paper to publish into"
                  />
                </label>
                <div className="post-actions">
                  <button
                    type="button"
                    className="ghost"
                    disabled={!publishSource}
                    onClick={() => previewLocalPost()}
                    title="Local look only — does not publish on-chain"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={!prepared || publishing}
                    onClick={() => clickPublish()}
                    title={
                      walletUiOff || !isConnected
                        ? "Local test — front page, not on-chain"
                        : undefined
                    }
                  >
                    {publishing ? "…" : "Publish"}
                  </button>
                  {canRetry && (
                    <button
                      type="button"
                      disabled={publishing || !walletClient}
                      onClick={() => void runPublish(true)}
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => resetCompose()}
                  >
                    Clear
                  </button>
                </div>
                <p className="meta a1-price-hint">{a1PriceHint}</p>
                <p className="meta">
                  Preview = faces only. Publish = local test front page (no
                  wallet). Chain publish only if a wallet is connected.
                </p>
                {wrongChain && isConnected && (
                  <p className="status bad">
                    Wrong network — hit Switch to Pulse in the top bar.
                  </p>
                )}
                {pubError && <p className="status bad">{pubError}</p>}
              </div>
              <div className="post-side-card post-meta-card">
                <p className="side-label">Details</p>
                <p className="meta post-meta-lead">
                  Optional — helps readers find and tip you.
                </p>
                <label className="post-meta-field">
                  <span>Summary</span>
                  <input
                    type="text"
                    placeholder="One-line dek · max 80"
                    maxLength={80}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                  <span className="post-meta-hint">
                    {summary.length}/80 · A1 one-liner only
                  </span>
                </label>
                <label className="post-meta-field">
                  <span>Tags</span>
                  <input
                    type="text"
                    placeholder="hex, news  or  #hex #news"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                  />
                  <span className="post-meta-hint">Comma or # — both fine</span>
                </label>
                <div className="post-meta-row">
                  <label className="post-meta-field">
                    <span>Language</span>
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value)}
                    >
                      {withCurrentOption(LANG_OPTIONS, lang).map((o) => (
                        <option key={o.value || "lang-empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="post-meta-field">
                    <span>License</span>
                    <select
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                    >
                      {withCurrentOption(LICENSE_OPTIONS, license).map((o) => (
                        <option key={o.value || "lic-empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="post-meta-field">
                  <span>Telegram</span>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
                <label className="post-meta-field">
                  <span>Twitter / X</span>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
                <label className="post-meta-field">
                  <span>Tip wallet</span>
                  <input
                    type="text"
                    placeholder="0x… (optional — else your publish address)"
                    value={tipWallet}
                    onChange={(e) => setTipWallet(e.target.value.trim())}
                    spellCheck={false}
                  />
                </label>
                <label className="post-meta-field">
                  <span>Replaces</span>
                  <input
                    type="text"
                    placeholder="0x… prior story (series)"
                    value={replaces}
                    onChange={(e) => setReplaces(e.target.value.trim())}
                    spellCheck={false}
                  />
                </label>
              </div>
              {lastManifest && (
                <div className="live-strip post-side-card">
                  <p className="status ok" style={{ margin: 0 }}>
                    You’re live
                  </p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setWriteMode("compose");
                      setTab("library");
                      void load(lastManifest);
                    }}
                  >
                    Open full article
                  </button>
                  <a
                    className="ghost link-btn"
                    href={SCAN_TX(lastManifest)}
                    target="_blank"
                    rel="noreferrer"
                    title={lastManifest}
                  >
                    Tx
                  </a>
                </div>
              )}
              {chunks.length > 0 && (
                <div className="chunks">
                  {chunks.map((c) => (
                    <div key={c.index} className={`chip ${c.status}`}>
                      {c.index + 1}/{c.total} {c.status}
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
          )}
        </section>
      )}

      {citeMsg && <div className="toast">{citeMsg}</div>}
    </div>
  );
}
