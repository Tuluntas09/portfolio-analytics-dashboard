/* ============================================================
   src/app.jsx — Vite-native root: state, theme, tab nav, layout.
   Mechanical port of public/legacy/app.jsx.

   All window.* consumer references replaced with explicit ES module
   imports from the already-extracted src/ layer. No window globals
   are read by this file except the two intentional PPTX export hooks
   registered at the bottom (window.__exportTab, window.__exportDone).

   Migration phase: 6i.
   public/legacy/app.jsx is preserved unchanged as the legacy reference.
   ============================================================ */
/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { DATA_SOURCES, ACTIVE_DATA_ADAPTER, DEFAULT_LOTS, UNIVERSE, isValidTicker } from "./data.js";
import { loadSaves, savePortfolio, deletePortfolio, validateEntry, STORAGE_KEY } from "./portfolioStorage.js";
import { exportBackup, importBackup, makeBackupFilename } from "./portfolioBackup.js";
import { loadSnapshots, recordSnapshot, calcDeltas, exportSnapshots, importSnapshots } from "./portfolioSnapshots.js";
import { saveActiveState, loadActiveState } from "./activePortfolioState.js";
import { parseHoldingsCsv, serializeHoldingsCsv } from "./holdingsCsv.js";
import { getDefaultCustomFrom, calendarToTradingDays } from "./dateUtils.js";
import { fmtUSD, fmtPctSigned, fmtNum, fmtPct, t } from "./ui.js";
import { Pill } from "./ui.jsx";
import { Sidebar } from "./sidebar.jsx";
import { OverviewTab, RiskTab } from "./views/overview.jsx";
import { AnalysisTab, OptimizationTab, SimulationTab, CompanyTab, DataTab } from "./views/analysis.jsx";

const TABS = [
  { id: "overview", en: "Overview", tr: "Özet" },
  { id: "risk", en: "Risk", tr: "Risk" },
  { id: "optimization", en: "Portfolio Improvement", tr: "Portföy İyileştirme" },
  { id: "simulation", en: "Simulation", tr: "Simülasyon" },
  { id: "analysis", en: "Performance Analysis", tr: "Performans Analizi" },
  { id: "company", en: "Company Data", tr: "Şirket Verisi" },
  { id: "data", en: "Data", tr: "Veri" },
];
const PROFILE_LABELS = {
  en: { balanced: "Balanced", risk: "Risk-focused", return: "Return-focused" },
  tr: { balanced: "Dengeli", risk: "Risk odaklı", return: "Getiri odaklı" },
};
const API_BASE_URL = DATA_SOURCES.real && DATA_SOURCES.real.baseUrl ? DATA_SOURCES.real.baseUrl : "http://127.0.0.1:8787";
const API_HEALTH_URL = API_BASE_URL + "/api/health";
function historyWindow(range, customFrom, customTo) {
  if (range === "Custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  const daysForRange = { "6M": 190, "1Y": 380, "2Y": 760, "5Y": 1900 };
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (daysForRange[range] || 760));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function App() {
  const dataAdapter = ACTIVE_DATA_ADAPTER;
  const [theme, setTheme] = useState(() => localStorage.getItem("qpa-theme") || "dark");
  const [language, setLanguage] = useState(() => localStorage.getItem("qpa-language") || "tr");
  const [holdings, setHoldings] = useState(() => {
    const saved = loadActiveState();
    return saved ? saved.holdings : Object.entries(DEFAULT_LOTS).map(([t, lots]) => ({ t, lots }));
  });
  const [dateRange, setDateRange] = useState("2Y");
  const [customFrom, setCustomFrom] = useState(getDefaultCustomFrom);
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [profile, setProfile] = useState("balanced");
  const [assumptions, setAssumptions] = useState(() => {
    const saved = loadActiveState();
    return saved ? saved.assumptions : { rf: 0.043, horizon: 5, paths: 2000 };
  });
  const [tab, setTab] = useState("overview");
  const [apiStatus, setApiStatus] = useState({
    checked: false,
    ok: false,
    hasFinnhubKey: false,
    message: "Checking proxy",
  });
  const [rateLimitWarning, setRateLimitWarning] = useState(false);
  const [historyBySymbol, setHistoryBySymbol] = useState({});
  const [quoteBySymbol, setQuoteBySymbol] = useState({});
  const [profileBySymbol, setProfileBySymbol] = useState({});
  const [marketDataStatus, setMarketDataStatus] = useState({
    status: "idle",
    message: "Mock price model",
    loaded: 0,
    requested: 0,
  });
  const [referenceDataStatus, setReferenceDataStatus] = useState({
    status: "idle",
    quoteLoaded: 0,
    profileLoaded: 0,
    requested: 0,
  });
  const [savedPortfolios, setSavedPortfolios] = useState(() => loadSaves());
  const [portfolioNote, setPortfolioNote] = useState(() => {
    const saved = loadActiveState();
    return saved ? saved.notes : "";
  });
  const [snapshots, setSnapshots] = useState(() => loadSnapshots());
  const [lastActiveSavedAt, setLastActiveSavedAt] = useState(() => {
    const saved = loadActiveState();
    return saved ? saved.savedAt : null;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("qpa-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", language);
    localStorage.setItem("qpa-language", language);
  }, [language]);

  useEffect(() => {
    let active = true;
    fetch(API_HEALTH_URL)
      .then(r => r.json().then(body => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!active) return;
        setApiStatus({
          checked: true,
          ok: ok && body.ok === true,
          hasFinnhubKey: Boolean(body.hasFinnhubKey),
          message: ok && body.ok === true ? "Proxy online" : "Proxy health failed",
        });
      })
      .catch(() => {
        if (!active) return;
        setApiStatus({
          checked: true,
          ok: false,
          hasFinnhubKey: false,
          message: "Proxy offline",
        });
      });
    return () => { active = false; };
  }, []);

  const daysFor = { "6M": 126, "1Y": 252, "2Y": 504, "5Y": 1260 };

  useEffect(() => {
    const symbols = holdings.map(h => h.t);
    if (!symbols.length) {
      setHistoryBySymbol({});
      setMarketDataStatus({ status: "idle", message: "No holdings selected", loaded: 0, requested: 0 });
      return;
    }
    if (!apiStatus.ok) {
      setHistoryBySymbol({});
      setMarketDataStatus({ status: "mock", message: "Using mock prices until proxy is online", loaded: 0, requested: symbols.length });
      return;
    }

    const controller = new AbortController();
    const { from, to } = historyWindow(dateRange, customFrom, customTo);
    const uniqueSymbols = Array.from(new Set([...symbols, "VTI"]));
    setMarketDataStatus({ status: "loading", message: "Loading market history", loaded: 0, requested: symbols.length });

    Promise.all(uniqueSymbols.map(symbol => {
      const url = `${API_BASE_URL}/api/market/history?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`;
      return fetch(url, { signal: controller.signal })
        .then(r => r.json().then(body => ({ symbol, ok: r.ok && body.ok, body })))
        .catch(error => ({ symbol, ok: false, body: { error: error.message } }));
    })).then(results => {
      if (controller.signal.aborted) return;
      const nextHistory = {};
      results.forEach(result => {
        if (result.body?.error === "rate_limited") setRateLimitWarning(true);
        if (result.ok && Array.isArray(result.body.candles) && result.body.candles.length > 1) {
          nextHistory[result.symbol] = result.body;
        }
      });
      const loadedHoldings = symbols.filter(symbol => nextHistory[symbol]).length;
      setHistoryBySymbol(nextHistory);
      setMarketDataStatus({
        status: loadedHoldings === symbols.length ? "ready" : loadedHoldings > 0 ? "partial" : "mock",
        message: loadedHoldings === symbols.length
          ? "Real price history loaded"
          : loadedHoldings > 0
            ? "Partial real history loaded"
            : "Real history unavailable, using mock prices",
        loaded: loadedHoldings,
        requested: symbols.length,
      });
    });

    return () => controller.abort();
  }, [holdings, dateRange, customFrom, customTo, apiStatus.ok]);

  useEffect(() => {
    const symbols = holdings.map(h => h.t);
    if (!symbols.length) {
      setQuoteBySymbol({});
      setProfileBySymbol({});
      setReferenceDataStatus({ status: "idle", quoteLoaded: 0, profileLoaded: 0, requested: 0 });
      return;
    }
    if (!apiStatus.ok) {
      setQuoteBySymbol({});
      setProfileBySymbol({});
      setReferenceDataStatus({ status: "mock", quoteLoaded: 0, profileLoaded: 0, requested: symbols.length });
      return;
    }

    const controller = new AbortController();
    const uniqueSymbols = Array.from(new Set(symbols));
    setReferenceDataStatus({ status: "loading", quoteLoaded: 0, profileLoaded: 0, requested: symbols.length });

    Promise.all(uniqueSymbols.flatMap(symbol => ([
      fetch(`${API_BASE_URL}/api/market/quote?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
        .then(r => r.json().then(body => ({ type: "quote", symbol, ok: r.ok && body.ok, body })))
        .catch(error => ({ type: "quote", symbol, ok: false, body: { error: error.message } })),
      fetch(`${API_BASE_URL}/api/company/profile?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal })
        .then(r => r.json().then(body => ({ type: "profile", symbol, ok: r.ok && body.ok, body })))
        .catch(error => ({ type: "profile", symbol, ok: false, body: { error: error.message } })),
    ]))).then(results => {
      if (controller.signal.aborted) return;
      const nextQuotes = {};
      const nextProfiles = {};
      results.forEach(result => {
        if (result.body?.error === "rate_limited") setRateLimitWarning(true);
        if (!result.ok || !result.body?.data || !Object.keys(result.body.data).length) return;
        if (result.type === "quote") nextQuotes[result.symbol] = result.body.data;
        if (result.type === "profile") nextProfiles[result.symbol] = result.body.data;
      });
      const quoteLoaded = symbols.filter(symbol => nextQuotes[symbol]).length;
      const profileLoaded = symbols.filter(symbol => nextProfiles[symbol]).length;
      setQuoteBySymbol(nextQuotes);
      setProfileBySymbol(nextProfiles);
      setReferenceDataStatus({
        status: quoteLoaded || profileLoaded ? "ready" : "mock",
        quoteLoaded,
        profileLoaded,
        requested: symbols.length,
      });
    });

    return () => controller.abort();
  }, [holdings, apiStatus.ok]);

  const p = useMemo(() => {
    const days = dateRange === "Custom"
      ? calendarToTradingDays(customFrom, customTo)
      : (daysFor[dateRange] || 504);
    return dataAdapter.buildPortfolio(holdings, {
      days, profile,
      rf: assumptions.rf,
      seed: 20260604 + (dateRange.length * 13),
      source: Object.keys(historyBySymbol).length || Object.keys(quoteBySymbol).length || Object.keys(profileBySymbol).length ? "real" : "mock",
      historyBySymbol,
      quoteBySymbol,
      profileBySymbol,
    });
  }, [holdings, dateRange, customFrom, customTo, profile, dataAdapter, historyBySymbol, quoteBySymbol, profileBySymbol, assumptions.rf]);

  // apply risk-free assumption to derived stats
  const pAdj = useMemo(() => {
    const sharpe = p.annVol > 0 ? (p.annRet - assumptions.rf) / p.annVol : 0;
    const sortino = p.annVol > 0 ? (p.annRet - assumptions.rf) / (p.annVol * 0.72) : 0;
    return { ...p, rf: assumptions.rf, sharpe, sortino };
  }, [p, assumptions.rf]);

  useEffect(() => {
    if (pAdj.source?.id !== "real") return;
    if (marketDataStatus.status !== "ready") return;
    if (typeof pAdj.totalValue !== "number" || !Number.isFinite(pAdj.totalValue) || pAdj.totalValue <= 0) return;
    const result = recordSnapshot(pAdj.totalValue, "real");
    if (result.ok) setSnapshots(loadSnapshots());
  }, [pAdj.source?.id, pAdj.totalValue, marketDataStatus.status]);

  const snapshotDeltas = useMemo(
    () => calcDeltas(snapshots, pAdj.totalValue),
    [snapshots, pAdj.totalValue]
  );

  function addTicker(t) {
    if (!isValidTicker(t)) return;
    setHoldings(h => h.find(x => x.t === t) ? h : [...h, { t, lots: 50 }]);
  }
  function removeTicker(t) { setHoldings(h => h.filter(x => x.t !== t)); }
  function setLots(t, lots) { setHoldings(h => h.map(x => x.t === t ? { ...x, lots } : x)); }
  function setCostBasis(ticker, fields) {
    setHoldings(h => h.map(x => {
      if (x.t !== ticker) return x;
      const updated = { ...x };
      if ("avgCost" in fields) {
        if (fields.avgCost !== undefined) updated.avgCost = fields.avgCost;
        else delete updated.avgCost;
      }
      if ("firstBought" in fields) {
        if (fields.firstBought !== undefined) updated.firstBought = fields.firstBought;
        else delete updated.firstBought;
      }
      return updated;
    }));
  }

  function handleSavePortfolio(name) {
    const result = savePortfolio(name, holdings, assumptions, portfolioNote);
    if (result.ok) setSavedPortfolios(loadSaves());
    return result;
  }
  function handleLoadPortfolio(entry) {
    const loaded = validateEntry(entry, { has: t => isValidTicker(t) });
    if (!loaded) return false;
    setHoldings(loaded.holdings);
    setAssumptions(loaded.assumptions);
    setPortfolioNote(loaded.notes ?? "");
    return true;
  }
  function handleDeletePortfolio(name) {
    deletePortfolio(name);
    setSavedPortfolios(loadSaves());
  }
  function handleResetPortfolio() {
    setHoldings(Object.entries(DEFAULT_LOTS).map(([tkr, lots]) => ({ t: tkr, lots })));
    setAssumptions({ rf: 0.043, horizon: 5, paths: 2000 });
    setPortfolioNote("");
  }

  function handleImportCsv(csvText) {
    const result = parseHoldingsCsv(csvText, { has: t => isValidTicker(t) });
    if (result.importedCount > 0) setHoldings(result.holdings);
    return result;
  }

  function handleExportCsv() {
    const text = serializeHoldingsCsv(holdings);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio-holdings.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportBackup() {
    const payload = exportBackup(holdings, assumptions, portfolioNote, savedPortfolios, exportSnapshots());
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = makeBackupFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportBackup(jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { ok: false, error: "parse_error" };
    }
    const result = importBackup(parsed, { has: t => isValidTicker(t) });
    if (result.ok) {
      setHoldings(result.current.holdings);
      setAssumptions(result.current.assumptions);
      setPortfolioNote(result.current.notes);
      setSavedPortfolios(result.savedPortfolios);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.savedPortfolios));
      if (Array.isArray(result.snapshots) && result.snapshots.length > 0) {
        importSnapshots(result.snapshots);
        setSnapshots(loadSnapshots());
      }
      const saveResult = saveActiveState(result.current.holdings, result.current.assumptions, result.current.notes);
      if (saveResult.ok) setLastActiveSavedAt(saveResult.savedAt);
    }
    return result;
  }

  function handleSaveActiveState() {
    const result = saveActiveState(holdings, assumptions, portfolioNote);
    if (result.ok) setLastActiveSavedAt(result.savedAt);
  }

  function handlePrintReport() {
    document.body.classList.add("export-mode");
    addEventListener("afterprint", () => document.body.classList.remove("export-mode"), { once: true });
    window.print();
  }

  const empty = holdings.length === 0;
  const tabLabel = id => {
    const found = TABS.find(t => t.id === id);
    return found ? (found[language] || found.en) : id;
  };
  const profileLabel = (PROFILE_LABELS[language] && PROFILE_LABELS[language][profile]) || PROFILE_LABELS.en[profile];

  return (
    <div className="app">
      <Sidebar
        holdings={holdings} assets={pAdj.assets} totalValue={pAdj.totalValue}
        instruments={dataAdapter.listInstruments()} dataSource={pAdj.source}
        onAdd={addTicker} onRemove={removeTicker} onLots={setLots}
        dateRange={dateRange} setDateRange={setDateRange}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo} setCustomTo={setCustomTo}
        profile={profile} setProfile={setProfile}
        assumptions={assumptions} setAssumptions={setAssumptions}
        theme={theme} toggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
        language={language} toggleLanguage={() => setLanguage(l => l === "tr" ? "en" : "tr")}
        apiStatus={apiStatus}
        marketDataStatus={marketDataStatus}
        referenceDataStatus={referenceDataStatus}
        lastUpdated={pAdj.source.lastUpdated}
        savedPortfolios={savedPortfolios}
        onSavePortfolio={handleSavePortfolio}
        onLoadPortfolio={handleLoadPortfolio}
        onDeletePortfolio={handleDeletePortfolio}
        onResetPortfolio={handleResetPortfolio}
        onImportCsv={handleImportCsv}
        onExportCsv={handleExportCsv}
        portfolioNote={portfolioNote}
        setPortfolioNote={setPortfolioNote}
        onCostBasis={setCostBasis}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onSaveActiveState={handleSaveActiveState}
        lastActiveSavedAt={lastActiveSavedAt} />

      <main className="main">
        {/* top bar */}
        <header className="topbar">
          <div className="topbar-title">
            <h1>{tabLabel(tab)}</h1>
            <div className="topbar-sub">
              <span className="num">{pAdj.assets.length} {t(language, "holdings")}</span>
              <span className="dot-sep" />
              <span className="num">{fmtUSD(pAdj.totalValue)}</span>
              <span className="dot-sep" />
              <span>{dateRange === "Custom" ? `${customFrom} → ${customTo}` : dateRange} {t(language, "range")}</span>
              <span className="dot-sep" />
              <Pill tone="accent" size="sm">{profileLabel}</Pill>
              <Pill tone={marketDataStatus.status === "ready" ? "pos" : marketDataStatus.status === "partial" ? "warn" : "neutral"} size="sm">
                {marketDataStatus.status === "ready" ? t(language, "realPrices") : marketDataStatus.status === "loading" ? t(language, "loadingPrices") : marketDataStatus.status === "partial" ? t(language, "partialPrices") : t(language, "mockPrices")}
              </Pill>
            </div>
          </div>
          <div className="topbar-right">
            <div className="head-metric">
              <span className="eyebrow">{t(language, "annReturn")}</span>
              <span className="num" style={{ color: pAdj.annRet >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtPctSigned(pAdj.annRet)}</span>
            </div>
            <div className="head-metric">
              <span className="eyebrow">{t(language, "sharpe")}</span>
              <span className="num">{fmtNum(pAdj.sharpe)}</span>
            </div>
            <div className="head-metric">
              <span className="eyebrow">{t(language, "maxDd")}</span>
              <span className="num" style={{ color: "var(--neg)" }}>{fmtPct(pAdj.mdd)}</span>
            </div>
            <button className="print-btn" onClick={handlePrintReport}>{t(language, "printReport")}</button>
          </div>
        </header>

        {/* tab nav */}
        <nav className="tabnav">
          {TABS.map(t => (
            <button key={t.id} className={"tab-btn" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>
              {tabLabel(t.id)}
            </button>
          ))}
        </nav>

        {/* rate limit warning — compact, non-blocking, non-modal */}
        {rateLimitWarning && (
          <div className="rate-limit-banner">{t(language, "rateLimitWarn")}</div>
        )}

        {/* content */}
        <div className="content">
          {empty ? (
            <div className="empty-state">
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{t(language, "noHoldingsYet")}</div>
              <p style={{ fontSize: 13, color: "var(--text-faint)", maxWidth: 320, margin: "8px auto 0", lineHeight: 1.55 }}>
                {t(language, "emptyStateHelp")}
              </p>
            </div>
          ) : (
            <>
              {tab === "overview" && <OverviewTab p={pAdj} language={language} snapshots={snapshots} snapshotDeltas={snapshotDeltas} />}
              {tab === "risk" && <RiskTab p={pAdj} language={language} />}
              {tab === "analysis" && <AnalysisTab p={pAdj} language={language} />}
              {tab === "optimization" && <OptimizationTab p={pAdj} language={language} />}
              {tab === "simulation" && <SimulationTab p={pAdj} assumptions={assumptions} language={language} />}
              {tab === "company" && <CompanyTab p={pAdj} referenceDataStatus={referenceDataStatus} apiStatus={apiStatus} language={language} />}
              {tab === "data" && <DataTab p={pAdj} dateRange={dateRange} apiStatus={apiStatus} marketDataStatus={marketDataStatus} referenceDataStatus={referenceDataStatus} language={language} />}
            </>
          )}
        </div>
      </main>

      <style>{`
        .app { display: flex; height: 100vh; overflow: hidden; }
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); }

        .topbar { display: flex; align-items: center; justify-content: space-between; gap: 20px;
          padding: 16px 28px 14px; flex-shrink: 0; }
        .topbar-title h1 { margin: 0; font-size: 21px; font-weight: 700; letter-spacing: -0.02em; }
        .topbar-sub { display: flex; align-items: center; gap: 9px; margin-top: 6px; font-size: 12px; color: var(--text-dim); }
        .dot-sep { width: 3px; height: 3px; border-radius: 99px; background: var(--text-faint); }
        .topbar-right { display: flex; gap: 8px; align-items: center; }
        .head-metric { display: flex; flex-direction: column; gap: 3px; padding: 7px 14px; min-width: 84px;
          background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--r-md); }
        .head-metric .num { font-size: 15px; font-weight: 700; }
        .print-btn { padding: 7px 14px; font-size: 12px; font-weight: 500; color: var(--text-dim);
          background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--r-md);
          cursor: pointer; white-space: nowrap; transition: color .15s, border-color .15s; }
        .print-btn:hover { color: var(--text); border-color: var(--border); }
        body.export-mode .print-btn { display: none; }
        @media print {
          .sidebar { display: none !important; }
          .topbar { display: none !important; }
          .tabnav { display: none !important; }
          .app { display: block; height: auto; overflow: visible; }
          .main { overflow: visible; }
          .content { overflow: visible; padding: 12px; }
        }

        .tabnav { display: flex; gap: 2px; padding: 0 22px; border-bottom: 1px solid var(--border); flex-shrink: 0; overflow-x: auto; }
        .tab-btn { padding: 11px 14px; font-size: 13px; font-weight: 500; color: var(--text-faint);
          border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; transition: color .15s; }
        .tab-btn:hover { color: var(--text-dim); }
        .tab-btn.on { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }

        .content { flex: 1; overflow-y: auto; padding: 22px 28px 40px; }
        .tab-body { display: flex; flex-direction: column; gap: 18px; max-width: 1280px; }

        .kpi-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
          background: var(--border-soft); border: 1px solid var(--border-soft); border-radius: var(--r-lg); overflow: hidden; }
        .kpi-strip > .metric { background: var(--panel); padding: 16px 18px; }

        .grid-2-1 { display: grid; grid-template-columns: 1.85fr 1fr; gap: 18px; align-items: start; }
        .grid-1-2 { display: grid; grid-template-columns: 1fr 1.4fr; gap: 18px; align-items: start; }
        .grid-2-eq { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }

        .empty-state { text-align: center; padding: 80px 20px; }

        .rate-limit-banner { padding: 5px 28px; flex-shrink: 0;
          background: color-mix(in oklch, var(--warn), transparent 88%);
          border-bottom: 1px solid color-mix(in oklch, var(--warn), transparent 72%);
          color: var(--warn); font-size: 11.5px; }

        /* glossary */
        .glossary { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border-soft);
          border: 1px solid var(--border-soft); border-radius: var(--r-md); overflow: hidden; }
        .gloss-item { background: var(--panel); padding: 12px 14px; }
        .gloss-term { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
        .gloss-def { font-size: 11.5px; color: var(--text-faint); line-height: 1.5; }

        /* optimization cards */
        .opt-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .opt-card { text-align: left; padding: 16px 18px; border-radius: var(--r-lg); background: var(--panel);
          border: 1px solid var(--border-soft); transition: all .16s; }
        .opt-card.base { background: var(--panel-2); }
        .opt-card:not(.base) { cursor: pointer; }
        .opt-card:not(.base):hover { border-color: var(--border); }
        .opt-card.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

        /* company */
        .ticker-tabs { display: flex; gap: 6px; }
        .ticker-tab { padding: 7px 14px; border-radius: var(--r-md); font-size: 13px; color: var(--text-dim);
          background: var(--panel); border: 1px solid var(--border-soft); }
        .ticker-tab .num { font-weight: 600; }
        .ticker-tab.on { background: var(--accent-soft); color: var(--accent); border-color: color-mix(in oklch, var(--accent), transparent 55%); }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border-soft);
          border: 1px solid var(--border-soft); border-radius: var(--r-md); overflow: hidden; }
        .prof-row { display: flex; justify-content: space-between; gap: 10px; padding: 9px 13px; background: var(--panel); font-size: 12px; }
        .prof-row > span:first-child { color: var(--text-faint); }
        .news-list { display: flex; flex-direction: column; }
        .news-item { display: flex; gap: 12px; padding: 13px 16px; border-bottom: 1px solid var(--border-soft); }
        .news-item:last-child { border-bottom: none; }
        .news-item:hover { background: var(--panel-hi); }
        .news-thumb { width: 38px; height: 38px; flex-shrink: 0; border-radius: 8px; background: var(--panel-hi);
          display: grid; place-items: center; color: var(--text-faint); font-size: 12px; font-weight: 600; }
        .news-head { font-size: 12.5px; color: var(--text); font-weight: 500; line-height: 1.4; text-wrap: pretty; }
        .news-meta { font-size: 11px; color: var(--text-faint); margin-top: 4px; }

        /* data sources */
        .src-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

        @media (max-width: 1180px) {
          .grid-2-1, .grid-1-2, .grid-2-eq, .opt-cards { grid-template-columns: 1fr; }
          .kpi-strip { grid-template-columns: repeat(3, 1fr); }
          .src-grid { grid-template-columns: repeat(2, 1fr); }
          .topbar-right .head-metric:last-child { display: none; }
        }
      `}</style>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

// ---- PPTX export helpers (used by gen_pptx showJs) ----
window.__exportTab = function (i) {
  document.body.classList.add("export-mode");
  const btns = document.querySelectorAll(".tab-btn");
  if (btns[i]) btns[i].click();
  window.scrollTo(0, 0);
};
window.__exportDone = function () { document.body.classList.remove("export-mode"); };
