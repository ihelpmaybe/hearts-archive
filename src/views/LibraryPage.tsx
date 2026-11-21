import { useEffect, useState } from "react";
import type { Hash } from "viem";
import { useArchiveUi } from "../archiveUi";
import { TypeCutPicture } from "../TypeCutPicture";
import { EmptyEdition } from "../EmptyEdition";
import { IncompleteRail } from "../IncompleteRail";
import { FrontBidBar } from "../FrontBidBar";
import { MoneyStrip } from "../MoneyStrip";
import { SoftHeld, Preview, shortAddr, formatPostedAt, isLabTestDoc, isLocalPreviewDoc, LAB_FROM } from "../uiBits";
import { displayHandle, telegramUrl, twitterUrl } from "../authorContact";
import { hasLiked } from "../archive";
import { formatPls } from "../frontPage";
import { isOpenPrintedDay } from "../editions";
import { softMuteHit } from "../softMute";
import { clearIncomplete } from "../incomplete";
import { CUSTOM_TIP_ID, TIP_PRESETS, isAddressLike } from "../tipTokens";
import { SCAN_TX, shareUrl } from "../protocol";
import { getCachedDoc } from "../cache";
import { unpackArticle } from "../articleFormat";

/** Extracted view — state lives in App via ArchiveUiProvider. */
export function LibraryPage() {
  const {
    a2Slot,
    a3Slot,
    activeInside,
    activePage,
    address,
    backupMsg,
    bidForDay,
    browseError,
    browsing,
    buyFrontPage,
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
    hasSectionA,
    incomplete,
    insideBands,
    isConnected,
    labNote,
    labOn,
    leadPicture,
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
    press,
    publicClient,
    publishing,
    readError,
    reading,
    recentTips,
    refreshLibrary,
    sectionPages,
    setBidForDay,
    setChunks,
    setEditionDay,
    setFrontAmount,
    setIncomplete,
    setPaperPage,
    setTab,
    setTipAmount,
    setTipCustom,
    setTipTokenId,
    setWriteMode,
    stepEditionFuture,
    stepEditionPast,
    tipAmount,
    tipAuthor,
    tipError,
    tipOk,
    tipTokenId,
    tipping,
    todayKey,
    walletClient,
    walletUiOff,
    wrongChain,
  } = useArchiveUi();

  /** B1 / C1 / … — same picture face as A1 for the section lead. */
  const sectionLead = activeInside?.slots?.[0] ?? null;
  const sectionRest = activeInside?.slots?.slice(1) ?? [];
  const [sectionLeadPicture, setSectionLeadPicture] = useState("");

  useEffect(() => {
    const h = sectionLead?.card?.entry?.hash as Hash | undefined;
    if (!h) {
      setSectionLeadPicture("");
      return;
    }
    let cancelled = false;
    void getCachedDoc(h).then((cached) => {
      if (cancelled) return;
      if (!cached?.bytes) {
        setSectionLeadPicture("");
        return;
      }
      try {
        const text = new TextDecoder().decode(new Uint8Array(cached.bytes));
        setSectionLeadPicture(unpackArticle(text).picture);
      } catch {
        setSectionLeadPicture("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sectionLead?.card?.entry?.hash]);

  return (
    <>
          {!doc && (
    <header className="masthead">
              <div
                className="ornament-bar ornament-bar--days"
                role="group"
                aria-label="Edition day"
              >
                <button
                  type="button"
                  className={
                    editionCursorKey < todayKey
                      ? "edition-day-btn is-active"
                      : "edition-day-btn"
                  }
                  onClick={stepEditionPast}
                  title={`${pastDisplayKey} · Final · click again for earlier`}
                >
                  <span className="edition-day-label">Yesterday</span>
                  <span className="edition-day-date">
                    {formatEditionShort(pastDisplayKey)} · Final
                  </span>
                </button>
                <button
                  type="button"
                  className={
                    editionCursorKey === todayKey
                      ? "edition-day-btn is-active"
                      : "edition-day-btn"
                  }
                  onClick={() => pickEditionDay(todayKey)}
                  title={`${todayKey} · Final`}
                >
                  <span className="edition-day-label">Today</span>
                  <span className="edition-day-date">
                    {formatEditionShort(todayKey)} · Final
                  </span>
                </button>
                <button
                  type="button"
                  className={
                    editionCursorKey > todayKey
                      ? "edition-day-btn is-active"
                      : "edition-day-btn"
                  }
                  onClick={stepEditionFuture}
                  title={`${futureDisplayKey} · Open A1 · click again for later`}
                >
                  <span className="edition-day-label">Tomorrow</span>
                  <span className="edition-day-date">
                    {formatEditionShort(futureDisplayKey)} · Open
                  </span>
                </button>
              </div>
              <h1 className="nameplate">Heart’s Archive</h1>
              <hr className="single-rule masthead-rule" />
            </header>
          
          )}
    <section className="panel page library-page">
              {incomplete && (
                <IncompleteRail
                  incomplete={incomplete}
                  publishing={publishing}
                  canRetry={false}
                  shaMismatch={false}
                  onRetry={() => {
                    setTab("post");
                    setWriteMode("compose");
                  }}
                  onGiveUp={() => {
                    clearIncomplete();
                    setIncomplete(null);
                    setChunks([]);
                  }}
                  onOpenPost={() => {
                    setTab("post");
                    setWriteMode("compose");
                  }}
                />
              )}
              {backupMsg && <p className="meta">{backupMsg}</p>}
              {frontOk && <p className="status ok">{frontOk}</p>}
              {frontError && <p className="status bad">{frontError}</p>}
              {browseError && <p className="status bad">{browseError}</p>}
              {labNote && labOn && (
                <p className="meta lab-banner">{labNote}</p>
              )}

              {!(doc && !isLocalPreviewDoc(doc.from)) && !reading && (
                <>
                  {!browsing && filtered.length === 0 ? (
                    <EmptyEdition
                      deskFace={deskFace}
                      syncing={browsing}
                      onWrite={() => {
                        setWriteMode("compose");
                        setTab("post");
                      }}
                      onSync={() => void refreshLibrary({ mode: "manual" })}
                    />
                  ) : (
                    <div className="broadsheet">
                      {(hasSectionA ||
                        insideBands.length > 0 ||
                        (editionOpen && !press.lead)) && (
                        <nav
                          className="section-pages"
                          aria-label="Edition pages A B C"
                        >
                          <span className="section-pages-kicker">Section</span>
                          {(sectionPages.length ? sectionPages : ["A"]).map(
                            (letter: string) =>
                              sectionPages.length > 1 ? (
                                <button
                                  key={letter}
                                  type="button"
                                  className={
                                    letter === activePage
                                      ? "section-page-link is-active"
                                      : "section-page-link"
                                  }
                                  onClick={() => setPaperPage(letter)}
                                >
                                  {letter}
                                </button>
                              ) : (
                                <span
                                  key={letter}
                                  className="section-page-link is-active"
                                >
                                  {letter}
                                </span>
                              ),
                          )}
                          <span className="section-band-note">
                            {activePage === "A"
                              ? " · front · A1–A3"
                              : activePage === "B"
                                ? " · after A1–A3"
                                : ` · continues after ${String.fromCharCode(activePage.charCodeAt(0) - 1)}`}
                          </span>
                        </nav>
                      )}
                      {(activePage === "A" ||
                        (!sectionPages.length && editionOpen && !press.lead)) &&
                        (hasSectionA || (editionOpen && !press.lead)) && (
                        <section
                          className="section-band section-band--a"
                          aria-label="Section A"
                        >
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
                              <p className="a1-hed">
                                Tomorrow’s paper — unpublished
                              </p>
                              <p className="a1-dek">
                                No A1 yet — open a story and Buy A1 with PLS (more
                                than the lead; +1 wei can snipe). Like and tip are
                                separate. Bids lock at that day’s UTC midnight.
                              </p>
                            </div>
                          ) : null}
                          {(a2Slot || a3Slot) && (
                            <div className="a1-grid a1-grid--secondary">
                              {a2Slot && (
                                <div className="a1-col">
                                  <SoftHeld
                                    hit={softMuteHit(
                                      a2Slot.card.entry.title,
                                      a2Slot.card.entry.summary,
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className="story-item lead-col"
                                      onClick={() =>
                                        void load(a2Slot.card.entry.hash)
                                      }
                                    >
                                      <span className="slot-kicker">
                                        A2
                                        {a2Slot.bid
                                          ? ` · ${formatPls(a2Slot.bid.valueWei)} PLS`
                                          : ""}
                                      </span>
                                      <span className="a1-col-hed">
                                        {a2Slot.card.entry.title}
                                      </span>
                                      {a2Slot.card.entry.summary && (
                                        <span className="story-dek">
                                          {a2Slot.card.entry.summary}
                                        </span>
                                      )}
                                      <span className="story-meta">
                                        {shortAddr(a2Slot.card.entry.from)} ·{" "}
                                        {likeCounts.get(
                                          a2Slot.card.entry.hash.toLowerCase(),
                                        ) || 0}{" "}
                                        likes
                                      </span>
                                    </button>
                                  </SoftHeld>
                                </div>
                              )}
                              {a3Slot && (
                                <div className="a1-col a1-col-mid">
                                  <SoftHeld
                                    hit={softMuteHit(
                                      a3Slot.card.entry.title,
                                      a3Slot.card.entry.summary,
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className="story-item mid-wrap"
                                      onClick={() =>
                                        void load(a3Slot.card.entry.hash)
                                      }
                                    >
                                      <span className="slot-kicker">
                                        A3
                                        {a3Slot.bid
                                          ? ` · ${formatPls(a3Slot.bid.valueWei)} PLS`
                                          : ""}
                                      </span>
                                      {a3Slot.card.entry.summary && (
                                        <span className="story-dek mid-dek-top">
                                          {a3Slot.card.entry.summary.slice(0, 120)}
                                          {a3Slot.card.entry.summary.length > 120
                                            ? "…"
                                            : ""}
                                        </span>
                                      )}
                                      <span className="story-hed mid-hed">
                                        {a3Slot.card.entry.title}
                                      </span>
                                      <span className="story-meta">
                                        {shortAddr(a3Slot.card.entry.from)}
                                      </span>
                                    </button>
                                  </SoftHeld>
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      )}
                      {activeInside && (
                        <section
                          className="section-band"
                          aria-label={`Section ${activeInside.letter}`}
                        >
                          {sectionLead && (
                            <div className="section-lead">
                              <SoftHeld
                                hit={softMuteHit(
                                  sectionLead.card.entry.title,
                                  sectionLead.card.entry.summary,
                                  sectionLeadPicture,
                                )}
                              >
                                <button
                                  type="button"
                                  className="a1-banner"
                                  onClick={() =>
                                    void load(sectionLead.card.entry.hash)
                                  }
                                >
                                  <span className="slot-kicker section-lead-kicker">
                                    {sectionLead.label}
                                    {sectionLead.bid
                                      ? ` · ${formatPls(sectionLead.bid.valueWei)} PLS`
                                      : ""}
                                  </span>
                                  <span className="a1-hed">
                                    {sectionLead.card.entry.title}
                                  </span>
                                  {sectionLead.card.entry.summary && (
                                    <span className="a1-dek">
                                      {sectionLead.card.entry.summary}
                                    </span>
                                  )}
                                </button>
                              </SoftHeld>
                              {sectionLeadPicture.trim() ? (
                                <button
                                  type="button"
                                  className="a1-cut"
                                  onClick={() =>
                                    void load(sectionLead.card.entry.hash)
                                  }
                                  aria-label={`Open ${sectionLead.label}`}
                                >
                                  <TypeCutPicture
                                    text={sectionLeadPicture}
                                    className="a1-cut-pic"
                                  />
                                </button>
                              ) : null}
                              <p className="a1-byline">
                                By {shortAddr(sectionLead.card.entry.from)}
                                {formatPostedAt(
                                  sectionLead.card.entry.timeStamp,
                                )
                                  ? ` · ${formatPostedAt(sectionLead.card.entry.timeStamp)}`
                                  : ""}
                                {` · ${likeCounts.get(sectionLead.card.entry.hash.toLowerCase()) || 0} likes`}
                              </p>
                            </div>
                          )}
                          {sectionRest.length > 0 && (
                            <div className="section-band-grid">
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {sectionRest.map((s: any) => (
                                <SoftHeld
                                  key={s.card.entry.hash}
                                  hit={softMuteHit(
                                    s.card.entry.title,
                                    s.card.entry.summary,
                                  )}
                                >
                                  <button
                                    type="button"
                                    className="story-item section-card"
                                    onClick={() => void load(s.card.entry.hash)}
                                  >
                                    <span className="slot-kicker">
                                      {s.label}
                                      {s.bid
                                        ? ` · ${formatPls(s.bid.valueWei)} PLS`
                                        : ""}
                                    </span>
                                    <span className="story-hed">
                                      {s.card.entry.title}
                                    </span>
                                    {s.card.entry.summary && (
                                      <span className="story-dek">
                                        {s.card.entry.summary.slice(0, 100)}
                                        {s.card.entry.summary.length > 100
                                          ? "…"
                                          : ""}
                                      </span>
                                    )}
                                    <span className="story-meta">
                                      {shortAddr(s.card.entry.from)}
                                    </span>
                                  </button>
                                </SoftHeld>
                              ))}
                            </div>
                          )}
                        </section>
                      )}
                      {!press.lead &&
                        !a2Slot &&
                        !a3Slot &&
                        insideBands.length === 0 && (
                          <p className="story-meta">More stories after Sync.</p>
                        )}
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
                      <MoneyStrip>
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
                              {recentTips.map((a: string) => (
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
                      {doc.from && isConnected && (
                        <p className="meta tip-to-hint">
                          Tip goes to{" "}
                          {shortAddr(
                            doc.tipWallet && isAddressLike(doc.tipWallet)
                              ? doc.tipWallet
                              : doc.from,
                          )}
                          {doc.tipWallet && isAddressLike(doc.tipWallet)
                            ? " (story tip wallet)"
                            : " (author)"}
                          — check that address in your wallet popup
                        </p>
                      )}
                      {likeError && <p className="status bad">{likeError}</p>}
                      {likeOk && <p className="status ok">{likeOk}</p>}
                      {tipError && <p className="status bad">{tipError}</p>}
                      {tipOk && <p className="status ok">{tipOk}</p>}
                      {(isConnected || walletUiOff) && (
                        <FrontBidBar
                          bidForDay={bidForDay}
                          frontAmount={frontAmount}
                          fronting={fronting}
                          walletUiOff={walletUiOff}
                          wrongChain={wrongChain}
                          canSend={!!walletClient && !!publicClient && !wrongChain}
                          frontWinner={frontWinner}
                          docManifest={doc.manifestHash}
                          minOpenDay={minOpenDay}
                          maxOpenDay={maxOpenDay}
                          onDay={(d) => {
                            if (!isOpenPrintedDay(d)) return;
                            setBidForDay(d);
                            setEditionDay(d);
                          }}
                          onAmount={setFrontAmount}
                          onBuy={() => void buyFrontPage()}
                        />
                      )}
                      {frontError && <p className="status bad">{frontError}</p>}
                      {frontOk && <p className="status ok">{frontOk}</p>}
                      </MoneyStrip>
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
          
        </>
  );
}
