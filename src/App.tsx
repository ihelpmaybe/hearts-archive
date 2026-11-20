import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  dedupeLikes,
  hasLiked,
  listArchiveFromAuthor,
  listSinkBundle,
  type ArchiveEntry,
  type LikeEntry,
} from "./archive";
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
  preparePublishPayload,
  publishPrepared,
  readDocument,
  SCAN_TX,
  sharePath,
  shareUrl,
  MAX_PUBLISH_BYTES,
  sendLike,
  type ChunkProgress,
  type DocType,
  type PreparedPublish,
} from "./protocol";
import { listShelf, mergeShelfAndRemote, pinToShelf } from "./shelf";
import {
  applyLocalBackup,
  buildLocalBackup,
  downloadBackupJson,
} from "./shelfBackup";
import { collapseSeriesCards } from "./series";

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
  objectUrl: string;
  size: number;
  chunkCount: number;
  manifestHash: Hash;
  from?: string;
  postedAt?: number;
};

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
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
    return <TextPreview url={objectUrl} />;
  }
  return (
    <p className="meta">
      Not text ({mimeType || "unknown"}). This app is text-only — open the Tx
      link if you need the raw payload.
    </p>
  );
}

function TextPreview({ url }: { url: string }) {
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
  return <pre>{text}</pre>;
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
  const [title, setTitle] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [lang, setLang] = useState("");
  const [license, setLicense] = useState("");
  const [replaces, setReplaces] = useState("");
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
  const [loadSource, setLoadSource] = useState<string | null>(null);
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [liking, setLiking] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [labNote, setLabNote] = useState<string | undefined>();
  const [labOn, setLabOn] = useState(() => isLabMode());
  const [expandSeries, setExpandSeries] = useState<Set<string>>(() => new Set());
  const [recentTips, setRecentTips] = useState<`0x${string}`[]>(() =>
    loadRecentTipTokens(),
  );
  const [likesRefreshing, setLikesRefreshing] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [likeOk, setLikeOk] = useState<string | null>(null);
  const [tab, setTab] = useState<"library" | "post">("library");
  const [incomplete, setIncomplete] = useState<IncompletePublish | null>(() =>
    loadIncomplete(),
  );
  const [recentLocal, setRecentLocal] = useState<
    { hash: Hash; title: string; mimeType: string; savedAt: number }[]
  >([]);

  const wrongChain = isConnected && chainId !== pulsechain.id;
  const entriesRef = useRef(entries);
  const openHashRef = useRef<string | null>(null);
  const loadRef = useRef<(h: Hash, opts?: { goRead?: boolean }) => Promise<void>>(
    async () => {},
  );

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

  useEffect(() => {
    const stuck = loadIncomplete();
    if (stuck) {
      setIncomplete(stuck);
      setTitle(stuck.title);
      setTagsRaw(stuck.tagsRaw);
      setNote(stuck.note);
      setSummary(stuck.summary);
      setLang(stuck.lang);
      setLicense(stuck.license);
      setReplaces(stuck.replaces);
      setChunks(stuck.progress);
      return;
    }
    const d = loadDraft();
    if (!d) return;
    setTitle(d.title);
    setTagsRaw(d.tagsRaw);
    setNote(d.note);
    setSummary(d.summary);
    setLang(d.lang);
    setLicense(d.license);
    setReplaces(d.replaces);
    if (d.bodyText) setBodyText(d.bodyText);
  }, []);

  useEffect(() => {
    saveDraft({
      title,
      tagsRaw,
      note,
      summary,
      lang,
      license,
      replaces,
      cw: false,
      bodyText,
    });
  }, [title, tagsRaw, note, summary, lang, license, replaces, bodyText]);

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
      bytes: Uint8Array;
      chunkCount: number;
      from?: string;
      postedAt?: number;
      source: string;
    }) => {
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
      if (window.location.hash !== path) {
        window.history.replaceState(null, "", path);
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
            typeof navigator !== "undefined" && navigator.onLine === false
              ? "Offline and no local copy — open this link once online to cache it."
              : "RPC not ready — Sync once while online, then re-open.",
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
          bytes,
          chunkCount: meta.chunkHashes.length,
          from,
          postedAt: postedAt || undefined,
          source: "Fetched from Pulse · saved locally",
        });
      } catch (e) {
        const offline =
          typeof navigator !== "undefined" && navigator.onLine === false;
        const msg = e instanceof Error ? e.message : String(e);
        setReadError(
          offline
            ? "Offline and no local copy for this hash — open it once online."
            : msg,
        );
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

  /** Pull …feed (and likes) from chain → merge into local catalog. */
  const refreshLibrary = useCallback(async () => {
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
      if (/^0x[a-fA-F0-9]{40}$/.test(author)) {
        const remote = await listArchiveFromAuthor(author as `0x${string}`, {
          maxItems: 500,
          knownHashes,
        });
        await upsertCatalog(remote);
        setEntries(dedupeBySha256(mergeShelfAndRemote(base, remote)));
        const bundle = await listSinkBundle({
          onlyArchiveKind: false,
          maxItems: 500,
          knownHashes,
        });
        setLikes((prev) => dedupeLikes([...prev, ...bundle.likes]));
        void upsertCachedLikes(bundle.likes);
      } else {
        const bundle = await listSinkBundle({
          onlyArchiveKind: archiveOnly,
          maxItems: 500,
          knownHashes,
        });
        await upsertCatalog(bundle.entries);
        setEntries(dedupeBySha256(mergeShelfAndRemote(base, bundle.entries)));
        setLikes((prev) => dedupeLikes([...prev, ...bundle.likes]));
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
  }, [authorInput, archiveOnly, refreshRecentLocal]);

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
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    void loadAndApplyTheme().catch(() => {
      /* Venus CSS defaults still apply */
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const cachedLikes = await listCachedLikes();
      if (cachedLikes.length) {
        setLikes((prev) => dedupeLikes([...cachedLikes, ...prev]));
      }
      let seeded = false;
      if (isLabMode()) {
        const seed = await loadLabSeed();
        if (seed) {
          seeded = true;
          setLabNote(seed.meta.note);
          setLikes((prev) => dedupeLikes([...seed.likes, ...prev]));
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
    const text = bodyText.trim();
    if (!text) return null;
    const name =
      (title.trim() || "note").replace(/[^\w.-]+/g, "_").slice(0, 48) + ".txt";
    return new File([text], name, { type: "text/plain;charset=utf-8" });
  }, [bodyText, title]);

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
            note,
            summary,
            lang,
            license,
            replaces,
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
  }, [publishSource, title, tagsRaw, note, summary, lang, license, replaces]);

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

  const shortFunds =
    !!plsBalance &&
    costWei != null &&
    plsBalance.value < (costWei * 12n) / 10n;

  const tagSuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.tags) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);
  }, [entries]);

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

  async function runPublish(resume: boolean) {
    if (!publishSource || !prepared || !walletClient || !publicClient || !address)
      return;
    setPublishing(true);
    setPubError(null);
    if (!resume) setChunks([]);
    setLastManifest(null);
    try {
      if (chainId !== pulsechain.id) {
        throw new Error("Switch wallet to PulseChain (369) first");
      }
      if (
        !resume &&
        costWei != null &&
        plsBalance &&
        plsBalance.value < (costWei * 12n) / 10n
      ) {
        throw new Error(
          "Not enough PLS for the free gas estimate (+20% buffer). Add PLS or shorten the post.",
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
            note,
            summary,
            lang,
            license,
            replaces,
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
              note,
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
        note: note.trim() || undefined,
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
        bodyText.trim() ? bodyText : " ",
      );
      await putCachedDoc({
        hash: manifestHash,
        mimeType: mimeType || "text/plain;charset=utf-8",
        title: shelfRow.title,
        tags,
        note: shelfRow.note,
        summary: shelfRow.summary,
        type: prepared.type,
        sha256,
        encoding: prepared.encoding,
        replaces: shelfRow.replaces,
        cw: false,
        from: address.toLowerCase(),
        postedAt: shelfRow.timeStamp,
        chunkCount: chunkHashes.length,
        bytes: textBytes.buffer.slice(
          textBytes.byteOffset,
          textBytes.byteOffset + textBytes.byteLength,
        ) as ArrayBuffer,
        savedAt: Date.now(),
      });
      clearDraft();
      clearIncomplete();
      setIncomplete(null);
      setBodyText("");
      setChunks([]);
      setLastManifest(manifestHash);
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
      setTipError("Switch to Pulse");
      return;
    }
    setTipping(true);
    setTipError(null);
    setTipOk(null);
    try {
      const to = doc.from as `0x${string}`;
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
        maxItems: 400,
        knownHashes: known,
        stopAfterKnown: 12,
      });
      setLikes((prev) => dedupeLikes([...prev, ...bundle.likes]));
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

  async function likeDoc() {
    if (!doc || !walletClient || !publicClient || !address) return;
    if (wrongChain) {
      setLikeError("Switch to Pulse");
      return;
    }
    if (hasLiked(likes, doc.manifestHash, address)) {
      setLikeError("Already liked from this wallet");
      return;
    }
    setLiking(true);
    setLikeError(null);
    try {
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
        setDoc(null);
        openHashRef.current = null;
        setReadError(null);
        setLoadSource(null);
        if (window.location.hash.startsWith("#/doc/")) {
          window.history.replaceState(null, "", "#/");
        }
        return;
      }
      if (e.key !== "j" && e.key !== "k") return;
      e.preventDefault();
      const hashes = libraryCards.map((c) => c.entry.hash.toLowerCase());
      if (!hashes.length) return;
      const cur = doc?.manifestHash.toLowerCase() || "";
      let idx = hashes.indexOf(cur);
      if (idx < 0) idx = e.key === "j" ? -1 : 0;
      const next =
        e.key === "j"
          ? Math.min(hashes.length - 1, idx + 1)
          : Math.max(0, idx <= 0 ? 0 : idx - 1);
      const h = libraryCards[next]?.entry.hash;
      if (h) void load(h);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, libraryCards, doc, load]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Heart’s Archive</h1>
        </div>
        <div className="top-right">
          <ThemePicker />
          <WalletBar
            onUseAsAuthor={(a) => {
              setAuthorInput(a);
              setTab("library");
            }}
          />
        </div>
      </header>

      <nav className="tabs" aria-label="Archive">
        <button
          type="button"
          className={tab === "library" ? "tab active" : "tab"}
          onClick={() => setTab("library")}
        >
          Library
          <span className="tab-count">{filtered.length}</span>
          {doc ? <span className="tab-dot" aria-hidden /> : null}
        </button>
        <button
          type="button"
          className={tab === "post" ? "tab active" : "tab"}
          onClick={() => setTab("post")}
        >
          Post
          {incomplete ? <span className="tab-dot warn" aria-hidden /> : null}
        </button>
      </nav>

      {tab === "library" && (
        <section className="panel page library-page">
          <div className="toolbar">
            <input
              className="grow"
              type="text"
              placeholder="Search · tag: type: from:"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              spellCheck={false}
            />
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
              style={{ maxWidth: "11rem" }}
            />
            <button
              type="button"
              className="primary"
              disabled={browsing}
              onClick={() => void refreshLibrary()}
              title="Pull new posts from …feed (uses RPC)"
            >
              {browsing ? "…" : "Sync"}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={likesRefreshing || browsing}
              onClick={() => void refreshLikesOnly()}
              title="Refresh likes only (lighter than full Sync)"
            >
              {likesRefreshing ? "…" : "♥"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void exportBackup()}
              title="Export shelf + catalog JSON"
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
            {hasActiveSearch && (
              <button type="button" className="ghost" onClick={clearSearch}>
                Clear
              </button>
            )}
            <span className="count-pill" title="Showing local catalog">
              {libraryCards.length}/{entries.length} local
            </span>
          </div>
          {backupMsg && <p className="meta">{backupMsg}</p>}
          <div className="toolbar tight checks">
            {tagSuggestions.slice(0, 8).map((t) => (
              <button
                key={t}
                type="button"
                className="ghost tag-chip"
                onClick={() =>
                  setFilter((prev) => {
                    const token = `tag:${t}`;
                    return prev.includes(token)
                      ? prev
                      : `${prev} ${token}`.trim();
                  })
                }
              >
                #{t}
              </button>
            ))}
          </div>
          {browseError && <p className="status bad">{browseError}</p>}
          {labNote && labOn && (
            <p className="meta lab-banner">{labNote}</p>
          )}
          <div className="lab-toggle-row">
            <label className="check">
              <input
                type="checkbox"
                checked={labOn}
                onChange={(e) => {
                  const on = e.target.checked;
                  setLabMode(on);
                  setLabOn(on);
                  if (!on) {
                    setLabNote(undefined);
                  } else {
                    void loadLabSeed().then((seed) => {
                      if (!seed) return;
                      setLabNote(seed.meta.note);
                      setLikes((prev) =>
                        dedupeLikes([...seed.likes, ...prev]),
                      );
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
          </div>

          <div className="library-split">
            <div className="library-list">
              {recentLocal.length > 0 && (
                <div className="recent">
                  <div className="tag-row">
                    {recentLocal.map((r) => (
                      <button
                        key={r.hash}
                        type="button"
                        className="ghost tag-chip"
                        disabled={reading}
                        onClick={() => void load(r.hash)}
                      >
                        {r.title.slice(0, 24)}
                        {r.title.length > 24 ? "…" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <details className="hash-open">
                <summary>Paste a share link / hash</summary>
                <div className="row">
                  <input
                    type="text"
                    placeholder="Paste 0x… or #/doc/0x…"
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
              {browsing && filtered.length === 0 && (
                <div className="skeleton-grid" aria-hidden>
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              )}
              <div className="card-grid">
                {libraryCards.map(({ entry: e, version, olderCount }) => (
                  <button
                    key={e.hash}
                    type="button"
                    className={
                      doc?.manifestHash === e.hash
                        ? "doc-card active"
                        : "doc-card"
                    }
                    onClick={() => void load(e.hash)}
                  >
                    <strong>
                      {e.title}
                      {version ? (
                        <span className="series-badge"> v{version}</span>
                      ) : null}
                    </strong>
                    {formatPostedAt(e.timeStamp) && (
                      <span className="when">
                        {formatPostedAt(e.timeStamp)}
                      </span>
                    )}
                    {e.summary && (
                      <span className="card-sum">{e.summary}</span>
                    )}
                    <span>
                      {e.type || e.mimeType} · {e.chunkCount} chunk
                      {e.chunkCount === 1 ? "" : "s"}
                      {e.encoding === "gzip" ? " · gz" : ""}
                      {` · ♥ ${likeCounts.get(e.hash.toLowerCase()) || 0}`}
                    </span>
                    <span>
                      {shortAddr(e.from)}{" "}
                      <button
                        type="button"
                        className="linkish"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setAuthorInput(e.from);
                        }}
                      >
                        filter
                      </button>
                      {olderCount > 0 && (
                        <button
                          type="button"
                          className="linkish"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            const tip = e.hash.toLowerCase();
                            setExpandSeries((prev) => {
                              const next = new Set(prev);
                              if (next.has(tip)) next.delete(tip);
                              else next.add(tip);
                              return next;
                            });
                          }}
                        >
                          {expandSeries.has(e.hash.toLowerCase())
                            ? "hide older"
                            : `+${olderCount} older`}
                        </button>
                      )}
                    </span>
                    {e.tags.length > 0 && (
                      <span className="tags">{e.tags.join(" · ")}</span>
                    )}
                  </button>
                ))}
                {!browsing && filtered.length === 0 && (
                  <div className="empty first-path">
                    <p className="empty-title">Nothing here yet</p>
                    <ol className="empty-steps">
                      <li>Connect wallet (Pulse)</li>
                      <li>Open Post → write text</li>
                      <li>Publish</li>
                      <li>Hit Sync to pull the feed</li>
                    </ol>
                    <p className="meta">
                      Or Sync now if others already posted to …feed.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="library-reader">
              {readError && (
                <div className="status-block bad">
                  <p className="status bad">{readError}</p>
                  <p className="meta">
                    If you’ve opened this before, try Sync — or pick another
                    card from local.
                  </p>
                </div>
              )}
              {!doc && !reading && !readError && (
                <div className="reader-empty">
                  <p>Pick a card on the left to read.</p>
                </div>
              )}
              {reading && !doc && (
                <div className="reader-empty">
                  <p>Loading from Pulse…</p>
                </div>
              )}
              {doc && (
                <>
                  <div className="reader-head">
                    <h3 className="doc-title">
                      {doc.title || "(untitled)"}
                    </h3>
                    <div className="reader-actions">
                      <button
                        type="button"
                        className={
                          address &&
                          hasLiked(likes, doc.manifestHash, address)
                            ? "primary"
                            : "ghost"
                        }
                        disabled={
                          liking ||
                          !isConnected ||
                          wrongChain ||
                          !walletClient ||
                          (!!address &&
                            hasLiked(likes, doc.manifestHash, address))
                        }
                        onClick={() => void likeDoc()}
                        title="Sign off on-chain (like)"
                      >
                        {liking
                          ? "Confirming…"
                          : `Like ${likeCounts.get(doc.manifestHash.toLowerCase()) || 0}`}
                      </button>
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
                  </div>
                  {doc.from && isConnected && (
                    <div className="tip-bar">
                      <input
                        type="text"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(e.target.value)}
                        aria-label="Tip amount"
                        placeholder="Amt"
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
                        className="primary"
                        disabled={wrongChain || tipping || !walletClient}
                        onClick={() => void tipAuthor()}
                        title="Send tokens to author (not a like)"
                      >
                        {tipping ? "…" : "Tip"}
                      </button>
                      {tipTokenId === CUSTOM_TIP_ID && (
                        <input
                          type="text"
                          className="tip-custom"
                          placeholder="Token 0x…"
                          value={tipCustom}
                          onChange={(e) =>
                            setTipCustom(e.target.value.trim())
                          }
                          spellCheck={false}
                        />
                      )}
                    </div>
                  )}
                  {likeError && <p className="status bad">{likeError}</p>}
                  {likeOk && <p className="status ok">{likeOk}</p>}
                  {tipError && <p className="status bad">{tipError}</p>}
                  {tipOk && <p className="status ok">{tipOk}</p>}
                  <p className="meta reader-meta">
                    {doc.from ? shortAddr(doc.from) : "unknown"}
                    {formatPostedAt(doc.postedAt)
                      ? ` · ${formatPostedAt(doc.postedAt)}`
                      : ""}
                    {` · ♥ ${likeCounts.get(doc.manifestHash.toLowerCase()) || 0}`}
                    {loadSource === "Local copy" ? (
                      <span className="quiet"> · local</span>
                    ) : loadSource ? (
                      <span className="quiet"> · {loadSource}</span>
                    ) : null}
                  </p>
                  {(doc.replaces ||
                    entries.some(
                      (e) =>
                        e.replaces?.toLowerCase() ===
                        doc.manifestHash.toLowerCase(),
                    )) && (
                    <div className="series-nav">
                      {doc.replaces &&
                        /^0x[a-fA-F0-9]{64}$/.test(doc.replaces) && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            void load(doc.replaces!.toLowerCase() as Hash)
                          }
                        >
                          ← Earlier version
                        </button>
                      )}
                      {entries
                        .filter(
                          (e) =>
                            e.replaces?.toLowerCase() ===
                            doc.manifestHash.toLowerCase(),
                        )
                        .slice(0, 1)
                        .map((e) => (
                          <button
                            key={e.hash}
                            type="button"
                            className="ghost"
                            onClick={() => void load(e.hash)}
                          >
                            Newer version →
                          </button>
                        ))}
                    </div>
                  )}
                  {(doc.summary ||
                    doc.note ||
                    (doc.tags && doc.tags.length > 0)) && (
                    <details className="more reader-more">
                      <summary>Details</summary>
                      {doc.summary && <p className="note">{doc.summary}</p>}
                      {doc.note && <p className="note">{doc.note}</p>}
                      {doc.tags && doc.tags.length > 0 && (
                        <p className="tags">{doc.tags.join(" · ")}</p>
                      )}
                      {(doc.size > 0 || doc.encoding) && (
                        <p className="meta">
                          {(doc.size / 1024).toFixed(1)} KB
                          {doc.encoding === "gzip" ? " · gzip" : ""}
                          {doc.type ? ` · ${doc.type}` : ""}
                        </p>
                      )}
                    </details>
                  )}
                  <div className="preview">
                    <Preview doc={doc} />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "post" && (
        <section className="panel page">
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
          <div className="post-layout">
            <div className="post-compose">
              <div className="row">
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <textarea
                placeholder="Write text…"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={14}
              />
              <details className="more">
                <summary>More</summary>
                <div className="post-more-grid">
                  <input
                    type="text"
                    placeholder="Summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Tags"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Lang"
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="License"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Replaces 0x…"
                    value={replaces}
                    onChange={(e) => setReplaces(e.target.value.trim())}
                    spellCheck={false}
                  />
                </div>
              </details>
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
                    Wallet PLS looks short for this post (+20% buffer).
                  </p>
                )}
                <div className="post-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={
                      !prepared ||
                      !isConnected ||
                      publishing ||
                      wrongChain ||
                      !walletClient ||
                      shortFunds
                    }
                    onClick={() => void runPublish(false)}
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
                    onClick={() => {
                      clearDraft();
                      setTitle("");
                      setBodyText("");
                      setTagsRaw("");
                      setNote("");
                      setSummary("");
                      setLang("");
                      setLicense("");
                      setReplaces("");
                    }}
                  >
                    Clear
                  </button>
                </div>
                {!isConnected && (
                  <p className="meta">Connect wallet to publish.</p>
                )}
                {wrongChain && isConnected && (
                  <p className="status bad">Switch to Pulse.</p>
                )}
                {pubError && <p className="status bad">{pubError}</p>}
                {lastManifest && (
                  <p className="status ok">
                    <a
                      href={SCAN_TX(lastManifest)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddr(lastManifest)}
                    </a>
                  </p>
                )}
              </div>
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
        </section>
      )}

      {citeMsg && <div className="toast">{citeMsg}</div>}
    </div>
  );
}
