import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { isDeskFace } from "./archiveFace";
import { minA1Wei } from "./FrontBidBar";
import { ArchiveUiProvider } from "./archiveUi";
import { LibraryPage } from "./views/LibraryPage";
import { PostPage } from "./views/PostPage";
import { computeSyncLimits } from "./syncLimits";
import {
  DUEL_A,
  DUEL_B,
  DUEL_C,
  DUEL_D,
  buildDuelRounds,
  makeDuelStory,
  mergeDuelDayBids,
  storiesForDuelDay,
} from "./deskDuel";
import {
  LAB_FROM,
  isLocalPreviewDoc,
} from "./uiBits";
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
  groupInsideByLetter,
} from "./frontPage";
import {
  bidsForPrintedDay,
  editionCursor,
  isOpenEdition,
  isOpenPrintedDay,
  layoutEdition,
  maxOpenEditionDay,
  openEditionBids,
  OPEN_HORIZON_DAYS,
  SYNC_LOOKBACK_DAYS,
  shiftUtcDay,
  utcDayKey,
  utcTodayKey,
  type EditionView,
} from "./editions";
import { getCachedDoc, listCachedSummaries, putCachedDoc } from "./cache";
import {
  findCatalogBySha256,
  listCatalog,
  upsertCatalog,
} from "./catalog";
import { loadLocalCatalog } from "./catalogLocal";
import { loadLabSeed } from "./labSeed";
import {
  buildPublishGuide,
  isPublishGuideEntry,
  publishGuideHashForDay,
} from "./howToGuide";
import { isLabMode, labOpenedViaQuery, setLabMode } from "./labMode";
import { listCachedLikes, upsertCachedLikes } from "./likesCache";
import { clearDraft, loadDraft, saveDraft } from "./drafts";
import {
  clearIncomplete,
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
  sharePath,
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
  /** Phone Search sheet — controlled so the bottom tab can open it. */
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
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
  /** Broadsheet page face — A / B / C… (not URL hash). */
  const [paperPage, setPaperPage] = useState("A");
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
  /**
   * Desk face (npm run dev): no wallet gatekeeping — local publish.
   * Press face (npm run build / dev:press): wallets on unless Lab seed.
   * Same repo — not a second GitHub.
   */
  const deskFace = isDeskFace();
  const walletUiOff = deskFace || labOn;
  const entriesRef = useRef(entries);
  const openHashRef = useRef<string | null>(null);
  const loadRef = useRef<
    (h: Hash, opts?: { goRead?: boolean }) => Promise<boolean>
  >(async () => false);
  const refreshLibraryRef = useRef<
    ((opts?: { mode?: "manual" | "publish" }) => Promise<void>) | null
  >(null);

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
      if (stuck.bodyText != null) setBodyText(stuck.bodyText);
      if (stuck.pictureText != null) setPictureText(stuck.pictureText);
      setTab("post");
      setWriteMode("compose");
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
    async (manifestHash: Hash, opts?: { goRead?: boolean }): Promise<boolean> => {
      const key = manifestHash.toLowerCase();
      // Same doc already showing — don't tear down reader (stops flash)
      if (openHashRef.current === key && opts?.goRead !== false) {
        return true;
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
          return true;
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
          return false;
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
        return true;
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
        return false;
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
  const refreshLibrary = useCallback(
    async (opts?: { mode?: "manual" | "publish" }) => {
      const mode = opts?.mode ?? "manual";
      let lastSyncMs = 0;
      try {
        lastSyncMs = Number(
          localStorage.getItem("hearts-archive-last-sync") || "0",
        );
        if (lastSyncMs && Date.now() - lastSyncMs < 20_000) {
          if (mode === "manual") {
            setBrowseError("Sync cooling down — try again in a few seconds.");
          }
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

        const {
          cold,
          cutoff,
          maxItems,
          maxPages,
          stopAfterKnown,
          pageGapMs,
        } = computeSyncLimits(lastSyncMs || null);
        void cold;

        if (/^0x[a-fA-F0-9]{40}$/.test(author)) {
          const remote = await listArchiveFromAuthor(author as `0x${string}`, {
            maxItems,
            maxPages,
            knownHashes,
            stopOlderThanUnix: cutoff,
            stopAfterKnown,
            pageGapMs,
          });
          await upsertCatalog(remote);
          setEntries(dedupeBySha256(mergeShelfAndRemote(base, remote)));
          const bundle = await listSinkBundle({
            onlyArchiveKind: false,
            maxItems,
            maxPages,
            knownHashes,
            stopOlderThanUnix: cutoff,
            stopAfterKnown,
            pageGapMs,
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
            stopAfterKnown,
            pageGapMs,
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
        const raw = e instanceof Error ? e.message : String(e);
        const aborted =
          (e instanceof Error && e.name === "AbortError") ||
          /aborted|AbortError/i.test(raw);
        const detail = offline
          ? "You’re offline"
          : aborted
            ? "Pulse explorer timed out (retried) — try Sync again"
            : raw || "Sync failed";
        if (!base.length) {
          setBrowseError(
            mode === "manual"
              ? aborted
                ? "Couldn’t reach Pulse explorer after retries — try Sync again in a bit."
                : `${detail} — nothing on this device yet. Write locally or Sync when Scan is up.`
              : null,
          );
        } else {
          setBrowseError(
            `${detail} — still showing your local library (${base.length}).`,
          );
        }
        setEntries(base);
      } finally {
        setBrowsing(false);
        void refreshRecentLocal();
      }
    },
    [authorInput, archiveOnly, refreshRecentLocal, likes, fronts],
  );

  useEffect(() => {
    refreshLibraryRef.current = refreshLibrary;
  }, [refreshLibrary]);

  const openShare = useCallback(async (h: Hash) => {
    setHashInput(h);
    setTab("library");
    let ok = await loadRef.current(h);
    if (ok) return;
    // Missing locally / RPC miss — Sync tip once, then reopen (no chain write).
    await refreshLibraryRef.current?.({ mode: "manual" });
    ok = await loadRef.current(h);
    if (!ok) {
      setReadError(
        (prev) =>
          prev ||
          "Couldn’t open this link — Sync again when the explorer is up, or check the hash.",
      );
    }
  }, []);

  useEffect(() => {
    const fromRoute = parseRouteHash(window.location.hash);
    if (fromRoute) {
      void openShare(fromRoute);
    }
    const onHash = () => {
      const h = parseRouteHash(window.location.hash);
      if (h) {
        void openShare(h);
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
      if (isLabMode()) {
        const seed = await loadLabSeed();
        if (seed) {
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
      // Empty Open paper → local “how to publish” article (not on-chain)
      try {
        const openDay = shiftUtcDay(utcTodayKey(), 1);
        const guideHash = await publishGuideHashForDay(openDay);
        const openBids = bidsForPrintedDay(loadLocalFronts(), openDay);
        const [staticCat, idbCat] = await Promise.all([
          loadLocalCatalog(),
          listCatalog(),
        ]);
        const known = dedupeBySha256(
          mergeShelfAndRemote(
            mergeShelfAndRemote(listShelf(), staticCat),
            idbCat,
          ),
        );
        const byHash = new Map(
          known.map((e) => [e.hash.toLowerCase(), e] as const),
        );
        const isGuideBid = (b: (typeof openBids)[number]) => {
          if (b.manifest.toLowerCase() === guideHash.toLowerCase()) return true;
          const ent = byHash.get(b.manifest.toLowerCase());
          return !!ent && isPublishGuideEntry(ent);
        };
        const hasRealOpenStory = openBids.some((b) => !isGuideBid(b));
        const deep = parseRouteHash(window.location.hash);
        if (!hasRealOpenStory) {
          const guide = await buildPublishGuide(openDay);
          setEntries((prev) =>
            dedupeBySha256(mergeShelfAndRemote([guide.entry], prev)),
          );
          setFronts((prev) => {
            const withoutGuide = prev.filter((b) => {
              if (frontBidPrintedDay(b) !== openDay) return true;
              return !isGuideBid(b);
            });
            const real = bidsForPrintedDay(withoutGuide, openDay);
            if (real.length > 0) return withoutGuide;
            return dedupeFrontBids([guide.front, ...withoutGuide]);
          });
          if (!deep) {
            // Land on the paper face — guide is A1; user opens it if they want.
            setEditionDay(openDay);
            setPaperPage("A");
            setTab("library");
          }
        } else if (!deep) {
          setEditionDay(openDay);
          setPaperPage("A");
        }
      } catch (e) {
        console.warn("publish guide failed", e);
      }
      // No auto-Sync — explorer crawls abort on cold loads. User hits Sync when ready.
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
              bodyText,
              pictureText,
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
      void refreshLibrary({ mode: "publish" });
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
    if (!doc) return;
    const localBid = walletUiOff || !walletClient || !publicClient || !address;
    if (!localBid && wrongChain) {
      setFrontError("Wrong network — wallet chip → Switch to Pulse.");
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
    const need = minA1Wei(frontWinner);
    if (valueWei < need) {
      setFrontError(
        frontWinner
          ? `Need more than ${formatPls(frontWinner.valueWei)} PLS to take A1 (else you stay A2/below)`
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
      let txHash: Hash;
      let from: string;
      if (localBid) {
        const salt = new TextEncoder().encode(
          `front:${doc.manifestHash}:${valueWei}:${Date.now()}`,
        );
        const digest = await sha256Hex(salt);
        txHash = (`0x${digest}`) as Hash;
        from = (address || LAB_FROM).toLowerCase();
      } else {
        txHash = await sendFrontBid({
          walletClient: walletClient!,
          publicClient: publicClient!,
          account: address!,
          manifestHash: doc.manifestHash,
          valueWei,
          forDay,
        });
        from = address!.toLowerCase();
      }
      const row: FrontBidEntry = {
        hash: txHash,
        from,
        timeStamp: Math.floor(Date.now() / 1000),
        manifest: doc.manifestHash.toLowerCase() as Hash,
        valueWei,
        forDay,
      };
      setFronts((prev) => dedupeFrontBids([row, ...prev]));
      setFrontOk(
        localBid
          ? `Desk bid · ${formatPls(valueWei)} PLS on ${forDay} (local)`
          : `A1 for ${forDay} — ${formatPls(valueWei)} PLS`,
      );
      setEditionDay(forDay);
      if (
        lastManifest &&
        doc.manifestHash.toLowerCase() === lastManifest.toLowerCase()
      ) {
        setLastManifest(null);
      }
    } catch (e) {
      setFrontError(e instanceof Error ? e.message : String(e));
      setFrontOk(null);
    } finally {
      setFronting(false);
    }
  }

  /** Keep A1 amount at least one wei above the current lead (whole PLS). */
  useEffect(() => {
    if (!doc) return;
    const need = minA1Wei(frontWinner);
    let cur = 0n;
    try {
      cur = parseEther(frontAmount || "0");
    } catch {
      cur = 0n;
    }
    if (cur >= need) return;
    const wholePls = (need + 10n ** 18n - 1n) / 10n ** 18n;
    setFrontAmount(wholePls.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only bump when lead/story changes
  }, [doc?.manifestHash, frontWinner?.valueWei, frontWinner?.hash]);

  /** Desk-only: seed rivals + race PLS through A1→A3→B1. */
  async function runA1A2Duel() {
    const forDay = isOpenPrintedDay(bidForDay)
      ? bidForDay
      : shiftUtcDay(utcTodayKey(), 1);
    setBidForDay(forDay);
    setEditionDay(forDay);
    setFrontError(null);

    let stories = storiesForDuelDay(libraryCards, fronts, forDay);

    while (stories.length < 4) {
      const n = stories.length;
      const from = [DUEL_A, DUEL_B, DUEL_C, DUEL_D][n] || DUEL_D;
      const seed = await makeDuelStory(
        from,
        `Duel ${String.fromCharCode(65 + n)} — sim slot`,
        `Bidder ${n + 1} story`,
        `Desk duel filler ${n + 1} for A1–A3/B ranking (Press parity).`,
        sha256Hex,
      );
      if (stories.some((x) => x.hash.toLowerCase() === seed.shelfRow.hash.toLowerCase())) {
        break;
      }
      pinToShelf(seed.shelfRow);
      await upsertCatalog([seed.shelfRow]);
      await putCachedDoc({
        hash: seed.shelfRow.hash,
        mimeType: seed.shelfRow.mimeType,
        title: seed.shelfRow.title,
        tags: seed.shelfRow.tags,
        summary: seed.shelfRow.summary,
        type: "text",
        sha256: seed.shelfRow.sha256,
        encoding: "raw",
        cw: false,
        from: seed.shelfRow.from,
        postedAt: seed.shelfRow.timeStamp,
        chunkCount: 1,
        bytes: seed.bytes.buffer.slice(
          seed.bytes.byteOffset,
          seed.bytes.byteOffset + seed.bytes.byteLength,
        ) as ArrayBuffer,
        savedAt: Date.now(),
      });
      stories = [...stories, seed.shelfRow];
    }
    setEntries((prev) =>
      dedupeBySha256(mergeShelfAndRemote(listShelf(), prev)),
    );

    try {
      const rounds = buildDuelRounds(stories, forDay);
      setFronts((prev) => mergeDuelDayBids(prev, rounds.r1, forDay));
      setFrontOk(rounds.statusR1);
      await new Promise((r) => window.setTimeout(r, 800));
      setFronts((prev) =>
        mergeDuelDayBids(prev, [rounds.r2Extra, ...rounds.r1], forDay),
      );
      const ok =
        rounds.verifyR2Labels[0] === stories[0]!.hash.toLowerCase();
      setFrontOk(
        ok
          ? rounds.statusR2
          : `Duel R2 layout mismatch — Press parity check failed`,
      );
      if (!ok) setFrontError("Desk duel did not match Press A1 cascade");
    } catch (e) {
      setFrontError(e instanceof Error ? e.message : String(e));
    }
    setTab("library");
    closeReader();
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
    if (!frontOk) return;
    const t = window.setTimeout(() => setFrontOk(null), 8000);
    return () => window.clearTimeout(t);
  }, [frontOk]);

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

  const todayKey = utcTodayKey();
  const yesterdayKey = shiftUtcDay(todayKey, -1);
  const tomorrowKey = shiftUtcDay(todayKey, 1);
  const maxOpenKey = maxOpenEditionDay(todayKey);
  const minPastKey = shiftUtcDay(todayKey, -SYNC_LOOKBACK_DAYS);
  const editionCursorKey = editionCursor(editionDay);
  const pastDisplayKey =
    editionCursorKey < todayKey ? editionCursorKey : yesterdayKey;
  const futureDisplayKey =
    editionCursorKey > todayKey ? editionCursorKey : tomorrowKey;

  // Keep cursor inside lookback … open horizon
  useEffect(() => {
    const c = editionCursor(editionDay);
    if (c > maxOpenKey) {
      setEditionDay(maxOpenKey);
      setBidForDay(maxOpenKey);
    } else if (c < minPastKey) {
      setEditionDay(minPastKey);
    }
  }, [editionDay, maxOpenKey, minPastKey]);

  function formatEditionShort(dayKey: string) {
    const [y, m, d] = dayKey.split("-").map(Number);
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const mon = months[(m || 1) - 1];
    // Same calendar year as today → drop year so mobile day strip stays readable
    const nowY = Number(utcTodayKey().slice(0, 4));
    if (y === nowY) return `${mon} ${d}`;
    return `${mon} ${d}, ${y}`;
  }

  function pickEditionDay(day: string) {
    setEditionDay(day);
    setPaperPage("A");
    if (day > todayKey) setBidForDay(day);
  }

  /** Step one day further into the past (or jump to yesterday from today/future). */
  function stepEditionPast() {
    const next =
      editionCursorKey > yesterdayKey
        ? yesterdayKey
        : shiftUtcDay(editionCursorKey, -1);
    if (next < minPastKey) return;
    pickEditionDay(next);
  }

  /** Step one day further into the future (or jump to tomorrow from today/past). */
  function stepEditionFuture() {
    const next =
      editionCursorKey < tomorrowKey
        ? tomorrowKey
        : shiftUtcDay(editionCursorKey, 1);
    if (next > maxOpenKey) return;
    pickEditionDay(next);
  }

  const a2Slot = press.aFace?.[1] || null;
  const a3Slot = press.aFace?.[2] || null;
  // Open paper: only bid-backed inside makes a B/C page (unbid fillers ≠ a page).
  // Final: full ranked inside.
  const faceInside = (press.inside || []).filter((s) =>
    editionOpen ? !!s.bid : true,
  );
  const insideBands = groupInsideByLetter(faceInside).filter(
    (b) => b.slots.length > 0,
  );
  const hasSectionA = !!(press.lead || a2Slot || a3Slot);
  const sectionPages = [
    ...(hasSectionA ? ["A"] : []),
    ...insideBands.map((b) => b.letter),
  ];
  const activePage = sectionPages.includes(paperPage)
    ? paperPage
    : sectionPages[0] || "A";
  const activeInside = insideBands.find((b) => b.letter === activePage);

  return (
    <div className={`app${mobileToolsOpen ? " app--tools-open" : ""}`}>
      <div className="rail">
        {tab === "library" && (
          <details
            className="filters-drawer filters-drawer--rail"
            open={mobileToolsOpen}
            onToggle={(e) => {
              setMobileToolsOpen(e.currentTarget.open);
            }}
          >
            <summary>Search &amp; tools</summary>
            <div className="filters-body">
              <button
                type="button"
                className="primary mobile-tools-done"
                onClick={() => setMobileToolsOpen(false)}
              >
                Done
              </button>
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
              {deskFace && (
                <button
                  type="button"
                  className="ghost"
                  title="Local sim: two stories outbid — A1 flips, loser becomes A2"
                  onClick={() => void runA1A2Duel()}
                >
                  Sim A1/A2 duel
                </button>
              )}
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
              {(deskFace || labOn || labOpenedViaQuery()) && (
              <label className="check" title="Demo seed only — not live …feed. Prefer ?lab=1 on Press.">
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
                Lab seed (demo)
              </label>
              )}
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
                      if (h) void openShare(h);
                    }}
                  >
                    {reading ? "…" : "Open"}
                  </button>
                </div>
              </details>
            </div>
          </details>
        )}
        <div className="rail-actions">
        {tab === "library" ? (
          <button
            type="button"
            className="ghost rail-act rail-act--write"
            onClick={() => {
              setMobileToolsOpen(false);
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
            className="ghost rail-act rail-act--front"
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
          className="ghost rail-act rail-act--sync"
          disabled={browsing}
          onClick={() => void refreshLibrary({ mode: "manual" })}
        >
          {browsing ? "…" : "Sync"}
        </button>
        <span className="rail-act rail-act--chrome">
          <ThemePicker />
        </span>
        {!walletUiOff && (
          <span className="rail-act rail-act--chrome">
            <WalletBar
              onUseAsAuthor={(a) => {
                setAuthorInput(a);
                setTab("library");
              }}
            />
          </span>
        )}
        {deskFace && (
          <span
            className="meta rail-lab rail-lab--warn rail-act rail-act--desk"
            title="DEV ONLY — local sandbox. Real app: Releases → hearts-archive-press.zip → START.cmd"
          >
            Desk · DEV ONLY
          </span>
        )}
        {!deskFace && labOn && (
          <span
            className="meta rail-lab rail-act rail-act--desk"
            title="Lab seed on — wallet chrome off until you uncheck Lab"
          >
            Lab · wallet off
          </span>
        )}
        </div>
      </div>

      <ArchiveUiProvider
        value={{
    a1PriceHint,
    a2Slot,
    a3Slot,
    activeInside,
    activePage,
    address,
    asciiPromptMsg,
    backupMsg,
    bidForDay,
    bodyText,
    browseError,
    browsing,
    buyFrontPage,
    canRetry,
    chunks,
    clickPublish,
    closeReader,
    copyCite,
    deskFace,
    doc,
    editionCursorKey,
    editionOpen,
    filtered,
    formatEditionShort,
    frontAmount,
    frontError,
    frontOk,
    frontWinner,
    fronting,
    futureDisplayKey,
    gasHint,
    hasSectionA,
    incomplete,
    insideBands,
    isConnected,
    labNote,
    labOn,
    lang,
    lastManifest,
    setLastManifest,
    leadPicture,
    license,
    likeCounts,
    likeDoc,
    likeError,
    likeOk,
    likes,
    liking,
    load,
    maxOpenDay,
    minOpenDay,
    pastDisplayKey,
    pickEditionDay,
    pictureText,
    prepared,
    press,
    previewLocalPost,
    pubError,
    publicClient,
    publishSource,
    publishing,
    readError,
    reading,
    recentTips,
    refreshLibrary,
    replaces,
    resetCompose,
    runPublish,
    sectionPages,
    setAsciiPromptMsg,
    setBidForDay,
    setBodyText,
    setChunks,
    setEditionDay,
    setFrontAmount,
    setIncomplete,
    setLang,
    setLicense,
    setPaperPage,
    setPictureText,
    setPubError,
    setReplaces,
    setSummary,
    setTab,
    setTagsRaw,
    setTelegram,
    setTipAmount,
    setTipCustom,
    setTipTokenId,
    setTipWallet,
    setTitle,
    setTwitter,
    setWriteMode,
    shortFunds,
    stepEditionFuture,
    stepEditionPast,
    summary,
    tagsRaw,
    telegram,
    tipAmount,
    tipAuthor,
    tipError,
    tipOk,
    tipTokenId,
    tipWallet,
    tipping,
    title,
    todayKey,
    twitter,
    walletClient,
    walletUiOff,
    writeMode,
    wrongChain,
        }}
      >
        {tab === "library" && <LibraryPage />}
        {tab === "post" && <PostPage />}
      </ArchiveUiProvider>

      {citeMsg && <div className="toast">{citeMsg}</div>}

      <nav className="mobile-tabbar" aria-label="App">
        <button
          type="button"
          className={
            tab === "library" && !mobileToolsOpen
              ? "mobile-tab is-active"
              : "mobile-tab"
          }
          onClick={() => {
            setMobileToolsOpen(false);
            setWriteMode("compose");
            setTab("library");
            closeReader();
          }}
        >
          <span className="mobile-tab-ico" aria-hidden="true">
            ▦
          </span>
          <span className="mobile-tab-label">Paper</span>
        </button>
        <button
          type="button"
          className={
            mobileToolsOpen ? "mobile-tab is-active" : "mobile-tab"
          }
          onClick={() => {
            if (tab !== "library") {
              setWriteMode("compose");
              setTab("library");
            }
            setMobileToolsOpen((open) => !open);
          }}
        >
          <span className="mobile-tab-ico" aria-hidden="true">
            ⌕
          </span>
          <span className="mobile-tab-label">Search</span>
        </button>
        <button
          type="button"
          className={
            tab === "post" ? "mobile-tab is-active" : "mobile-tab"
          }
          onClick={() => {
            setMobileToolsOpen(false);
            setWriteMode("compose");
            setTab("post");
          }}
        >
          <span className="mobile-tab-ico" aria-hidden="true">
            ✎
          </span>
          <span className="mobile-tab-label">
            Write
            {incomplete ? (
              <span className="tab-dot warn" aria-hidden />
            ) : null}
          </span>
        </button>
        <button
          type="button"
          className="mobile-tab"
          disabled={browsing}
          onClick={() => void refreshLibrary({ mode: "manual" })}
        >
          <span className="mobile-tab-ico" aria-hidden="true">
            ↻
          </span>
          <span className="mobile-tab-label">
            {browsing ? "…" : "Sync"}
          </span>
        </button>
      </nav>
    </div>
  );
}
