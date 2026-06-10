/* ============================================================
   src/views/overview.jsx — Vite-native ES module.
   Contains: OverviewTab, RiskTab, dataProviderLabel, dataProviderTone.
   Migration phase: 6f.

   All component logic and markup is identical to
   public/legacy/views-overview.jsx. Dependencies on window.* globals
   are replaced with explicit ES module imports.

   JSX pragma: classic mode with explicit npm React import (Phase 6i prep).
   React is imported from the npm package rather than the CDN window global.
   The window.React UMD global is still present in the browser (loaded by
   index.html CDN scripts) but is no longer relied upon by this file.

   Node.js consumers: this file cannot be imported directly (JSX).
   Verify exports via scripts/overview-check.mjs.

   public/legacy/views-overview.jsx is the unchanged browser-Babel
   shim that assigns OverviewTab, RiskTab, dataProviderLabel, and
   dataProviderTone to window.* for legacy consumers.
   ============================================================ */
/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

import React from "react";
import { assetColor, fmtUSD, fmtUSDSigned, fmtPct, fmtPctSigned, fmtNum, fmtUSDc, t } from "../ui.js";
import { Metric, Card, Pill, Table, Alert, ModuleIntro, InsightGrid, InsightCard } from "../ui.jsx";
import { GrowthChart, Donut, Heatmap, HBars, MiniLine } from "../charts.jsx";
import { corr, GLOSSARY } from "../data.js";

const RISK_COPY = {
  en: {
    overviewMetricValue: "Portfolio value",
    overviewMetricReturn: "Ann. return",
    overviewMetricVol: "Ann. volatility",
    overviewMetricSharpe: "Sharpe ratio",
    overviewMetricDrawdown: "Max drawdown",
    holdings: "holdings",
    annualized: "annualized",
    totalRisk: "total risk",
    peakToTrough: "peak to trough",
    cumulativeReturn: "Cumulative return",
    cumulativeReturnSub: "Portfolio growth vs. selected benchmark. Normalized to 1.00 at period start.",
    portfolio: "Portfolio",
    portfolioAllocation: "Portfolio allocation",
    allocationSub: "Weights are calculated from lots x latest price.",
    holdingsDetail: "Holdings detail",
    holdingsDetailSub: "Position, performance and risk metrics at instrument level.",
    ticker: "Ticker",
    name: "Name",
    lots: "Lots",
    lastPrice: "Last price",
    positionValue: "Position value",
    weight: "Weight",
    averageCost: "Avg. Cost",
    unrealizedPnl: "Unrealized P&L",
    unrealizedReturn: "Unrealized Return",
    costBasis: "Cost Basis",
    readFirst: "Read first",
    overviewRead: "This view answers whether the portfolio has produced enough return for the risk taken, and which holdings drive the current allocation.",
    question: "Is the portfolio risk level acceptable?",
    answer: "Risk reads total volatility, downside loss potential and which holdings carry the risk.",
    elevatedRisk: "Elevated risk",
    controlledRisk: "Controlled risk",
    concentrated: "Concentrated",
    diversified: "Diversified",
    riskRead: "Risk read",
    downsideRead: "Downside read",
    concentrationRead: "Concentration read",
    riskHigh: "This level points to a more volatile portfolio profile.",
    riskOk: "This level looks controlled for the current allocation.",
    downside: "Max drawdown shows the sharpest historical peak-to-trough loss. Read it with VaR to understand downside tolerance.",
    concentration: "Top 3 weight shows how dependent the portfolio is on a few positions.",
    annualizedVol: "Annualized volatility",
    vsBenchmark: "vs benchmark",
    downsideRisk: "downside risk",
    normalApprox: "normal approx.",
    topHolding: "Top holding",
    effectivePositions: "Effective positions",
    correlationMatrix: "Correlation matrix",
    correlationSub: "Higher positive values mean instruments tend to move together. Lower values improve diversification.",
    riskContribution: "Risk contribution",
    riskContributionSub: "Each holding's share of total portfolio risk, accounting for weight, volatility and correlation.",
    rollingVolatility: "Rolling volatility",
    rollingVolSub: "Annualized rolling volatility. Rising values indicate a more unstable return profile.",
    concentrationSummary: "Concentration summary",
    concentrationSummarySub: "A quick read on diversification pressure.",
    metric: "Metric",
    value: "Value",
    interpretation: "Interpretation",
    top3Weight: "Top 3 weight",
    portfolioVolatility: "Portfolio volatility",
    highDependency: "High dependency",
    controlled: "Controlled",
    largestCombined: "Largest positions combined",
    elevated: "Elevated",
    moderate: "Moderate",
    metricGlossary: "Metric glossary",
    glossarySub: "Compact reading guide for portfolio risk metrics.",
    meaning: "Meaning",
    sourceCol: "Source",
  },
  tr: {
    overviewMetricValue: "Portföy değeri",
    overviewMetricReturn: "Yıllık getiri",
    overviewMetricVol: "Yıllık oynaklık",
    overviewMetricSharpe: "Sharpe oranı",
    overviewMetricDrawdown: "Maks. düşüş",
    holdings: "varlık",
    annualized: "yıllıklandırılmış",
    totalRisk: "toplam risk",
    peakToTrough: "zirveden dibe",
    cumulativeReturn: "Kümülatif getiri",
    cumulativeReturnSub: "Portföy büyümesini seçili referansla karşılaştırma. Değerler dönem başında 1,00 olarak normalize edilir.",
    portfolio: "Portföy",
    portfolioAllocation: "Portföy dağılımı",
    allocationSub: "Ağırlıklar lot x son fiyat üzerinden hesaplanır.",
    holdingsDetail: "Varlık detayı",
    holdingsDetailSub: "Pozisyon, performans ve risk metrikleri varlık bazında gösterilir.",
    ticker: "Sembol",
    name: "Ad",
    lots: "Lot",
    lastPrice: "Son fiyat",
    positionValue: "Pozisyon değeri",
    weight: "Ağırlık",
    averageCost: "Ort. Maliyet",
    unrealizedPnl: "Gerçekleşmemiş K/Z",
    unrealizedReturn: "Gerçekleşmemiş Getiri",
    costBasis: "Maliyet",
    readFirst: "İlk bakış",
    overviewRead: "Bu ekran portföyün alınan riske karşı yeterli getiri üretip üretmediğini ve mevcut dağılımı hangi varlıkların taşıdığını gösterir.",
    question: "Portföyün risk seviyesi kabul edilebilir mi?",
    answer: "Risk modülü toplam oynaklığı, aşağı yönlü kayıp ihtimalini ve riskin hangi varlıklardan geldiğini birlikte okur.",
    elevatedRisk: "Yüksek risk",
    controlledRisk: "Kontrollü risk",
    concentrated: "Yoğunlaşmış",
    diversified: "Dağıtılmış",
    riskRead: "Risk okuması",
    downsideRead: "Aşağı yön okuması",
    concentrationRead: "Yoğunlaşma okuması",
    riskHigh: "Bu seviye daha oynak bir portföy davranışına işaret ediyor.",
    riskOk: "Bu seviye mevcut dağılım için kontrollü görünüyor.",
    downside: "Max drawdown geçmişte görülen en sert zirve-dip kaybı gösterir. VaR ile birlikte aşağı yönlü toleransı okumak için kullan.",
    concentration: "Top 3 ağırlık portföyün kaç pozisyona bağımlı olduğunu gösterir.",
    annualizedVol: "Yıllık oynaklık",
    vsBenchmark: "benchmark'a göre",
    downsideRisk: "aşağı yönlü risk",
    normalApprox: "normal yaklaşım",
    topHolding: "En büyük pozisyon",
    effectivePositions: "Etkin pozisyon",
    correlationMatrix: "Korelasyon matrisi",
    correlationSub: "Pozitif değer yükseldikçe varlıklar birlikte hareket etme eğilimindedir. Düşük değer çeşitlendirmeyi güçlendirir.",
    riskContribution: "Risk katkısı",
    riskContributionSub: "Her varlığın ağırlık, oynaklık ve korelasyon dikkate alınarak toplam portföy riskindeki payı.",
    rollingVolatility: "Rolling oynaklık",
    rollingVolSub: "Yıllıklandırılmış rolling oynaklık. Yükselen değerler daha istikrarsız getiri profiline işaret eder.",
    concentrationSummary: "Yoğunlaşma özeti",
    concentrationSummarySub: "Çeşitlendirme baskısını hızlı okumak için özet.",
    metric: "Metrik",
    value: "Değer",
    interpretation: "Yorum",
    top3Weight: "İlk 3 ağırlık",
    portfolioVolatility: "Portföy oynaklığı",
    highDependency: "Yüksek bağımlılık",
    controlled: "Kontrollü",
    largestCombined: "En büyük pozisyonların toplamı",
    elevated: "Yüksek",
    moderate: "Orta",
    metricGlossary: "Metrik sözlüğü",
    glossarySub: "Portföy risk metrikleri için kompakt okuma rehberi.",
    meaning: "Anlam",
    sourceCol: "Kaynak",
  },
};

export function dataProviderLabel(provider, language) {
  const p = (provider || "").toLowerCase();
  if (p === "finnhub quote" || p === "finnhub") return "Finnhub";
  if (p === "yahoo") return "Yahoo Fallback";
  if (p === "real") return language === "tr" ? "Canlı Veri" : "Real Data";
  if (p === "mock") return language === "tr" ? "Model Veri" : "Deterministic Mock";
  return language === "tr" ? "Bilinmiyor" : "Unknown";
}

export function dataProviderTone(provider) {
  const p = (provider || "").toLowerCase();
  if (p === "finnhub quote" || p === "finnhub" || p === "real") return "pos";
  if (p === "yahoo") return "warn";
  return "neutral";
}

export function OverviewTab({ p, language = "tr", snapshots = [], snapshotDeltas = null }) {
  const copy = RISK_COPY[language] || RISK_COPY.tr;
  const allocation = p.assets.map((a, i) => ({
    label: a.t,
    value: a.weight,
    color: assetColor(i),
  }));

  const assetRows = p.assets.map((a, i) => ({
    ...a,
    color: assetColor(i),
  }));

  return (
    <div className="tab-body fade-up">
      <div className="kpi-strip">
        <Metric label={copy.overviewMetricValue} value={fmtUSD(p.totalValue)} accent="var(--accent)" sub={`${p.assets.length} ${copy.holdings}`} />
        <Metric label={copy.overviewMetricReturn} value={fmtPctSigned(p.annRet)} accent={p.annRet >= 0 ? "var(--pos)" : "var(--neg)"} sub={copy.annualized} glossary={language === "tr" ? "Seçili canlı veri aralığındaki yıllıklandırılmış tarihsel getiri." : "Annualized historical return over the selected live data range."} />
        <Metric label={copy.overviewMetricVol} value={fmtPct(p.annVol)} sub={copy.totalRisk} glossary={language === "tr" ? "Günlük getirilerin standart sapmasının yıllık ölçeğe taşınmış hali." : "Standard deviation of daily returns scaled to one year."} />
        <Metric label={copy.overviewMetricSharpe} value={fmtNum(p.sharpe)} accent="var(--accent-2)" sub={`rf ${fmtPct(p.rf)}`} glossary={language === "tr" ? "Risksiz faiz üzerindeki getirinin oynaklığa oranı." : "Excess return over the risk-free rate per unit of volatility."} />
        <Metric label={copy.overviewMetricDrawdown} value={fmtPct(p.mdd)} accent="var(--neg)" sub={copy.peakToTrough} glossary={language === "tr" ? "Portföyün önceki zirvesinden gördüğü en büyük düşüş." : "Largest portfolio decline from a previous high."} />
      </div>

      {p.totalUnrealizedPnl != null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--border-soft)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <div style={{ background: "var(--panel)", padding: "16px 18px" }}>
            <Metric label={copy.costBasis} value={fmtUSD(p.totalCostBasis)} sub={language === "tr" ? "maliyet bazı" : "cost basis"} />
          </div>
          <div style={{ background: "var(--panel)", padding: "16px 18px" }}>
            <Metric label={copy.unrealizedPnl} value={fmtUSDSigned(p.totalUnrealizedPnl)} accent={p.totalUnrealizedPnl >= 0 ? "var(--pos)" : "var(--neg)"} />
          </div>
          <div style={{ background: "var(--panel)", padding: "16px 18px" }}>
            <Metric label={copy.unrealizedReturn} value={fmtPctSigned(p.totalUnrealizedPct)} accent={p.totalUnrealizedPct >= 0 ? "var(--pos)" : "var(--neg)"} />
          </div>
        </div>
      )}

      {snapshots.length >= 2 && (
        <Card title={t(language, "snapshotHistory")} subtitle={t(language, "snapshotHistoryHelp")}>
          {snapshotDeltas && (snapshotDeltas.wow || snapshotDeltas.mom || snapshotDeltas.ytd || snapshotDeltas.inception) && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { key: "wow", label: t(language, "snapshotWow") },
                { key: "mom", label: t(language, "snapshotMom") },
                { key: "ytd", label: t(language, "snapshotYtd") },
                { key: "inception", label: t(language, "snapshotInception") },
              ].map(({ key, label }) => {
                const d = snapshotDeltas[key];
                if (!d) return null;
                return (
                  <div key={key} style={{ background: "var(--panel-hi)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", padding: "10px 16px", minWidth: 110 }}>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 500, marginBottom: 4 }}>{label}</div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 700, color: d.pct >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtPctSigned(d.pct)}</div>
                    <div className="num" style={{ fontSize: 11, color: "var(--text-dim)" }}>{fmtUSDSigned(d.value)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <MiniLine
            data={snapshots.map(s => s.totalValue)}
            height={120}
            color="var(--accent)"
            fmt={v => "$" + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(0))}
          />
        </Card>
      )}

      <div className="grid-2-1">
        <Card title={copy.cumulativeReturn} subtitle={copy.cumulativeReturnSub}>
          <GrowthChart
            series={[
              { name: copy.portfolio, data: p.cum, color: "var(--accent)", fill: true },
              { name: p.benchmark || "VTI", data: p.benchCum, color: "var(--text-faint)", dash: "4 4" },
            ]}
            height={292}
          />
        </Card>

        <Card title={copy.portfolioAllocation} subtitle={copy.allocationSub}>
          <div style={{ display: "grid", gridTemplateColumns: "176px 1fr", alignItems: "center", gap: 14 }}>
            <Donut data={allocation} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allocation.map((a) => (
                <div key={a.label} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: a.color }} />
                  <span className="num" style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>{a.label}</span>
                  <span className="num" style={{ fontSize: 12, color: "var(--text)" }}>{fmtPct(a.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title={copy.holdingsDetail} subtitle={copy.holdingsDetailSub} pad={false}>
        <Table columns={[
          { key: "t", label: copy.ticker, render: r => (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
              <span className="num" style={{ color: "var(--text)", fontWeight: 700 }}>{r.t}</span>
            </span>
          ) },
          { key: "name", label: copy.name },
          { key: "lots", label: copy.lots, align: "right", mono: true },
          { key: "px", label: copy.lastPrice, align: "right", mono: true, render: r => fmtUSDc(r.px) },
          { key: "value", label: copy.positionValue, align: "right", mono: true, render: r => fmtUSD(r.value) },
          { key: "weight", label: copy.weight, align: "right", mono: true, render: r => fmtPct(r.weight) },
          { key: "annRet", label: copy.overviewMetricReturn, align: "right", mono: true, color: r => r.annRet >= 0 ? "var(--pos)" : "var(--neg)", render: r => fmtPctSigned(r.annRet) },
          { key: "annVol", label: copy.overviewMetricVol, align: "right", mono: true, render: r => fmtPct(r.annVol) },
          { key: "avgCost", label: copy.averageCost, align: "right", mono: true, render: r => r.avgCost != null ? fmtUSDc(r.avgCost) : React.createElement("span", { style: { color: "var(--text-faint)" } }, "—") },
          { key: "unrealizedPnl", label: copy.unrealizedPnl, align: "right", mono: true, color: r => r.unrealizedPnl == null ? undefined : r.unrealizedPnl >= 0 ? "var(--pos)" : "var(--neg)", render: r => r.unrealizedPnl != null ? fmtUSDSigned(r.unrealizedPnl) : React.createElement("span", { style: { color: "var(--text-faint)" } }, "—") },
          { key: "unrealizedPct", label: copy.unrealizedReturn, align: "right", mono: true, color: r => r.unrealizedPct == null ? undefined : r.unrealizedPct >= 0 ? "var(--pos)" : "var(--neg)", render: r => r.unrealizedPct != null ? fmtPctSigned(r.unrealizedPct) : React.createElement("span", { style: { color: "var(--text-faint)" } }, "—") },
          { key: "dataProvider", label: copy.sourceCol, render: r => (
            <Pill tone={dataProviderTone(r.dataProvider)} size="sm">{dataProviderLabel(r.dataProvider, language)}</Pill>
          ) },
        ]} rows={assetRows} />
      </Card>

      <Alert tone="accent" title={copy.readFirst}>
        {copy.overviewRead}
      </Alert>
    </div>
  );
}

export function RiskTab({ p, language = "tr" }) {
  const copy = RISK_COPY[language] || RISK_COPY.tr;
  const riskRows = p.assets
    .map((a, i) => ({ label: a.t, value: a.riskContrib, color: assetColor(i) }))
    .sort((a, b) => b.value - a.value);
  const topWeight = Math.max(...p.assets.map(a => a.weight));
  const top3Weight = p.assets.slice().sort((a, b) => b.weight - a.weight).slice(0, 3).reduce((s, a) => s + a.weight, 0);
  const effectivePositions = 1 / Math.max(p.hhi, 1e-6);
  const glossaryRows = GLOSSARY.map(g => ({ term: g.term, def: g.def }));

  return (
    <div className="tab-body fade-up">
      <ModuleIntro
        question={copy.question}
        answer={copy.answer}
      >
        <Pill tone={p.annVol > 0.22 ? "warn" : "pos"}>{p.annVol > 0.22 ? copy.elevatedRisk : copy.controlledRisk}</Pill>
        <Pill tone={effectivePositions < 4 ? "warn" : "pos"}>{effectivePositions < 4 ? copy.concentrated : copy.diversified}</Pill>
      </ModuleIntro>

      <InsightGrid>
        <InsightCard label={copy.riskRead} value={fmtPct(p.annVol)} tone={p.annVol > 0.22 ? "warn" : "pos"}>
          {copy.annualizedVol} {language === "tr" ? "toplam riskin ana göstergesi." : "is the main indicator of total risk."} {p.annVol > 0.22 ? copy.riskHigh : copy.riskOk}
        </InsightCard>
        <InsightCard label={copy.downsideRead} value={fmtPct(p.mdd)} tone="neg">
          {copy.downside}
        </InsightCard>
        <InsightCard label={copy.concentrationRead} value={fmtPct(top3Weight)} tone={top3Weight > 0.65 ? "warn" : "accent"}>
          {copy.concentration} {copy.effectivePositions}: <span className="num">{fmtNum(effectivePositions, 1)}</span>.
        </InsightCard>
      </InsightGrid>

      <div className="kpi-strip">
        <Metric label="Beta" value={fmtNum(p.beta)} sub={copy.vsBenchmark} glossary={language === "tr" ? "Veri tabanlı beta: cov(portföy getirileri, VTI benchmark) / var(VTI benchmark). Yetersiz veri durumunda 1,0 olarak hesaplanır." : "Data-derived beta: cov(portfolio returns, VTI benchmark returns) / var(VTI benchmark returns). Falls back to 1.0 if benchmark data is insufficient."} />
        <Metric label="Sortino" value={fmtNum(p.sortino)} accent="var(--accent-2)" sub={copy.downsideRisk} glossary={language === "tr" ? "Aşağı yönlü oynaklığı kullanan risk başına getiri metriği." : "Risk-adjusted return using downside volatility."} />
        <Metric label="VaR 95% (1M)" value={fmtPct(p.var95)} accent="var(--neg)" sub={copy.normalApprox} glossary={language === "tr" ? "Yüzde 95 güven düzeyinde bir aylık kayıp eşiği." : "One-month loss threshold under a 95% confidence normal approximation."} />
        <Metric label={copy.topHolding} value={fmtPct(topWeight)} sub={language === "tr" ? "tek varlık ağırlığı" : "single-name weight"} glossary={language === "tr" ? "En büyük tekil pozisyon ağırlığı." : "Largest individual position weight."} />
        <Metric label={copy.effectivePositions} value={fmtNum(effectivePositions, 1)} sub={`HHI ${fmtNum(p.hhi, 2)}`} glossary={language === "tr" ? "Herfindahl yoğunlaşma endeksinden türetilen çeşitlendirme göstergesi." : "Diversification implied by the Herfindahl concentration index."} />
      </div>

      <div className="grid-2-eq">
        <Card title={copy.correlationMatrix} subtitle={copy.correlationSub}>
          <Heatmap tickers={p.assets.map(a => a.t)} corrFn={corr} />
        </Card>

        <Card title={copy.riskContribution} subtitle={copy.riskContributionSub}>
          <HBars data={riskRows} valueFmt={v => fmtPct(v)} />
        </Card>
      </div>

      <div className="grid-2-1">
        <Card title={copy.rollingVolatility} subtitle={copy.rollingVolSub}>
          <MiniLine data={p.rollVol} color="var(--neg)" fmt={v => fmtPct(v)} />
        </Card>

        <Card title={copy.concentrationSummary} subtitle={copy.concentrationSummarySub}>
          <Table dense zebra={false} columns={[
            { key: "metric", label: copy.metric },
            { key: "value", label: copy.value, align: "right", mono: true },
            { key: "read", label: copy.interpretation },
          ]} rows={[
            { metric: copy.topHolding, value: fmtPct(topWeight), read: topWeight > 0.35 ? copy.highDependency : copy.controlled },
            { metric: copy.top3Weight, value: fmtPct(top3Weight), read: copy.largestCombined },
            { metric: copy.effectivePositions, value: fmtNum(effectivePositions, 1), read: effectivePositions < 4 ? copy.concentrated : copy.diversified },
            { metric: copy.portfolioVolatility, value: fmtPct(p.annVol), read: p.annVol > 0.22 ? copy.elevated : copy.moderate },
          ]} />
        </Card>
      </div>

      <Card title={copy.metricGlossary} subtitle={copy.glossarySub} pad={false}>
        <Table dense columns={[
          { key: "term", label: copy.metric, render: r => <strong style={{ color: "var(--text)" }}>{r.term}</strong> },
          { key: "def", label: copy.meaning, render: r => <span style={{ color: "var(--text-faint)" }}>{r.def}</span> },
        ]} rows={glossaryRows} />
      </Card>
    </div>
  );
}
