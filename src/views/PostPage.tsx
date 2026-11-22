import { useArchiveUi } from "../archiveUi";
import { TypeCutPicture } from "../TypeCutPicture";
import { IncompleteRail } from "../IncompleteRail";
import { SoftHeld, shortAddr } from "../uiBits";
import { displayHandle, telegramUrl, twitterUrl } from "../authorContact";
import { normalizeTypeCut } from "../typeCut";
import { copyAsciiArtPrompt } from "../asciiArtPrompt";
import { isOpenPrintedDay } from "../editions";
import { softMuteHit } from "../softMute";
import { clearIncomplete } from "../incomplete";
import { isAddressLike } from "../tipTokens";
import { LANG_OPTIONS, LICENSE_OPTIONS, withCurrentOption } from "../metaOptions";
import { MAX_PUBLISH_BYTES, SCAN_TX } from "../protocol";

/** Extracted view — state lives in App via ArchiveUiProvider. */
export function PostPage() {
  const {
    a1PriceHint,
    address,
    asciiPromptMsg,
    bidForDay,
    bodyText,
    canRetry,
    chunks,
    clickPublish,
    deskFace,
    gasHint,
    incomplete,
    isConnected,
    lang,
    lastManifest,
    license,
    load,
    maxOpenDay,
    minOpenDay,
    pictureText,
    prepared,
    previewLocalPost,
    pubError,
    publishSource,
    publishing,
    replaces,
    resetCompose,
    runPublish,
    setAsciiPromptMsg,
    setBidForDay,
    setBodyText,
    setChunks,
    setIncomplete,
    setLang,
    setLicense,
    setPictureText,
    setPubError,
    setReplaces,
    setSummary,
    setTab,
    setTagsRaw,
    setTelegram,
    setTipWallet,
    setTitle,
    setTwitter,
    setWriteMode,
    shortFunds,
    summary,
    tagsRaw,
    telegram,
    tipWallet,
    title,
    twitter,
    walletClient,
    walletUiOff,
    writeMode,
    wrongChain,
  } = useArchiveUi();

  return (
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
                <IncompleteRail
                  incomplete={incomplete}
                  publishing={publishing}
                  canRetry={
                    !!prepared &&
                    prepared.sha256 === incomplete.sha256 &&
                    !!walletClient &&
                    !walletUiOff &&
                    isConnected &&
                    !wrongChain
                  }
                  shaMismatch={
                    !!prepared && prepared.sha256 !== incomplete.sha256
                  }
                  onRetry={() => {
                    if (walletUiOff || !walletClient) {
                      setPubError(
                        deskFace
                          ? "Stuck publish needs the Press face + wallet to finish on-chain chunks."
                          : "Connect on Pulse (and Switch network) to Retry the stuck publish.",
                      );
                      return;
                    }
                    void runPublish(true);
                  }}
                  onGiveUp={() => {
                    clearIncomplete();
                    setIncomplete(null);
                    setChunks([]);
                  }}
                  onRestoreDraft={() => {
                    setTitle(incomplete.title || "");
                    setBodyText(incomplete.bodyText || "");
                    setPictureText(incomplete.pictureText || "");
                    setTagsRaw(incomplete.tagsRaw || "");
                    setSummary(incomplete.summary || "");
                    setLang(incomplete.lang || "");
                    setLicense(incomplete.license || "");
                    setReplaces(incomplete.replaces || "");
                    setPubError(null);
                  }}
                />
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
                        {publishing
                          ? chunks.length
                            ? `${chunks.filter((c: { status: string }) => c.status === "done").length}/${chunks.length}…`
                            : "Signing…"
                          : "Publish"}
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
                      className={
                        pictureText.trim()
                          ? "type-cut-paste compose-paste has-art"
                          : "type-cut-paste compose-paste"
                      }
                      rows={
                        pictureText.trim()
                          ? Math.min(
                              28,
                              Math.max(8, pictureText.split("\n").length + 2),
                            )
                          : 3
                      }
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
                        {publishing
                          ? chunks.length
                            ? `${chunks.filter((c: { status: string }) => c.status === "done").length}/${chunks.length}…`
                            : "Signing…"
                          : "Publish"}
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
                      Preview = faces only. Desk = DEV sandbox. Real app =
                      Releases → Press ZIP → START.cmd (no Node).
                    </p>
                    {wrongChain && isConnected && (
                      <p className="status bad">
                        Wrong network — open the Pulse wallet chip → Switch to
                        Pulse.
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
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {chunks.map((c: any) => (
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
          
  );
}
