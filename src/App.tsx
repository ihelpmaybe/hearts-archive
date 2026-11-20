import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useWalletClient,
} from "wagmi";
import { pulsechain } from "wagmi/chains";
import { parseEther, type Hash } from "viem";
import { WalletBar } from "./WalletBar";
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
  estimatePublishCost,
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
  if (mimeType.startsWith("image/")) {
    return <img src={objectUrl} alt={doc.title || "on-chain file"} />;
  }
  if (mimeType.startsWith("video/")) {
    return <video src={objectUrl} controls />;
  }
  if (mimeType.startsWith("audio/")) {
    return <audio src={objectUrl} controls />;
  }
  if (mimeType.startsWith("text/") || mimeType.includes("json")) {
    return <TextPreview url={objectUrl} />;
  }
  return <iframe title={doc.title || "on-chain document"} src={objectUrl} />;
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

  const [hashInput, setHashInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [title, setTitle] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [lang, setLang] = useState("");
  const [license, setLicense] = useState("");
  const [replaces, setReplaces] = useState("");
  const [cw, setCw] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPublish | null>(null);
  const [gasHint, setGasHint] = useState<string | null>(null);
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [archiveOnly, setArchiveOnly] = useState(true);
  const [sortBy, setSortBy] = useState<SearchSort>("newest");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [scope, setScope] = useState<SearchScope>("all");
  const [hideCw, setHideCw] = useState(false);
  const [searchBodies, setSearchBodies] = useState(true);
  const [bodyByHash, setBodyByHash] = useState<Map<string, string>>(new Map());
  const [bodyIndexing, setBodyIndexing] = useState(false);
  const [tipPls, setTipPls] = useState("1");
  const [citeMsg, setCiteMsg] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<string | null>(null);
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [liking, setLiking] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [tab, setTab] = useState<"library" | "post">("library");
  const [incomplete, setIncomplete] = useState<IncompletePublish | null>(() =>
    loadIncomplete(),
  );
  const [recentLocal, setRecentLocal] = useState<
    { hash: Hash; title: string; mimeType: string; savedAt: number }[]
  >([]);

  const wrongChain = isConnected && chainId !== pulsechain.id;

  const refreshRecentLocal = useCallback(async () => {
    setRecentLocal(await listCachedSummaries());
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
      setCw(stuck.cw);
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
    setCw(d.cw);
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
      cw,
      bodyText,
      fileName: file?.name,
    });
  }, [title, tagsRaw, note, summary, lang, license, replaces, cw, bodyText, file]);

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
      setEntries((prev) =>
        dedupeBySha256(
          mergeShelfAndRemote(
            listShelf(),
            prev.filter((e) => e.hash !== manifestHash),
          ),
        ),
      );
      void refreshRecentLocal();
    },
    [refreshRecentLocal],
  );

  const load = useCallback(
    async (manifestHash: Hash, opts?: { goRead?: boolean }) => {
      if (opts?.goRead !== false) setTab("library");
      setReading(true);
      setReadError(null);
      setCiteMsg(null);
      setLoadSource(null);
      const cached = await getCachedDoc(manifestHash);
      try {
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
            source: "Opened from local cache (instant)",
          });
        }

        if (!publicClient) {
          if (!cached) setReadError("RPC not ready");
          return;
        }

        const { meta, bytes } = await readDocument(publicClient, manifestHash);
        const tx = await publicClient.getTransaction({ hash: manifestHash });
        let postedAt = 0;
        if (tx.blockNumber != null) {
          const block = await publicClient.getBlock({
            blockNumber: tx.blockNumber,
          });
          postedAt = Number(block.timestamp);
        }
        const from = (tx.from || "").toLowerCase();
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
          source: cached
            ? "Refreshed from PulseChain (cache updated)"
            : "Loaded from PulseChain",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (cached) {
          setLoadSource(`Still showing cached copy — chain refresh failed: ${msg}`);
        } else {
          setReadError(msg);
          setDoc(null);
        }
      } finally {
        setReading(false);
      }
    },
    [publicClient, applyLoaded],
  );

  const likeCounts = useMemo(() => countLikesByManifest(likes), [likes]);

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
    try {
      const author = authorInput.trim();
      if (/^0x[a-fA-F0-9]{40}$/.test(author)) {
        const remote = await listArchiveFromAuthor(author as `0x${string}`, {
          maxItems: 500,
        });
        await upsertCatalog(remote);
        setEntries(dedupeBySha256(mergeShelfAndRemote(base, remote)));
        // Likes still live on the shared sink
        const bundle = await listSinkBundle({
          onlyArchiveKind: false,
          maxItems: 500,
        });
        setLikes(dedupeLikes(bundle.likes));
      } else {
        const bundle = await listSinkBundle({
          onlyArchiveKind: archiveOnly,
          maxItems: 500,
        });
        await upsertCatalog(bundle.entries);
        setEntries(dedupeBySha256(mergeShelfAndRemote(base, bundle.entries)));
        setLikes(dedupeLikes(bundle.likes));
      }
    } catch (e) {
      setBrowseError(
        (e instanceof Error ? e.message : String(e)) +
          ` — showing local (${base.length})`,
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
      void load(fromRoute);
    }
    const onHash = () => {
      const h = parseRouteHash(window.location.hash);
      if (h) {
        setHashInput(h);
        void load(h);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [load]);

  useEffect(() => {
    void refreshLibrary();
    void refreshRecentLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishSource = useMemo(() => {
    if (file) return file;
    const text = bodyText.trim();
    if (!text) return null;
    const name =
      (title.trim() || "note").replace(/[^\w.-]+/g, "_").slice(0, 48) + ".txt";
    return new File([text], name, { type: "text/plain;charset=utf-8" });
  }, [file, bodyText, title]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!publishSource) {
        setPrepared(null);
        setGasHint(null);
        return;
      }
      try {
        const p = await preparePublishPayload(publishSource);
        if (cancelled) return;
        setPrepared(p);
        if (publicClient && address) {
          const est = await estimatePublishCost({
            publicClient,
            account: address,
            prepared: p,
            meta: {
              title,
              tags: parseTags(tagsRaw),
              note,
              summary,
              lang,
              license,
              replaces,
              cw,
            },
          });
          if (!cancelled) {
            setGasHint(
              `~${est.txs} txs · ~${Number(est.pls).toPrecision(4)} PLS` +
                (p.encoding === "gzip" ? ` · gzip −${p.savedPct}%` : ""),
            );
          }
        } else if (!cancelled) {
          setGasHint(
            `~${p.parts.length + 1} txs` +
              (p.encoding === "gzip" ? ` · gzip −${p.savedPct}%` : ""),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setPrepared(null);
          setGasHint(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    publishSource,
    publicClient,
    address,
    title,
    tagsRaw,
    note,
    summary,
    lang,
    license,
    replaces,
    cw,
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
    setBodyIndexing(true);
    void buildBodyIndex(entries.map((e) => e.hash)).then((map) => {
      if (!cancelled) {
        setBodyByHash(map);
        setBodyIndexing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entries, searchBodies]);

  const filtered = useMemo(() => {
    const q = parseQuery(filter);
    let rows = entries.filter((e) => {
      if (typeFilter !== "all" && (e.type || "other") !== typeFilter) return false;
      if (hideCw && e.cw) return false;
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
    hideCw,
    scope,
    localHashes,
    datePreset,
    sortBy,
    searchBodies,
    bodyByHash,
  ]);

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
    typeFilter !== "all" ||
    datePreset !== "all" ||
    scope !== "all" ||
    hideCw ||
    sortBy !== "newest";

  function clearSearch() {
    setFilter("");
    setTypeFilter("all");
    setDatePreset("all");
    setScope("all");
    setHideCw(false);
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
      if (!resume && prepared.sha256) {
        const known =
          entries.find((e) => e.sha256 === prepared.sha256) ||
          listShelf().find((e) => e.sha256 === prepared.sha256) ||
          (await findCatalogBySha256(prepared.sha256));
        if (known) {
          throw new Error(
            `Same file already archived (${known.hash.slice(0, 10)}…). Change content or clear to republish spam.`,
          );
        }
      }
      if (resume && incomplete && prepared.sha256 !== incomplete.sha256) {
        throw new Error(
          `Reselect the same file (sha ${incomplete.sha256.slice(0, 12)}…) to retry.`,
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
            cw,
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
              cw,
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
        cw,
      };
      pinToShelf(shelfRow);
      await upsertCatalog([shelfRow]);
      clearDraft();
      clearIncomplete();
      setIncomplete(null);
      setBodyText("");
      setFile(null);
      setChunks([]);
      setLastManifest(manifestHash);
      window.location.hash = sharePath(manifestHash);
      setTab("library");
      await load(manifestHash);
      await refreshLibrary();
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
    if (!doc?.from) return;
    const value = parseEther(tipPls || "0");
    if (value <= 0n) return;
    await sendTransactionAsync({
      to: doc.from as `0x${string}`,
      value,
      chainId: pulsechain.id,
    });
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
      setLikes((prev) =>
        dedupeLikes([
          {
            hash: txHash,
            from: address.toLowerCase(),
            timeStamp: Math.floor(Date.now() / 1000),
            manifest: doc.manifestHash.toLowerCase() as Hash,
          },
          ...prev,
        ]),
      );
      setCiteMsg("Liked on-chain");
    } catch (e) {
      setLikeError(e instanceof Error ? e.message : String(e));
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

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Heart’s Archive</h1>
        </div>
        <WalletBar
          onUseAsAuthor={(a) => {
            setAuthorInput(a);
            setTab("library");
          }}
        />
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
              <option value="all">Type</option>
              <option value="pdf">pdf</option>
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="audio">audio</option>
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
            >
              {browsing ? "…" : "Refresh"}
            </button>
            {hasActiveSearch && (
              <button type="button" className="ghost" onClick={clearSearch}>
                Clear
              </button>
            )}
            <span className="count-pill">
              {filtered.length}/{entries.length}
            </span>
          </div>
          <div className="toolbar tight checks">
            <label className="check">
              <input
                type="checkbox"
                checked={archiveOnly}
                onChange={(e) => setArchiveOnly(e.target.checked)}
              />
              archive
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={searchBodies}
                onChange={(e) => setSearchBodies(e.target.checked)}
              />
              body{bodyIndexing ? "…" : ""}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={hideCw}
                onChange={(e) => setHideCw(e.target.checked)}
              />
              hide CW
            </label>
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
              <div className="row">
                <input
                  type="text"
                  placeholder="0x…"
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
              {browsing && filtered.length === 0 && (
                <div className="skeleton-grid" aria-hidden>
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              )}
              <div className="card-grid">
                {filtered.map((e) => (
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
                      {e.cw ? "⚠ " : ""}
                      {e.title}
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
                    </span>
                    {e.tags.length > 0 && (
                      <span className="tags">{e.tags.join(" · ")}</span>
                    )}
                  </button>
                ))}
                {!browsing && filtered.length === 0 && (
                  <div className="empty">
                    <p className="meta">No docs yet. Refresh or Post one.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="library-reader">
              {readError && <p className="status bad">{readError}</p>}
              {!doc && !reading && !readError && (
                <div className="reader-empty">
                  <p>Pick a card or paste a hash.</p>
                </div>
              )}
              {reading && !doc && (
                <div className="reader-empty">
                  <p>Loading…</p>
                </div>
              )}
              {doc && (
                <>
                  <div className="reader-head">
                    <h3 className="doc-title">
                      {doc.cw ? "⚠ " : ""}
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
                          ? "…"
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
                  {likeError && <p className="status bad">{likeError}</p>}
                  <p className="meta reader-meta">
                    {formatPostedAt(doc.postedAt) && (
                      <>
                        <span className="when">
                          {formatPostedAt(doc.postedAt)}
                        </span>
                        {" · "}
                      </>
                    )}
                    {doc.from && (
                      <>
                        {shortAddr(doc.from)}
                        {" · "}
                      </>
                    )}
                    {doc.type || doc.mimeType} ·{" "}
                    {(doc.size / 1024).toFixed(1)} KB
                    {doc.encoding === "gzip" ? " · gz" : ""}
                    {` · ${likeCounts.get(doc.manifestHash.toLowerCase()) || 0} likes`}
                    {loadSource ? ` · ${loadSource}` : ""}
                  </p>
                  {(doc.summary ||
                    doc.note ||
                    (doc.tags && doc.tags.length > 0) ||
                    (doc.from && isConnected)) && (
                    <details className="more reader-more">
                      <summary>Details</summary>
                      {doc.summary && <p className="note">{doc.summary}</p>}
                      {doc.note && <p className="note">{doc.note}</p>}
                      {doc.tags && doc.tags.length > 0 && (
                        <p className="tags">{doc.tags.join(" · ")}</p>
                      )}
                      {doc.from && isConnected && (
                        <div className="row tip-row">
                          <input
                            type="text"
                            value={tipPls}
                            onChange={(e) => setTipPls(e.target.value)}
                            style={{ maxWidth: "5rem" }}
                            aria-label="Tip PLS"
                          />
                          <button
                            type="button"
                            className="primary"
                            disabled={wrongChain}
                            onClick={() => void tipAuthor()}
                          >
                            Tip
                          </button>
                        </div>
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
                <strong>Stuck</strong> · {incomplete.title} ·{" "}
                {incompleteDoneCount(incomplete)}/{incomplete.partsCount} ·{" "}
                reselect same file
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
                  Retry
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    clearIncomplete();
                    setIncomplete(null);
                    setChunks([]);
                  }}
                >
                  Dismiss
                </button>
              </div>
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
                onChange={(e) => {
                  setBodyText(e.target.value);
                  if (e.target.value && file) setFile(null);
                }}
                rows={12}
                disabled={!!file}
              />
              <div className="row file-row">
                <input
                  type="file"
                  onChange={(e) => {
                    const next = e.target.files?.[0] ?? null;
                    setFile(next);
                    if (next) setBodyText("");
                  }}
                />
                {file && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setFile(null)}
                  >
                    Clear file
                  </button>
                )}
              </div>
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
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={cw}
                      onChange={(e) => setCw(e.target.checked)}
                    />
                    CW
                  </label>
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
                      : "Text or file under cap."}
                  </p>
                )}
                {gasHint && prepared && (
                  <p className="meta">{gasHint}</p>
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
                      !walletClient
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
                      setFile(null);
                      setTagsRaw("");
                      setNote("");
                      setSummary("");
                      setLang("");
                      setLicense("");
                      setReplaces("");
                      setCw(false);
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
