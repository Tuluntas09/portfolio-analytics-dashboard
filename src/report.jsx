/* ============================================================
   src/report.jsx — print/report-only document for QPA.

   Renders a clean, structured "Portfolio Analytics Report" that is
   hidden on screen (display:none) and revealed only under @media print
   by app.jsx print CSS. It REUSES already-computed portfolio stats
   (the same `pAdj` object the dashboard renders) and the pure
   computeExposure() helper. It performs NO financial, risk, provider,
   or storage logic of its own — it only formats values for paper.

   DESCRIPTIVE ONLY. No advice, recommendations, signals, or targets.

   JSX pragma: classic mode with explicit npm React import (mirrors
   src/views/overview.jsx). Verified by scripts/report-print-check.mjs.
   ============================================================ */
/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

import React from "react";
import { fmtUSD, fmtUSDc, fmtUSDSigned, fmtPct, fmtPctSigned, fmtNum, t } from "./ui.js";
import { computeExposure } from "./exposure.js";

// Local granular labels for report rows/columns. Section titles, the
// non-advisory line, and the methodology body come from the shared i18n
// table (ui.js) so the dashboard header and this report stay in sync.
const REPORT_COPY = {
  en: {
    holdings: "holdings",
    portfolioValue: "Portfolio value",
    costBasis: "Cost basis",
    unrealizedPnl: "Unrealized P&L",
    unrealizedReturn: "Unrealized return",
    annReturn: "Annualized return",
    annVol: "Annualized volatility",
    sharpe: "Sharpe ratio",
    sortino: "Sortino ratio",
    beta: "Beta",
    var95: "VaR 95% (1M)",
    maxDd: "Max drawdown",
    riskFree: "Risk-free rate",
    metric: "Metric",
    value: "Value",
    sectorExposure: "Sector exposure",
    assetClassExposure: "Asset class exposure",
    allocationByHolding: "Allocation by holding",
    catUnknown: "Unknown",
    catExtended: "Extended",
    ticker: "Ticker",
    name: "Name",
    lots: "Lots",
    lastPrice: "Last price",
    positionValue: "Position value",
    weight: "Weight",
  },
  tr: {
    holdings: "varlık",
    portfolioValue: "Portföy değeri",
    costBasis: "Maliyet",
    unrealizedPnl: "Gerçekleşmemiş K/Z",
    unrealizedReturn: "Gerçekleşmemiş getiri",
    annReturn: "Yıllık getiri",
    annVol: "Yıllık oynaklık",
    sharpe: "Sharpe oranı",
    sortino: "Sortino oranı",
    beta: "Beta",
    var95: "VaR %95 (1A)",
    maxDd: "Maks. düşüş",
    riskFree: "Risksiz faiz",
    metric: "Metrik",
    value: "Değer",
    sectorExposure: "Sektör dağılımı",
    assetClassExposure: "Varlık sınıfı dağılımı",
    allocationByHolding: "Varlık bazında dağılım",
    catUnknown: "Bilinmiyor",
    catExtended: "Genişletilmiş",
    ticker: "Sembol",
    name: "Ad",
    lots: "Lot",
    lastPrice: "Son fiyat",
    positionValue: "Pozisyon değeri",
    weight: "Ağırlık",
  },
};

function Section({ index, title, children }) {
  return (
    <section className="rd-section">
      <h2 className="rd-h2"><span className="rd-h2-num">{index}.</span> {title}</h2>
      {children}
    </section>
  );
}

// Descriptive exposure bars — grayscale fill, no green/red, no overflow.
function ExposureBlock({ rows, heading, copy }) {
  if (!rows || rows.length === 0) return null;
  const catLabel = key => key === "Unknown" ? copy.catUnknown : key === "Extended" ? copy.catExtended : key;
  return (
    <div className="rd-expo">
      <div className="rd-expo-head">{heading}</div>
      {rows.map(r => (
        <div className="rd-expo-row" key={r.key}>
          <span className="rd-expo-label">{catLabel(r.key)} · {r.count} {copy.holdings}</span>
          <span className="rd-expo-bar"><span className="rd-expo-fill" style={{ width: Math.max(0, Math.min(100, r.weight * 100)) + "%" }} /></span>
          <span className="rd-expo-pct num">{fmtPct(r.weight)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * ReportDocument — print-only structured portfolio report.
 *
 * Props:
 *   p              — the adjusted portfolio stats object (same as dashboard)
 *   language       — "en" | "tr"
 *   benchmark      — selected benchmark symbol
 *   period         — formatted analysis-period string
 *   generated      — formatted generation date/time string
 *   portfolioName  — optional portfolio label
 *   note           — optional portfolio note text
 *   dataSourceLabel— short factual source label (already localized)
 *   proxyConnected — boolean; show "proxy connected" line only when true
 */
export function ReportDocument({
  p,
  language = "en",
  benchmark = "",
  period = "",
  generated = "",
  portfolioName = "",
  note = "",
  dataSourceLabel = "",
  proxyConnected = false,
}) {
  const copy = REPORT_COPY[language] || REPORT_COPY.en;
  const assets = (p && Array.isArray(p.assets)) ? p.assets : [];
  const empty = assets.length === 0;
  const label = portfolioName || t(language, "reportPortfolioDefault");
  const hasPnl = p && p.totalUnrealizedPnl != null;
  const exposure = computeExposure(assets);

  const metricRows = p ? [
    { k: copy.annReturn, v: fmtPctSigned(p.annRet) },
    { k: copy.annVol, v: fmtPct(p.annVol) },
    { k: copy.sharpe, v: fmtNum(p.sharpe) },
    { k: copy.sortino, v: fmtNum(p.sortino) },
    { k: copy.beta, v: fmtNum(p.beta) },
    { k: copy.var95, v: fmtPct(p.var95) },
    { k: copy.maxDd, v: fmtPct(p.mdd) },
    { k: copy.riskFree, v: fmtPct(p.rf) },
  ] : [];

  return (
    <div className="report-doc">
      {/* ── Branded report header ─────────────────────────────── */}
      <header className="rd-head">
        <div className="rd-brand">QPA</div>
        <div className="rd-brandsub">{t(language, "reportBrandSub")}</div>
        <h1 className="rd-title">{t(language, "printHeaderTitle")}</h1>
        <div className="rd-metaline">
          {label} · {benchmark} · {period} · {generated}
        </div>
        <div className="rd-nonadvisory">{t(language, "reportNonAdvisory")}</div>
      </header>

      {/* ── Report metadata block ─────────────────────────────── */}
      <dl className="rd-meta">
        <div className="rd-meta-item"><dt>{t(language, "reportPortfolio")}</dt><dd>{label}</dd></div>
        <div className="rd-meta-item"><dt>{t(language, "reportAnalysisPeriod")}</dt><dd>{period}</dd></div>
        <div className="rd-meta-item"><dt>{t(language, "printHeaderBenchmark")}</dt><dd>{benchmark}</dd></div>
        <div className="rd-meta-item"><dt>{t(language, "printHeaderGenerated")}</dt><dd>{generated}</dd></div>
        {dataSourceLabel && (
          <div className="rd-meta-item"><dt>{t(language, "printHeaderSource")}</dt><dd>{dataSourceLabel}</dd></div>
        )}
        {proxyConnected && (
          <div className="rd-meta-item rd-meta-wide"><dd>{t(language, "reportProxyConnected")}</dd></div>
        )}
      </dl>

      {empty ? (
        <div className="rd-empty">{t(language, "reportEmpty")}</div>
      ) : (
        <>
          {/* 1. Portfolio Summary */}
          <Section index={1} title={t(language, "reportSecSummary")}>
            <dl className="rd-summary">
              <div className="rd-sum-item"><dt>{copy.portfolioValue}</dt><dd className="num">{fmtUSD(p.totalValue)}</dd></div>
              <div className="rd-sum-item"><dt>{t(language, "reportPortfolio")}</dt><dd className="num">{assets.length} {copy.holdings}</dd></div>
              {hasPnl && <div className="rd-sum-item"><dt>{copy.costBasis}</dt><dd className="num">{fmtUSD(p.totalCostBasis)}</dd></div>}
              {hasPnl && <div className="rd-sum-item"><dt>{copy.unrealizedPnl}</dt><dd className="num">{fmtUSDSigned(p.totalUnrealizedPnl)}</dd></div>}
              {hasPnl && <div className="rd-sum-item"><dt>{copy.unrealizedReturn}</dt><dd className="num">{fmtPctSigned(p.totalUnrealizedPct)}</dd></div>}
            </dl>
          </Section>

          {/* 2. Performance & Risk Metrics */}
          <Section index={2} title={t(language, "reportSecMetrics")}>
            <table className="rd-table rd-metrics">
              <thead><tr><th>{copy.metric}</th><th className="rd-right">{copy.value}</th></tr></thead>
              <tbody>
                {metricRows.map(r => (
                  <tr key={r.k}><td>{r.k}</td><td className="rd-right num">{r.v}</td></tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* 3. Allocation & Exposure */}
          <Section index={3} title={t(language, "reportSecAllocation")}>
            <ExposureBlock rows={assets.map(a => ({ key: a.t, count: 1, weight: a.weight }))} heading={copy.allocationByHolding} copy={copy} />
            <ExposureBlock rows={exposure.sector} heading={copy.sectorExposure} copy={copy} />
            <ExposureBlock rows={exposure.assetClass} heading={copy.assetClassExposure} copy={copy} />
          </Section>

          {/* 4. Holdings Detail */}
          <Section index={4} title={t(language, "reportSecHoldings")}>
            <table className="rd-table rd-holdings">
              <thead>
                <tr>
                  <th>{copy.ticker}</th>
                  <th>{copy.name}</th>
                  <th className="rd-right">{copy.lots}</th>
                  <th className="rd-right">{copy.lastPrice}</th>
                  <th className="rd-right">{copy.positionValue}</th>
                  <th className="rd-right">{copy.weight}</th>
                  <th className="rd-right">{copy.annReturn}</th>
                  <th className="rd-right">{copy.annVol}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.t}>
                    <td className="num">{a.t}</td>
                    <td>{a.name}</td>
                    <td className="rd-right num">{a.lots}</td>
                    <td className="rd-right num">{fmtUSDc(a.px)}</td>
                    <td className="rd-right num">{fmtUSD(a.value)}</td>
                    <td className="rd-right num">{fmtPct(a.weight)}</td>
                    <td className="rd-right num">{fmtPctSigned(a.annRet)}</td>
                    <td className="rd-right num">{fmtPct(a.annVol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* 5. Notes — only when present */}
          {note && note.trim() && (
            <Section index={5} title={t(language, "reportSecNotes")}>
              <p className="rd-notes">{note}</p>
            </Section>
          )}
        </>
      )}

      {/* 6. Methodology & Disclaimer — always present */}
      <Section index={empty ? 1 : 6} title={t(language, "reportSecMethodology")}>
        <p className="rd-method">{t(language, "reportMethodologyBody")}</p>
        <p className="rd-disclaimer">{t(language, "printHeaderDisclaimer")}</p>
      </Section>
    </div>
  );
}
