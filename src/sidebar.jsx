/* ============================================================
   src/sidebar.jsx — Vite-native ES module for the Sidebar component.
   Migration phase: 6e.

   Imports pure utilities from src/ui.js and src/data.js so the
   component has explicit dependencies rather than relying on window.*.
   All component logic and markup is identical to public/legacy/sidebar.jsx.

   JSX pragma: classic mode with explicit npm React import (Phase 6i prep).
   React is imported from the npm package rather than the CDN window global.
   The window.React UMD global is still present in the browser (loaded by
   index.html CDN scripts) but is no longer relied upon by this file.

   Node.js consumers: this file cannot be imported directly (JSX syntax).
   Verify exports via scripts/sidebar-check.mjs.

   public/legacy/sidebar.jsx is the unchanged browser-Babel shim that
   assigns Sidebar, Icon, and PROFILES to window.* for legacy consumers.
   ============================================================ */
/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

import React from "react";
import { t, fmtUSD } from "./ui.js";
import { UNIVERSE, lookup, isValidTicker } from "./data.js";
import { validateDateRange } from "./dateUtils.js";

const { useState: useStateSB, useRef: useRefSB, useEffect: useEffectSB } = React;

// small inline icons (geometric only — no hand-drawn art)
export function Icon({ name, size = 14, color = "currentColor", sw = 1.6 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
    chevron: <polyline points="6 9 12 15 18 9" />,
    refresh: <><polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" /></>,
  };
  return <svg {...p}>{paths[name]}</svg>;
}

export const PROFILES = [
  { id: "balanced" },
  { id: "risk" },
  { id: "return" },
];

const PROFILE_COPY = {
  en: {
    balanced: { label: "Balanced", help: "Equal emphasis on return and risk. Optimizer targets the best risk-adjusted mix near your current weights." },
    risk: { label: "Risk-focused", help: "Prioritizes drawdown control and low volatility. Tilts toward diversifiers and caps single-name concentration." },
    return: { label: "Return-focused", help: "Prioritizes expected return. Tolerates higher volatility and tracking error against the benchmark." },
  },
  tr: {
    balanced: { label: "Dengeli", help: "Getiri ve risk birlikte değerlendirilir. Model, mevcut ağırlıklara yakın en iyi risk/getiri dengesini arar." },
    risk: { label: "Risk odaklı", help: "Düşüş kontrolü ve düşük oynaklık önceliklidir. Dağıtıcı varlıklara ağırlık verir ve tek varlık yoğunlaşmasını sınırlar." },
    return: { label: "Getiri odaklı", help: "Beklenen getiri önceliklidir. Daha yüksek oynaklık ve benchmark sapmasını kabul eder." },
  },
};

const DATE_PRESETS = ["6M", "1Y", "2Y", "5Y", "Custom"];

export function Sidebar(props) {
  const { holdings, assets, totalValue, instruments, dataSource, apiStatus, marketDataStatus, referenceDataStatus, onAdd, onRemove, onLots,
    dateRange, setDateRange, customFrom = "", customTo = "", setCustomFrom, setCustomTo,
    profile, setProfile,
    assumptions, setAssumptions, theme, toggleTheme, language = "tr", toggleLanguage, lastUpdated,
    savedPortfolios = [], onSavePortfolio, onLoadPortfolio, onDeletePortfolio, onResetPortfolio,
    onImportCsv, onExportCsv,
    portfolioNote = "", setPortfolioNote,
    onCostBasis,
    onExportBackup, onImportBackup,
    onSaveActiveState, lastActiveSavedAt = null } = props;

  const [q, setQ] = useStateSB("");
  const [open, setOpen] = useStateSB(false);
  const [advOpen, setAdvOpen] = useStateSB(false);
  const [activeIdx, setActiveIdx] = useStateSB(0);
  const boxRef = useRefSB(null);
  const [saveName, setSaveName] = useStateSB("");
  const [saveError, setSaveError] = useStateSB("");
  const [csvSummary, setCsvSummary] = useStateSB(null);
  const csvInputRef = useRefSB(null);
  const [backupSummary, setBackupSummary] = useStateSB(null);
  const backupInputRef = useRefSB(null);
  const [saveActiveFeedback, setSaveActiveFeedback] = useStateSB(false);
  const [draftFrom, setDraftFrom] = useStateSB(() => customFrom || "");
  const [draftTo, setDraftTo] = useStateSB(() => customTo || "");
  const [dateError, setDateError] = useStateSB(null);

  const held = new Set(holdings.map(h => h.t));
  const universe = instruments || UNIVERSE;
  const lookupInstrument = ticker => universe.find(u => u.t === ticker) || lookup(ticker);
  const results = !q ? [] : universe.filter(u =>
    (u.t.toLowerCase().includes(q.toLowerCase()) || u.name.toLowerCase().includes(q.toLowerCase()))
  ).slice(0, 7);
  const extTicker = q.trim().toUpperCase();
  const showExtended = open && q.trim().length > 0 && isValidTicker(extTicker) && !held.has(extTicker) && !results.some(r => r.t === extTicker);
  const proxyLabel = !apiStatus?.checked
    ? t(language, "proxyChecking")
    : apiStatus.ok
      ? (apiStatus.hasFinnhubKey ? t(language, "proxyReady") : t(language, "proxyKeyMissing"))
      : t(language, "proxyOffline");
  const proxyTone = !apiStatus?.checked
    ? "checking"
    : apiStatus.ok
      ? (apiStatus.hasFinnhubKey ? "ready" : "warn")
      : "off";
  const marketLabel = marketDataStatus?.status === "ready"
    ? `${t(language, "realPricesCount")} ${marketDataStatus.loaded}/${marketDataStatus.requested}`
    : marketDataStatus?.status === "partial"
      ? `${t(language, "partialPricesCount")} ${marketDataStatus.loaded}/${marketDataStatus.requested}`
      : marketDataStatus?.status === "loading"
        ? t(language, "loadingHistory")
        : t(language, "mockPricesLower");
  const refLabel = referenceDataStatus?.status === "ready"
    ? `${t(language, "quoteProfile")} ${referenceDataStatus.quoteLoaded}/${referenceDataStatus.requested}`
    : referenceDataStatus?.status === "loading"
      ? t(language, "loadingQuoteProfile")
      : t(language, "mockCompanyData");

  useEffectSB(() => {
    function h(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffectSB(() => {
    if (!saveActiveFeedback) return;
    const tid = setTimeout(() => setSaveActiveFeedback(false), 2000);
    return () => clearTimeout(tid);
  }, [saveActiveFeedback]);

  function add(ticker) { if (!held.has(ticker)) onAdd(ticker); setQ(""); setOpen(false); }

  const profileText = id => (PROFILE_COPY[language] && PROFILE_COPY[language][id]) || PROFILE_COPY.en[id] || {};
  const profMeta = profileText(profile);
  const isOverwrite = saveName.trim().length > 0 && savedPortfolios.some(e => e.name === saveName.trim());

  function handleSave() {
    const name = saveName.trim();
    if (!name) { setSaveError(t(language, "saveErrorEmpty")); return; }
    const result = onSavePortfolio(name);
    if (result.ok) {
      setSaveName("");
      setSaveError("");
    } else if (result.error === "max_reached") {
      setSaveError(t(language, "saveErrorMax"));
    } else {
      setSaveError(t(language, "saveErrorStorage"));
    }
  }

  function handleBackupFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target && evt.target.result;
      if (typeof text !== "string") {
        setBackupSummary({ type: "error", message: t(language, "jsonErrorInvalid") });
        return;
      }
      const result = onImportBackup(text);
      if (result.ok) {
        setBackupSummary({ type: "ok", message: t(language, "jsonImportedOk") });
      } else {
        const msgKey = result.error === "unsupported_version" ? "jsonErrorVersion"
          : result.error === "no_valid_holdings" ? "jsonErrorNoHoldings"
          : "jsonErrorInvalid";
        setBackupSummary({ type: "error", message: t(language, msgKey) });
      }
      e.target.value = "";
    };
    reader.onerror = function() {
      setBackupSummary({ type: "error", message: t(language, "jsonErrorInvalid") });
    };
    reader.readAsText(file);
  }

  function handleCsvFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target && evt.target.result;
      if (typeof text !== "string") {
        setCsvSummary({ type: "error", message: t(language, "csvReadError") });
        return;
      }
      const result = onImportCsv(text);
      if (result.importedCount === 0) {
        setCsvSummary({ type: "error", message: null, unsupportedTickers: result.unsupportedTickers, invalidRows: result.invalidRows });
      } else {
        setCsvSummary({ type: "ok", importedCount: result.importedCount, unsupportedTickers: result.unsupportedTickers, invalidRows: result.invalidRows });
      }
      e.target.value = "";
    };
    reader.onerror = function() {
      setCsvSummary({ type: "error", message: t(language, "csvReadError") });
    };
    reader.readAsText(file);
  }

  return (
    <aside className="sidebar">
      {/* brand / header */}
      <div className="sb-brand">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, var(--accent), var(--accent-2))", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><polyline points="3 17 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Quant Portfolio</div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".04em" }}>ANALYTICS</div>
          </div>
        </div>
        <div className="brand-actions">
          <button className="lang-btn" onClick={toggleLanguage} title={t(language, "language")} aria-label={t(language, "language")}>
            {language === "tr" ? "TR" : "EN"}
          </button>
          <button className="theme-btn" onClick={toggleTheme} title={t(language, "toggleTheme")} aria-label={t(language, "toggleTheme")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
        </div>
      </div>

      <div className="sb-scroll">
        {/* ===== TICKER SEARCH / ADD ===== */}
        <div className="sb-block">
          <label className="sb-label">{t(language, "addInstrument")}</label>
          <div className="search-wrap" ref={boxRef}>
            <div className="search-field">
              <Icon name="search" size={15} color="var(--text-faint)" />
              <input value={q} placeholder={t(language, "searchTicker")}
                onChange={e => { setQ(e.target.value); setOpen(true); setActiveIdx(0); }}
                onFocus={() => q && setOpen(true)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { setActiveIdx(i => Math.min(i + 1, results.length - 1)); e.preventDefault(); }
                  else if (e.key === "ArrowUp") { setActiveIdx(i => Math.max(i - 1, 0)); e.preventDefault(); }
                  else if (e.key === "Enter" && results[activeIdx]) add(results[activeIdx].t);
                }} />
              {q && <button className="clear-x" onClick={() => { setQ(""); setOpen(false); }}>×</button>}
            </div>
            {open && (results.length > 0 || showExtended) && (
              <div className="search-dd">
                {results.map((u, i) => (
                  <button key={u.t} className={"dd-row" + (i === activeIdx ? " active" : "")}
                    disabled={held.has(u.t)}
                    onMouseEnter={() => setActiveIdx(i)} onClick={() => add(u.t)}>
                    <span className="num dd-tkr">{u.t}</span>
                    <span className="dd-name">{u.name}</span>
                    <span className="dd-cls">{u.cls}</span>
                    {held.has(u.t) ? <span className="dd-added">{t(language, "added")}</span> : <Icon name="plus" size={13} color="var(--accent)" />}
                  </button>
                ))}
                {showExtended && (
                  <button className="dd-row extended-row" onClick={() => add(extTicker)}>
                    <span className="num dd-tkr">{extTicker}</span>
                    <span className="dd-name">{t(language, "addExtended")}</span>
                    <span className="dd-cls ext-badge">EXT</span>
                    <Icon name="plus" size={13} color="var(--accent)" />
                  </button>
                )}
              </div>
            )}
            {open && q && results.length === 0 && !showExtended && (
              <div className="search-dd"><div className="dd-empty">{t(language, "noMatch")} "{q}"</div></div>
            )}
          </div>
        </div>

        {/* ===== PORTFOLIO LIST ===== */}
        <div className="sb-block">
          <div className="sb-label-row">
            <label className="sb-label">{t(language, "portfolio")}</label>
            <span className="sb-count num">{holdings.length} {holdings.length === 1 ? t(language, "position") : t(language, "positions")}</span>
          </div>
          <div className="holdings">
            {holdings.length === 0 && <div className="holdings-empty">{t(language, "emptyHoldings")}</div>}
            {holdings.map(h => {
              const u = lookupInstrument(h.t);
              const a = assets.find(x => x.t === h.t);
              const isExt = !lookup(h.t);
              return (
                <div key={h.t} className={"hold-row" + (isExt ? " extended-row" : "")}>
                  <div className="hold-main">
                    <span className="num hold-tkr">{h.t}{isExt && <span className="ext-badge">EXT</span>}</span>
                    <span className="hold-name">{u?.name ?? t(language, "extendedUniverse")}</span>
                  </div>
                  <span className="num hold-wt">{a ? (a.weight * 100).toFixed(1) + "%" : "—"}</span>
                  <button className="hold-del" onClick={() => onRemove(h.t)} title={`${t(language, "remove")} ${h.t}`} aria-label={`${t(language, "remove")} ${h.t}`}>
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== LOT ENTRY ===== */}
        {holdings.length > 0 && (
          <div className="sb-block">
            <div className="sb-label-row">
              <label className="sb-label">{t(language, "lotsTitle")}</label>
            </div>
            <p className="sb-help">{t(language, "lotsHelp")}</p>
            <div className="lots">
              {holdings.map(h => {
                const u = lookupInstrument(h.t);
                const a = assets.find(x => x.t === h.t);
                const isExt = !lookup(h.t);
                return (
                  <div key={h.t} className="lot-item">
                    <div className="lot-row">
                      <span className="num lot-tkr">{h.t}{isExt && <span className="ext-badge">EXT</span>}</span>
                      <div className="lot-input">
                        <input type="number" min="0" className="num" value={h.lots}
                          onChange={e => onLots(h.t, Math.max(0, parseInt(e.target.value || "0", 10)))} />
                      </div>
                      <span className="num lot-px">@ ${(a?.px ?? u?.px ?? 100).toFixed(2)}</span>
                      <span className="num lot-val">{a ? fmtUSD(a.value) : "—"}</span>
                    </div>
                    {onCostBasis && (
                      <div className="lot-cost-row">
                        <span className="lot-cost-lbl">{t(language, "averageCost")}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="num lot-cost-input"
                          placeholder="—"
                          value={h.avgCost != null ? h.avgCost : ""}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            onCostBasis(h.t, { avgCost: Number.isFinite(v) && v > 0 ? v : undefined });
                          }}
                        />
                        <span className="lot-cost-lbl">{t(language, "firstBought")}</span>
                        <input
                          type="date"
                          className="lot-date-input"
                          value={h.firstBought || ""}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={e => onCostBasis(h.t, { firstBought: e.target.value || undefined })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {holdings.some(h => !lookup(h.t)) && (
              <p className="ext-note">{t(language, "extendedUniverseNote")}</p>
            )}
            <div className="lot-total">
              <span>{t(language, "portfolioValue")}</span>
              <span className="num">{fmtUSD(totalValue)}</span>
            </div>
          </div>
        )}

        {/* ===== CSV IMPORT / EXPORT ===== */}
        <div className="sb-block">
          <label className="sb-label">{t(language, "csvImportExport")}</label>
          <p className="sb-help" style={{ marginTop: 5 }}>{t(language, "csvImportHelp")}</p>
          <div className="csv-row">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              style={{ display: "none" }}
              onChange={handleCsvFileChange}
            />
            <button className="csv-btn" onClick={() => csvInputRef.current && csvInputRef.current.click()}>
              {t(language, "csvImport")}
            </button>
            <button className="csv-btn" onClick={onExportCsv}>
              {t(language, "csvExport")}
            </button>
          </div>
          {csvSummary && (
            <div className={"csv-summary " + csvSummary.type}>
              {csvSummary.type === "error"
                ? (csvSummary.message || t(language, "csvNoValidRows"))
                : `${csvSummary.importedCount} ${t(language, "csvImportedRows")}${
                    csvSummary.invalidRows > 0 ? ` · ${csvSummary.invalidRows} ${t(language, "csvSkippedRows")}` : ""
                  }${
                    csvSummary.unsupportedTickers && csvSummary.unsupportedTickers.length > 0
                      ? ` · ${t(language, "csvUnsupported")} ${csvSummary.unsupportedTickers.join(", ")}`
                      : ""
                  }`
              }
            </div>
          )}
        </div>

        {/* ===== JSON BACKUP ===== */}
        <div className="sb-block">
          <label className="sb-label">{t(language, "jsonBackup")}</label>
          <p className="sb-help" style={{ marginTop: 5 }}>{t(language, "jsonBackupHelp")}</p>
          <div className="csv-row">
            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleBackupFileChange}
            />
            <button className="csv-btn" onClick={() => backupInputRef.current && backupInputRef.current.click()}>
              {t(language, "jsonImport")}
            </button>
            <button className="csv-btn" onClick={onExportBackup}>
              {t(language, "jsonExport")}
            </button>
          </div>
          {backupSummary && (
            <div className={"csv-summary " + backupSummary.type}>
              {backupSummary.message}
            </div>
          )}
        </div>

        {/* ===== SAVE CURRENT STATE ===== */}
        <div className="sb-block">
          <label className="sb-label">{t(language, "saveActiveState")}</label>
          <button
            className="save-active-btn"
            onClick={() => { if (onSaveActiveState) { onSaveActiveState(); setSaveActiveFeedback(true); } }}
          >
            {t(language, "saveActiveState")}
          </button>
          <div className="save-active-status">
            {saveActiveFeedback
              ? t(language, "activeStateSaved")
              : lastActiveSavedAt
                ? `${t(language, "activeStateLastSaved")} ${new Date(lastActiveSavedAt).toLocaleString()}`
                : t(language, "activeStateNeverSaved")
            }
          </div>
        </div>

        {/* ===== SAVED PORTFOLIOS ===== */}
        <div className="sb-block">
          <div className="sb-label-row">
            <label className="sb-label">{t(language, "savedPortfolios")}</label>
            <span className="sb-count num">{savedPortfolios.length}/10</span>
          </div>
          <div className="save-row">
            <input
              className="save-name-input"
              type="text"
              maxLength={60}
              placeholder={t(language, "portfolioNamePlaceholder")}
              value={saveName}
              onChange={e => { setSaveName(e.target.value); setSaveError(""); }}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
            />
            <button
              className={"save-btn" + (isOverwrite ? " overwrite" : "")}
              onClick={handleSave}
            >
              {isOverwrite ? t(language, "overwritePortfolio") : t(language, "savePortfolio")}
            </button>
          </div>
          {saveError && <p className="save-error">{saveError}</p>}
          {savedPortfolios.length > 0 && (
            <div className="save-list">
              {savedPortfolios.map(entry => (
                <div key={entry.name} className="save-item">
                  <span className="save-item-name" title={entry.name}>{entry.name}</span>
                  <button
                    className="save-load-btn"
                    onClick={() => onLoadPortfolio(entry)}
                  >
                    {t(language, "loadPortfolio")}
                  </button>
                  <button
                    className="hold-del"
                    onClick={() => onDeletePortfolio(entry.name)}
                    title={t(language, "deletePortfolio") + " " + entry.name}
                    aria-label={t(language, "deletePortfolio") + " " + entry.name}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="reset-btn" onClick={onResetPortfolio}>
            {t(language, "resetToDefault")}
          </button>
        </div>

        {/* ===== PORTFOLIO NOTES ===== */}
        <div className="sb-block">
          <label className="sb-label">{t(language, "portfolioNotes")}</label>
          <textarea
            className="note-area"
            maxLength={500}
            placeholder={t(language, "portfolioNotesPlaceholder")}
            value={portfolioNote}
            onChange={e => setPortfolioNote(e.target.value)}
          />
          <div className="note-counter">{portfolioNote.length} / 500 {t(language, "portfolioNotesChars")}</div>
        </div>

        {/* ===== DATE RANGE ===== */}
        <div className="sb-block">
          <div className="sb-label-row">
            <label className="sb-label"><Icon name="calendar" size={12} color="var(--text-faint)" /> {t(language, "dataRange")}</label>
          </div>
          <div className="seg-row">
            {DATE_PRESETS.map(p => (
              <button key={p} className={"seg-btn" + (dateRange === p ? " on" : "")} onClick={() => { setDateRange(p); setDateError(null); }}>{p}</button>
            ))}
          </div>
          {dateRange === "Custom" ? (
            <>
              <div className="date-fields">
                <div className="date-field">
                  <span>{t(language, "from")}</span>
                  <input type="date" className="date-input"
                    value={draftFrom}
                    max={draftTo || new Date().toISOString().slice(0, 10)}
                    onChange={e => {
                      const val = e.target.value;
                      setDraftFrom(val);
                      const err = validateDateRange(val, draftTo);
                      setDateError(err);
                      if (!err && setCustomFrom) setCustomFrom(val);
                    }} />
                </div>
                <div className="date-field">
                  <span>{t(language, "to")}</span>
                  <input type="date" className="date-input"
                    value={draftTo}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => {
                      const val = e.target.value;
                      setDraftTo(val);
                      const err = validateDateRange(draftFrom, val);
                      setDateError(err);
                      if (!err && setCustomTo) setCustomTo(val);
                    }} />
                </div>
              </div>
              {dateError && <p className="date-error">{t(language, dateError)}</p>}
            </>
          ) : (
            <div className="date-fields">
              <div className="date-field"><span>{t(language, "from")}</span><span className="num">{rangeStart(dateRange)}</span></div>
              <div className="date-field"><span>{t(language, "to")}</span><span className="num">{new Date().toISOString().slice(0, 10)}</span></div>
            </div>
          )}
        </div>

        {/* ===== ANALYSIS PROFILE ===== */}
        <div className="sb-block">
          <div className="sb-label-row">
            <label className="sb-label">{t(language, "analysisProfile")}</label>
          </div>
          <div className="prof-grid">
            {PROFILES.map(p => (
              <button key={p.id} className={"prof-btn" + (profile === p.id ? " on" : "")} onClick={() => setProfile(p.id)}>
                {profileText(p.id).label}
              </button>
            ))}
          </div>
          <p className="sb-help" style={{ marginTop: 9 }}>{profMeta.help}</p>
        </div>

        {/* ===== ADVANCED ASSUMPTIONS ===== */}
        <div className="sb-block">
          <button className="adv-toggle" onClick={() => setAdvOpen(o => !o)}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Icon name="sliders" size={13} color="var(--text-faint)" /> {t(language, "advancedAssumptions")}</span>
            <span style={{ transform: advOpen ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-flex" }}><Icon name="chevron" size={13} color="var(--text-faint)" /></span>
          </button>
          {advOpen && (
            <div className="adv-body fade-up">
              <div className="adv-field">
                <div className="adv-head"><span>{t(language, "riskFreeRate")}</span><span className="num">{(assumptions.rf * 100).toFixed(1)}%</span></div>
                <input type="range" min="0" max="6" step="0.1" value={assumptions.rf * 100}
                  onChange={e => setAssumptions({ ...assumptions, rf: +e.target.value / 100 })} />
                <p className="sb-help">{t(language, "rfHelp")}</p>
              </div>
              <div className="adv-field">
                <div className="adv-head"><span>{t(language, "mcHorizon")}</span><span className="num">{assumptions.horizon}y</span></div>
                <input type="range" min="1" max="10" step="1" value={assumptions.horizon}
                  onChange={e => setAssumptions({ ...assumptions, horizon: +e.target.value })} />
                <p className="sb-help">{t(language, "mcHorizonHelp")}</p>
              </div>
              <div className="adv-field">
                <div className="adv-head"><span>{t(language, "mcPaths")}</span><span className="num">{assumptions.paths.toLocaleString()}</span></div>
                <input type="range" min="200" max="5000" step="200" value={assumptions.paths}
                  onChange={e => setAssumptions({ ...assumptions, paths: +e.target.value })} />
                <p className="sb-help">{t(language, "mcPathsHelp")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* footer status */}
      <div className="sb-foot">
        <div className="sb-foot-lines">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="live-dot" /> {dataSource?.modeLabel || t(language, "dataAdapterReady")}
          </span>
          <span className="proxy-state">
            <span className={"proxy-dot " + proxyTone} /> {proxyLabel}
          </span>
          <span className="proxy-state">
            <span className={"proxy-dot " + (marketDataStatus?.status === "ready" ? "ready" : marketDataStatus?.status === "partial" ? "warn" : "checking")} /> {marketLabel}
          </span>
          <span className="proxy-state">
            <span className={"proxy-dot " + (referenceDataStatus?.status === "ready" ? "ready" : referenceDataStatus?.status === "loading" ? "checking" : "warn")} /> {refLabel}
          </span>
          <span style={{ color: "var(--text-faint)", fontSize: "9.5px", lineHeight: "1.4", marginTop: "3px", letterSpacing: "0.01em" }}>
            {language === "tr" ? "Yalnızca analitik araç — yatırım tavsiyesi değildir." : "Analytics only — not financial advice."}
          </span>
        </div>
        <span className="num" style={{ color: "var(--text-faint)" }}>{lastUpdated}</span>
      </div>

      <style>{`
        .sidebar { width: var(--sidebar-w); flex-shrink: 0; background: var(--bg-2);
          border-right: 1px solid var(--border); display: flex; flex-direction: column; height: 100%; }
        .sb-brand { display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .brand-actions { display: flex; align-items: center; gap: 6px; }
        .lang-btn { min-width: 36px; height: 30px; padding: 0 9px; border-radius: 8px; display: grid; place-items: center;
          color: var(--text-dim); border: 1px solid var(--border-soft); background: var(--panel); font-size: 11px; font-weight: 700; }
        .lang-btn:hover { color: var(--text); background: var(--panel-hi); }
        .theme-btn { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
          color: var(--text-dim); border: 1px solid var(--border-soft); background: var(--panel); }
        .theme-btn:hover { color: var(--text); background: var(--panel-hi); }

        .sb-scroll { flex: 1; overflow-y: auto; padding: 4px 0 8px; }
        .sb-block { padding: 14px 16px; border-bottom: 1px solid var(--border-soft); }
        .sb-label { font-size: 10.5px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
          color: var(--text-faint); display: inline-flex; align-items: center; gap: 5px; }
        .sb-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
        .sb-count { font-size: 10.5px; color: var(--text-faint); }
        .sb-help { font-size: 10.5px; color: var(--text-faint); line-height: 1.5; margin: 7px 0 0; }

        /* search */
        .search-wrap { position: relative; margin-top: 9px; }
        .search-field { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 38px;
          background: var(--panel); border: 1px solid var(--border); border-radius: var(--r-md); }
        .search-field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .search-field input { flex: 1; border: none; background: none; outline: none; font-size: 13px; min-width: 0; }
        .clear-x { color: var(--text-faint); font-size: 17px; line-height: 1; padding: 0 2px; }
        .clear-x:hover { color: var(--text); }
        .search-dd { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 30;
          background: var(--panel); border: 1px solid var(--border); border-radius: var(--r-md);
          box-shadow: var(--shadow); overflow: hidden; padding: 4px; }
        .dd-row { display: grid; grid-template-columns: 46px 1fr auto auto; align-items: center; gap: 8px;
          width: 100%; padding: 7px 8px; border-radius: 6px; text-align: left; }
        .dd-row:hover, .dd-row.active { background: var(--panel-hi); }
        .dd-row:disabled { opacity: .5; cursor: default; }
        .dd-tkr { font-size: 12px; font-weight: 600; color: var(--text); }
        .dd-name { font-size: 11px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dd-cls { font-size: 9.5px; color: var(--text-faint); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; }
        .dd-added { font-size: 9.5px; color: var(--text-faint); }
        .dd-empty { padding: 12px; font-size: 12px; color: var(--text-faint); text-align: center; }

        /* holdings */
        .holdings { display: flex; flex-direction: column; gap: 2px; }
        .holdings-empty { font-size: 11.5px; color: var(--text-faint); padding: 8px 2px; line-height: 1.5; }
        .hold-row { display: grid; grid-template-columns: 1fr auto 26px; align-items: center; gap: 8px;
          padding: 7px 8px; border-radius: 7px; }
        .hold-row:hover { background: var(--panel); }
        .hold-main { min-width: 0; }
        .hold-tkr { font-size: 12.5px; font-weight: 600; color: var(--text); }
        .hold-name { display: block; font-size: 10.5px; color: var(--text-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hold-wt { font-size: 11.5px; color: var(--text-dim); font-weight: 600; }
        .hold-del { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; color: var(--text-faint); }
        .hold-del:hover { background: var(--neg-soft); color: var(--neg); }

        /* lots */
        .lots { display: flex; flex-direction: column; gap: 5px; margin-top: 9px; }
        .lot-row { display: grid; grid-template-columns: 42px 1fr auto auto; align-items: center; gap: 8px; }
        .lot-tkr { font-size: 12px; font-weight: 600; color: var(--text-dim); }
        .lot-input input { width: 100%; height: 30px; padding: 0 8px; border-radius: 6px; text-align: right;
          border: 1px solid var(--border); background: var(--panel); font-size: 12.5px; outline: none; -moz-appearance: textfield; }
        .lot-input input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
        .lot-input input::-webkit-outer-spin-button, .lot-input input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .lot-px { font-size: 10px; color: var(--text-faint); white-space: nowrap; }
        .lot-val { font-size: 11px; color: var(--text-dim); min-width: 56px; text-align: right; }
        .lot-total { display: flex; justify-content: space-between; align-items: center; margin-top: 11px;
          padding-top: 10px; border-top: 1px dashed var(--border); font-size: 11.5px; color: var(--text-faint); }
        .lot-total .num { font-size: 14px; font-weight: 700; color: var(--text); }
        .lot-item { display: flex; flex-direction: column; gap: 3px; }
        .lot-cost-row { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 5px; padding: 0 2px; }
        .lot-cost-lbl { font-size: 9.5px; color: var(--text-faint); white-space: nowrap; letter-spacing: .02em; }
        .lot-cost-input { width: 100%; height: 26px; padding: 0 6px; border-radius: 5px; text-align: right;
          border: 1px solid var(--border); background: var(--panel); font-size: 11.5px; outline: none; color: var(--text);
          -moz-appearance: textfield; }
        .lot-cost-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
        .lot-cost-input::-webkit-outer-spin-button, .lot-cost-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .lot-date-input { height: 26px; padding: 0 4px; border-radius: 5px; font-size: 11px; color: var(--text);
          background: var(--panel); border: 1px solid var(--border); outline: none; cursor: pointer; }
        .lot-date-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }

        /* date presets */
        .seg-row { display: grid; grid-template-columns: repeat(5,1fr); gap: 4px; }
        .seg-btn { padding: 6px 0; font-size: 11px; font-weight: 600; border-radius: 6px;
          color: var(--text-faint); background: var(--panel); border: 1px solid var(--border-soft); }
        .seg-btn.on { color: white; background: var(--accent); border-color: var(--accent); }
        .seg-btn:not(.on):hover { color: var(--text); background: var(--panel-hi); }
        .date-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 9px; }
        .date-field { display: flex; flex-direction: column; gap: 2px; padding: 7px 10px; border-radius: 7px;
          background: var(--panel); border: 1px solid var(--border-soft); }
        .date-field span:first-child { font-size: 9.5px; color: var(--text-faint); text-transform: uppercase; letter-spacing: .05em; }
        .date-field span:last-child { font-size: 12px; color: var(--text); }
        .date-input { font-size: 12px; color: var(--text); background: transparent; border: none;
          padding: 0; width: 100%; cursor: pointer; }
        .date-error { font-size: 11px; color: var(--neg); margin-top: 6px; text-align: center; }

        /* profile */
        .prof-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
        .prof-btn { padding: 8px 4px; font-size: 11px; font-weight: 600; border-radius: 7px; line-height: 1.2;
          color: var(--text-dim); background: var(--panel); border: 1px solid var(--border); }
        .prof-btn.on { color: var(--accent); background: var(--accent-soft); border-color: color-mix(in oklch, var(--accent), transparent 50%); }
        .prof-btn:not(.on):hover { background: var(--panel-hi); color: var(--text); }

        /* advanced */
        .adv-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%;
          font-size: 11.5px; font-weight: 600; color: var(--text-dim); }
        .adv-toggle:hover { color: var(--text); }
        .adv-body { display: flex; flex-direction: column; gap: 16px; margin-top: 14px; }
        .adv-head { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-dim); margin-bottom: 7px; }
        .adv-head .num { color: var(--text); font-weight: 600; }
        .adv-field input[type=range] { width: 100%; accent-color: var(--accent); height: 4px; }

        /* footer */
        .sb-foot { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
          gap: 10px; padding: 10px 16px; border-top: 1px solid var(--border); font-size: 10.5px; color: var(--text-dim); }
        .sb-foot-lines { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .live-dot { width: 7px; height: 7px; border-radius: 99px; background: var(--pos);
          box-shadow: 0 0 0 0 var(--pos-soft); animation: pulse 2s infinite; }
        .proxy-state { display: inline-flex; align-items: center; gap: 6px; color: var(--text-faint); }
        .proxy-dot { width: 6px; height: 6px; border-radius: 99px; background: var(--text-faint); }
        .proxy-dot.ready { background: var(--pos); }
        .proxy-dot.warn { background: var(--warn); }
        .proxy-dot.off { background: var(--neg); }
        .proxy-dot.checking { background: var(--accent); }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 var(--pos-soft); } 70% { box-shadow: 0 0 0 6px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

        /* csv import / export */
        .csv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 9px; }
        .csv-btn { padding: 7px 0; border-radius: 7px; font-size: 11.5px; font-weight: 600;
          border: 1px solid var(--border); background: var(--panel); color: var(--text-dim); }
        .csv-btn:hover { background: var(--panel-hi); color: var(--text); }
        .csv-summary { margin-top: 7px; font-size: 10.5px; line-height: 1.4; padding: 5px 8px; border-radius: 6px; }
        .csv-summary.ok { color: var(--pos); background: color-mix(in oklch, var(--pos), transparent 88%); }
        .csv-summary.error { color: var(--neg); background: color-mix(in oklch, var(--neg), transparent 88%); }

        /* saved portfolios */
        .save-row { display: grid; grid-template-columns: 1fr auto; gap: 6px; margin-top: 9px; }
        .save-name-input { width: 100%; height: 32px; padding: 0 9px; border-radius: 6px; font-size: 12.5px;
          border: 1px solid var(--border); background: var(--panel); outline: none; color: var(--text); min-width: 0; }
        .save-name-input::placeholder { color: var(--text-faint); }
        .save-name-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
        .save-btn { height: 32px; padding: 0 11px; border-radius: 6px; font-size: 11.5px; font-weight: 600;
          white-space: nowrap; background: var(--accent-soft); color: var(--accent);
          border: 1px solid color-mix(in oklch, var(--accent), transparent 55%); }
        .save-btn:hover { background: var(--accent); color: white; }
        .save-btn.overwrite { background: color-mix(in oklch, var(--warn), transparent 85%); color: var(--warn);
          border-color: color-mix(in oklch, var(--warn), transparent 55%); }
        .save-btn.overwrite:hover { background: var(--warn); color: white; }
        .save-error { font-size: 10.5px; color: var(--neg); margin: 5px 0 0; line-height: 1.4; }
        .save-list { display: flex; flex-direction: column; gap: 2px; margin-top: 9px; }
        .save-item { display: grid; grid-template-columns: 1fr auto 26px; align-items: center; gap: 6px;
          padding: 5px 8px; border-radius: 7px; }
        .save-item:hover { background: var(--panel); }
        .save-item-name { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .save-load-btn { font-size: 11px; font-weight: 600; color: var(--accent); padding: 3px 8px;
          border-radius: 5px; background: var(--accent-soft); white-space: nowrap;
          border: 1px solid color-mix(in oklch, var(--accent), transparent 60%); }
        .save-load-btn:hover { background: var(--accent); color: white; }
        .reset-btn { margin-top: 10px; width: 100%; padding: 7px 0; border-radius: 7px; font-size: 11.5px;
          font-weight: 500; color: var(--text-faint); background: transparent;
          border: 1px dashed var(--border); }
        .reset-btn:hover { color: var(--text-dim); background: var(--panel); border-style: solid; }

        /* portfolio notes */
        .note-area { width: 100%; min-height: 72px; margin-top: 9px; padding: 8px 10px;
          border-radius: 7px; border: 1px solid var(--border); background: var(--panel);
          color: var(--text); font-size: 12px; line-height: 1.5; resize: vertical;
          font-family: inherit; outline: none; box-sizing: border-box; }
        .note-area::placeholder { color: var(--text-faint); }
        .note-area:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
        .note-counter { font-size: 10px; color: var(--text-faint); text-align: right; margin-top: 4px; }

        /* save current state */
        .save-active-btn { width: 100%; margin-top: 9px; padding: 8px 0; border-radius: 7px;
          font-size: 12px; font-weight: 600; color: white; background: var(--accent);
          border: 1px solid color-mix(in oklch, var(--accent), transparent 30%); }
        .save-active-btn:hover { filter: brightness(1.1); }
        .save-active-status { margin-top: 6px; font-size: 10.5px; color: var(--text-faint);
          line-height: 1.4; min-height: 16px; }

        /* extended universe */
        .extended-row { background: color-mix(in oklch, var(--warn), transparent 92%); }
        .extended-row:hover { background: color-mix(in oklch, var(--warn), transparent 85%); }
        .ext-badge { display: inline-block; font-size: 8.5px; font-weight: 700; letter-spacing: .05em;
          color: var(--warn); border: 1px solid color-mix(in oklch, var(--warn), transparent 55%);
          border-radius: 4px; padding: 0 4px; margin-left: 5px; vertical-align: middle; line-height: 1.6; }
        .ext-note { font-size: 10px; color: var(--warn); margin-top: 8px; line-height: 1.4;
          padding: 4px 8px; border-radius: 5px;
          background: color-mix(in oklch, var(--warn), transparent 90%); }
      `}</style>
    </aside>
  );
}

function rangeStart(r) {
  const days = { "6M": 190, "1Y": 380, "2Y": 760, "5Y": 1900 };
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days[r] || 760));
  return d.toISOString().slice(0, 10);
}
