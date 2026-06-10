/* ============================================================
   src/views/analysis.jsx — Vite-native ES module.
   Contains: AnalysisTab, OptimizationTab, SimulationTab, CompanyTab, DataTab.
   Migration phase: 6g.

   All component logic and markup is identical to
   public/legacy/views-analysis.jsx. Dependencies on window.* globals
   are replaced with explicit ES module imports.

   The only functional code change from the legacy file:
   - The legacy DATA_SOURCES global (accessed via window in the shim) inside
     CompanyTab's news fetch effect is replaced with the imported constant.
   All other code is identical.

   JSX pragma: classic mode with explicit npm React import (Phase 6i prep).
   React is imported from the npm package rather than the CDN window global.
   The window.React UMD global is still present in the browser (loaded by
   index.html CDN scripts) but is no longer relied upon by this file.

   Node.js consumers: this file cannot be imported directly (JSX).
   Verify exports via scripts/analysis-check.mjs.

   public/legacy/views-analysis.jsx is the unchanged browser-Babel
   shim that assigns all 5 tab components to window.*.
   ============================================================ */
/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

import React from "react";
import { assetColor, fmtUSD, fmtPct, fmtPctSigned, fmtNum, fmtUSDc } from "../ui.js";
import { ModuleIntro, Pill, InsightGrid, InsightCard, Card, Table, Alert, Metric, Segmented } from "../ui.jsx";
import { VBars, MiniLine, FanChart, Histogram } from "../charts.jsx";
import { STRESS, monteCarlo, COMPANY, lookup, DATA_SOURCES } from "../data.js";
import { dataProviderLabel, dataProviderTone } from "./overview.jsx";

const { useMemo: useMemoVA, useState: useStateVA, useEffect: useEffectVA, useRef: useRefVA, useLayoutEffect: useLayoutEffectVA } = React;

const MODULE_COPY = {
  en: {
    analysisQ: "What explains the portfolio's historical performance?",
    analysisA: "Performance Analysis reads rolling performance, rebalancing impact and stress scenarios in one decision flow.",
    rollingMetrics: "Rolling metrics",
    stressView: "Stress view",
    rollingReturnTitle: "Rolling 63-day return",
    rollingReturnSub: "Annualized trailing quarter return. Bars below zero mark losing quarters.",
    rollingSharpeTitle: "Rolling 63-day Sharpe",
    rollingSharpeSub: "Risk-adjusted performance through time; dashed line at 1.0.",
    rebalTitle: "Rebalancing comparison",
    rebalSub: "Hypothetical outcomes for the same holdings under different rebalancing rules.",
    strategy: "Strategy",
    recommended: "model-suggested",
    annReturn: "Ann. return",
    annVol: "Ann. vol",
    turnover: "Turnover",
    notes: "Notes",
    stressTests: "Stress tests",
    stressSub: "Estimated portfolio impact under historical and hypothetical shocks, applied to current asset-class exposure.",
    scenario: "Scenario",
    equityShock: "Equity shock",
    bondShock: "Bond shock",
    estPortfolio: "Est. portfolio",
    estPL: "Est. P/L",
    profileNote: "Profile note",
    profileNoteText: "Stress impacts scale with equity exposure",
    profileNoteTail: "profile changes how the optimizer reads the same realized history.",
    momentum: "Rolling 63-day return shows the recent performance rhythm. A negative value indicates short-term pressure.",
    rollingSharpe: "Rolling Sharpe shows whether recent risk-adjusted return is stable. Values above 1.0 are healthier.",
    worstStress: "The harshest scenario is",
    stressHelp: "This card summarizes portfolio fragility before reading the stress table.",
    optimizationQ: "Can the portfolio be improved toward a better risk/return balance?",
    optimizationA: "Portfolio Improvement compares the current portfolio with Max Sharpe and Minimum Risk alternatives; the decision should be read together with cost and turnover.",
    current: "Current",
    maxSharpe: "Max Sharpe",
    minRisk: "Min Risk",
    live: "live",
    selected: "selected",
    decisionReadLabel: "Decision read",
    returnRisk: "Return/risk",
    lowerRisk: "Lower risk",
    sharpeDeltaLabel: "Sharpe delta",
    tradingLoadLabel: "Trading load",
    estCost: "Est. cost",
    suggestedChanges: "Model output: allocation scenario",
    suggestedSubSharpe: "Model-implied weight shifts from current allocation to the max-Sharpe scenario.",
    suggestedSubRisk: "Model-implied weight shifts from current allocation to the minimum-risk scenario.",
    asset: "Asset",
    action: "Action",
    target: "Target",
    change: "Change",
    hold: "Hold",
    increase: "Increase",
    decrease: "Decrease",
    turnoverCost: "Turnover & cost impact",
    turnoverCostSub: "Trading required to reach the target.",
    tradeOff: "Trade-off",
    tradeOffText: "requires",
    tradeOffTail: "turnover. Weigh the modeled Sharpe gain against realized trading costs and tax impact.",
    decisionRead: "The selected target works to improve",
    decisionSharpe: "risk-adjusted return",
    decisionRisk: "volatility control",
    sharpeDelta: "Difference in risk-adjusted return between the current portfolio and target portfolio. A positive value means the model suggests improvement.",
    tradingLoad: "One-way turnover shows how much of the portfolio would need to trade to reach the target.",
    simulationQ: "What future value range can this portfolio move toward?",
    simulationA: "Simulation does not produce a single forecast; it shows a distribution of possible outcomes using current return and volatility assumptions.",
    baseCaseLabel: "Base case",
    downsideCaseLabel: "Downside case",
    upsideCaseLabel: "Upside case",
    lossProbability: "Loss probability",
    medianTerminal: "Median terminal",
    percentile95: "95th percentile",
    percentile5: "5th percentile",
    probLoss: "Prob. of loss",
    endingBelowStart: "ending below start",
    pathsSimulated: "Paths simulated",
    simPaths: "Simulated value paths",
    simPathsSub: "Monte Carlo paths over",
    simPathsTail: "years using the portfolio's estimated drift and volatility. 40 paths shown.",
    terminalDistribution: "Terminal value distribution",
    terminalDistributionSub: "Where the simulated paths end. Red bins finish below today's value.",
    outcomeScenarios: "Outcome scenarios",
    outcomeSub: "Percentile outcomes.",
    percentile: "Percentile",
    value: "Value",
    modelNote: "Model note",
    modelNoteText: "This is not a price forecast. Monte Carlo shows a distribution of possible outcomes under current drift/volatility assumptions; tail risk may look understated.",
    baseCase: "Median terminal value is the middle simulation outcome. It is not a single expected result, but the center of the distribution.",
    downsideCase: "5th percentile shows the downside scenario threshold.",
    upsideCase: "95th percentile shows the upper-end favorable scenario.",
    companyQ: "What does the fundamental profile of portfolio companies say?",
    companyA: "Company Data uses Finnhub profile and quote data to read portfolio equities through company fundamentals.",
    addEquityMessage: "Add an individual equity to view company fundamentals and news.",
    selectedCompanyLabel: "Selected company",
    quoteSourceLabel: "Quote source",
    liveQuote: "Live quote",
    fallback: "Fallback",
    profileSourceLabel: "Profile source",
    companyProfile: "Company profile",
    source: "Source",
    recentNews: "Recent company news",
    latestHeadlines: "Latest headlines for",
    newsLoading: "Loading headlines…",
    newsUnavailable: "News available when proxy is online.",
    newsEmpty: "No recent news available.",
    newsRateLimit: "Rate limit reached — some data may be delayed.",
    newsContextNote: "Company context only · not financial advice",
    marketCap: "Market cap",
    currency: "Currency",
    exchange: "Exchange",
    industry: "Industry",
    ipoDate: "IPO date",
    country: "Country",
    employees: "Employees",
    website: "Website",
    selectedCompany: "This tab reads portfolio equities one by one. Selected company:",
    quoteSource: "Last price is read from",
    profileSource: "If profile fields are missing, the dashboard continues with static fallback data.",
    dataQ: "Which data is powering the dashboard, and is it healthy?",
    dataA: "Data is not an investment analysis screen; it is an audit panel for proxy, price history, quote/profile and raw series checks.",
    proxyHealth: "Proxy health",
    priceHistory: "Price history",
    quoteProfile: "Quote/profile",
    dataAudit: "Data audit",
    configuredSource: "Configured market data source.",
    apiProxy: "API proxy",
    priceModel: "Price model",
    companyNews: "Company news",
    range: "Range",
    rows: "Rows",
    lastUpdate: "Last update",
    series: "Series",
    seriesSub: "Underlying daily data used across all tabs.",
    addInstrumentRows: "Add at least one instrument to inspect price and return rows.",
    realData: "Real data",
    mockFallback: "Mock fallback",
    auditDetail: "Audit detail: price and return rows",
    auditDetailSub: "This is not a data decision view; it shows which series feed the calculations.",
    prices: "Prices",
    dailyReturns: "Daily returns",
    date: "Date",
    points: "points",
    session: "Session",
    symbolSources: "Symbol data sources",
    symbolSourcesSub: "Data provider resolved for each holding this session.",
    symbolCol: "Symbol",
    nameCol: "Name",
    providerCol: "Provider",
  },
  tr: {
    analysisQ: "Portföyün geçmiş performansını ne açıklıyor?",
    analysisA: "Performans Analizi, rolling performansı, rebalancing etkisini ve stres senaryolarını aynı karar akışında okur.",
    rollingMetrics: "Rolling metrikler",
    stressView: "Stres görünümü",
    rollingReturnTitle: "Rolling 63 günlük getiri",
    rollingReturnSub: "Son çeyrek getirinin yıllıklandırılmış okuması. Sıfır altındaki barlar kayıplı dönemleri gösterir.",
    rollingSharpeTitle: "Rolling 63 günlük Sharpe",
    rollingSharpeSub: "Risk başına performansın zaman içindeki değişimi; kesikli çizgi 1.0 eşiğini gösterir.",
    rebalTitle: "Rebalancing karşılaştırması",
    rebalSub: "Aynı varlıklar için farklı rebalancing kurallarının varsayımsal sonuçları.",
    strategy: "Strateji",
    recommended: "model önerisi",
    annReturn: "Yıllık getiri",
    annVol: "Yıllık oynaklık",
    turnover: "Turnover",
    notes: "Not",
    stressTests: "Stres testleri",
    stressSub: "Tarihsel ve varsayımsal şokların mevcut varlık sınıfı dağılımına uygulanmış tahmini portföy etkisi.",
    scenario: "Senaryo",
    equityShock: "Hisse şoku",
    bondShock: "Tahvil şoku",
    estPortfolio: "Tahmini portföy",
    estPL: "Tahmini K/Z",
    profileNote: "Profil notu",
    profileNoteText: "Stres etkileri hisse ağırlığıyla ölçeklenir",
    profileNoteTail: "profili, optimizasyonun aynı gerçekleşmiş geçmişi nasıl okuyacağını değiştirir.",
    momentum: "Rolling 63-day return son çeyrek performans ritmini gösterir. Negatif değer kısa dönem baskının arttığını anlatır.",
    rollingSharpe: "Rolling Sharpe son dönemde risk başına getirinin istikrarlı olup olmadığını okutur. 1.0 üstü daha sağlıklı kabul edilir.",
    worstStress: "En sert senaryo",
    stressHelp: "Bu kart stress tablosuna bakmadan önce portföyün kırılganlığını özetler.",
    optimizationQ: "Portföy daha iyi risk/getiri dengesine doğru iyileştirilebilir mi?",
    optimizationA: "Portföy İyileştirme, mevcut portföyü Max Sharpe ve Minimum Risk alternatifleriyle karşılaştırır; karar maliyet ve turnover ile birlikte okunmalıdır.",
    current: "Mevcut",
    maxSharpe: "Max Sharpe",
    minRisk: "Min Risk",
    live: "canlı",
    selected: "seçili",
    decisionReadLabel: "Karar okuması",
    returnRisk: "Getiri/risk",
    lowerRisk: "Düşük risk",
    sharpeDeltaLabel: "Sharpe farkı",
    tradingLoadLabel: "İşlem yükü",
    estCost: "Tahmini maliyet",
    suggestedChanges: "Model çıktısı: dağılım senaryosu",
    suggestedSubSharpe: "Mevcut dağılımdan maksimum Sharpe senaryosuna model kayması.",
    suggestedSubRisk: "Mevcut dağılımdan minimum risk senaryosuna model kayması.",
    asset: "Varlık",
    action: "Aksiyon",
    target: "Hedef",
    change: "Değişim",
    hold: "Koru",
    increase: "Artır",
    decrease: "Azalt",
    turnoverCost: "Turnover ve maliyet etkisi",
    turnoverCostSub: "Hedefe ulaşmak için gereken işlem büyüklüğü.",
    tradeOff: "Ödünleşim",
    tradeOffText: "için",
    tradeOffTail: "turnover gerekir. Modellenen Sharpe kazanımını gerçekleşecek işlem maliyeti ve vergi etkisiyle birlikte tart.",
    decisionRead: "Seçili hedef",
    decisionSharpe: "risk başına getiriyi artırmaya",
    decisionRisk: "oynaklığı azaltmaya",
    sharpeDelta: "Current portfolio ile hedef portföy arasındaki risk-adjusted return farkı. Pozitif değer modelin iyileştirme önerdiğini gösterir.",
    tradingLoad: "One-way turnover hedefe ulaşmak için portföyün ne kadarının işlem görmesi gerektiğini gösterir.",
    simulationQ: "Bu portföy gelecekte hangi olası değer aralığına gidebilir?",
    simulationA: "Simulation modülü tek bir tahmin üretmez; mevcut getiri ve oynaklık varsayımlarıyla olası sonuç dağılımını gösterir.",
    baseCaseLabel: "Temel senaryo",
    downsideCaseLabel: "Aşağı yön senaryosu",
    upsideCaseLabel: "Yukarı yön senaryosu",
    lossProbability: "Kayıp olasılığı",
    medianTerminal: "Medyan dönem sonu",
    percentile95: "95. persentil",
    percentile5: "5. persentil",
    probLoss: "Kayıp olasılığı",
    endingBelowStart: "başlangıç altı bitiş",
    pathsSimulated: "Simüle edilen yol",
    simPaths: "Simüle değer yolları",
    simPathsSub: "Monte Carlo yolu,",
    simPathsTail: "yıllık vade için portföyün tahmini drift ve oynaklığıyla üretildi. 40 yol gösterilir.",
    terminalDistribution: "Dönem sonu değer dağılımı",
    terminalDistributionSub: "Simülasyon yollarının nerede bittiğini gösterir. Kırmızı barlar bugünkü değerin altında kalan sonuçlardır.",
    outcomeScenarios: "Sonuç senaryoları",
    outcomeSub: "Persentil bazlı sonuçlar.",
    percentile: "Persentil",
    value: "Değer",
    modelNote: "Model notu",
    modelNoteText: "Bu bir fiyat tahmini değildir. Monte Carlo mevcut drift/volatility varsayımlarıyla olası sonuç dağılımını gösterir; tail risk olduğundan düşük görünebilir.",
    baseCase: "Median terminal value simülasyon yollarının orta sonucudur. Bu değer beklenen tek sonuç değil, dağılımın merkezidir.",
    downsideCase: "5th percentile kötü senaryo eşiğini gösterir.",
    upsideCase: "95th percentile olumlu uç senaryoyu gösterir.",
    companyQ: "Portföydeki şirketlerin temel profili ne söylüyor?",
    companyA: "Company Data modülü Finnhub profile ve quote verisini kullanarak portföydeki hisse senetlerini temel şirket bilgileriyle okur.",
    addEquityMessage: "Şirket temelleri ve haberleri görmek için portföye tekil hisse ekle.",
    selectedCompanyLabel: "Seçili şirket",
    quoteSourceLabel: "Quote kaynağı",
    liveQuote: "Canlı quote",
    fallback: "Fallback",
    profileSourceLabel: "Profil kaynağı",
    companyProfile: "Şirket profili",
    source: "Kaynak",
    recentNews: "Son şirket haberleri",
    latestHeadlines: "Son başlıklar:",
    newsLoading: "Haberler yükleniyor…",
    newsUnavailable: "Haberler proxy çevrimiçiyken kullanılabilir.",
    newsEmpty: "Bu dönem için haber bulunamadı.",
    newsRateLimit: "Rate limit sınırına ulaşıldı — bazı veriler gecikebilir.",
    newsContextNote: "Yalnızca şirket bağlamı · yatırım tavsiyesi değildir",
    marketCap: "Piyasa değeri",
    currency: "Para birimi",
    exchange: "Borsa",
    industry: "Sektör",
    ipoDate: "IPO tarihi",
    country: "Ülke",
    employees: "Çalışan",
    website: "Web sitesi",
    selectedCompany: "Bu sekme portföydeki hisse senetlerini tek tek okutur. Seçili şirket:",
    quoteSource: "Last price alanı şuradan okunuyor:",
    profileSource: "Profile alanları eksik gelirse dashboard statik fallback ile kırılmadan devam eder.",
    dataQ: "Dashboard hangi veriyle çalışıyor ve veri sağlıklı mı?",
    dataA: "Data sekmesi analitik karar ekranı değil; proxy, fiyat geçmişi, quote/profile ve ham seri denetimi için audit panelidir.",
    proxyHealth: "Proxy sağlığı",
    priceHistory: "Fiyat geçmişi",
    quoteProfile: "Quote/profil",
    dataAudit: "Veri denetimi",
    configuredSource: "Yapılandırılmış piyasa veri kaynağı.",
    apiProxy: "API proxy",
    priceModel: "Fiyat modeli",
    companyNews: "Şirket haberleri",
    range: "Aralık",
    rows: "Satır",
    lastUpdate: "Son güncelleme",
    series: "Seriler",
    seriesSub: "Tüm sekmelerde kullanılan günlük temel veri.",
    addInstrumentRows: "Fiyat ve getiri satırlarını incelemek için en az bir varlık ekle.",
    realData: "Canlı veri",
    mockFallback: "Model fallback",
    auditDetail: "Denetim detayı: fiyat ve getiri satırları",
    auditDetailSub: "Bu alan veri kararı değil; hesaplamaları besleyen serileri denetlemek için gösterilir.",
    prices: "Fiyatlar",
    dailyReturns: "Günlük getiriler",
    date: "Tarih",
    points: "nokta",
    session: "Oturum",
    symbolSources: "Sembol veri kaynakları",
    symbolSourcesSub: "Bu oturumda her varlığa atanan veri sağlayıcı.",
    symbolCol: "Sembol",
    nameCol: "Ad",
    providerCol: "Sağlayıcı",
  },
};

function moduleCopy(language) {
  return MODULE_COPY[language] || MODULE_COPY.tr;
}

function useContainerWidth(defaultWidth) {
  const ref = useRefVA(null);
  const [width, setWidth] = useStateVA(defaultWidth);
  useLayoutEffectVA(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const next = Math.floor(node.clientWidth || defaultWidth);
      if (next > 0) setWidth(next);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(node);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [defaultWidth]);
  return [ref, width];
}

function classOf(a) {
  if (["BND", "TLT"].includes(a.t)) return "bond";
  if (["GLD"].includes(a.t)) return "alt";
  return "equity";
}

/* ---------------- ANALYSIS ---------------- */
export function AnalysisTab({ p, language = "tr" }) {
  const copy = moduleCopy(language);
  const [rollRetRef, rollRetWidth] = useContainerWidth(760);
  const [rollSharpeRef, rollSharpeWidth] = useContainerWidth(760);
  const eqW = p.assets.filter(a => classOf(a) === "equity").reduce((s, a) => s + a.weight, 0);
  const bondW = p.assets.filter(a => classOf(a) === "bond").reduce((s, a) => s + a.weight, 0);
  const altW = p.assets.filter(a => classOf(a) === "alt").reduce((s, a) => s + a.weight, 0);

  const rebal = [
    { strat: language === "tr" ? "Rebalancing yok" : "No rebalancing", ret: p.annRet - 0.004, vol: p.annVol + 0.006, sharpe: p.sharpe - 0.05, turn: "0%", note: language === "tr" ? "Kazananlara kayar; risk yavaşça yükselir." : "Drifts toward winners; risk creeps up." },
    { strat: language === "tr" ? "Yıllık" : "Annual", ret: p.annRet + 0.002, vol: p.annVol - 0.003, sharpe: p.sharpe + 0.03, turn: "12%", note: language === "tr" ? "Düşük maliyetlidir, faydanın çoğunu yakalar." : "Low cost, captures most of the benefit." },
    { strat: language === "tr" ? "Çeyreklik" : "Quarterly", ret: p.annRet + 0.003, vol: p.annVol - 0.006, sharpe: p.sharpe + 0.06, turn: "34%", note: language === "tr" ? "Daha sıkı risk kontrolü sağlar, işlem maliyetini artırır." : "Tighter risk control, higher trading cost.", best: true },
    { strat: language === "tr" ? "%5 eşik bandı" : "5% threshold band", ret: p.annRet + 0.004, vol: p.annVol - 0.005, sharpe: p.sharpe + 0.05, turn: "21%", note: language === "tr" ? "Sadece anlamlı sapmalarda işlem yapar." : "Trades only on meaningful drift." },
  ];

  const stressRows = STRESS.map(s => {
    const impact = eqW * s.eq + bondW * s.bond + altW * (s.bond * 0.4 + 0.01);
    return { ...s, impact, dollar: impact * p.totalValue };
  });
  const latestRollRet = p.rollRet[p.rollRet.length - 1] || 0;
  const latestRollSharpe = p.rollSharpe[p.rollSharpe.length - 1] || 0;
  const worstStress = stressRows.slice().sort((a, b) => a.impact - b.impact)[0];
  const profileName = language === "tr"
    ? { balanced: "dengeli", risk: "risk odaklı", return: "getiri odaklı" }[p.profile]
    : { balanced: "balanced", risk: "risk-focused", return: "return-focused" }[p.profile];

  return (
    <div className="tab-body fade-up">
      <ModuleIntro
        question={copy.analysisQ}
        answer={copy.analysisA}
      >
        <Pill tone="accent">{copy.rollingMetrics}</Pill>
        <Pill tone="warn">{copy.stressView}</Pill>
      </ModuleIntro>

      <InsightGrid>
        <InsightCard label={language === "tr" ? "Son momentum" : "Recent momentum"} value={fmtPctSigned(latestRollRet)} tone={latestRollRet >= 0 ? "pos" : "neg"}>
          {copy.momentum}
        </InsightCard>
        <InsightCard label={language === "tr" ? "Son Sharpe" : "Recent Sharpe"} value={fmtNum(latestRollSharpe)} tone={latestRollSharpe >= 1 ? "pos" : "warn"}>
          {copy.rollingSharpe}
        </InsightCard>
        <InsightCard label={language === "tr" ? "En kötü stres" : "Worst stress"} value={fmtPctSigned(worstStress.impact)} tone="neg">
          {copy.worstStress} <strong>{worstStress.name}</strong>. {copy.stressHelp}
        </InsightCard>
      </InsightGrid>

      <div className="grid-2-eq">
        <Card title={copy.rollingReturnTitle} subtitle={copy.rollingReturnSub}>
          <div className="chart-responsive" ref={rollRetRef}>
            <VBars data={p.rollRet.map((v, i) => ({ v }))} fmt={v => (v * 100).toFixed(0) + "%"} color="var(--accent)" width={rollRetWidth} />
          </div>
        </Card>
        <Card title={copy.rollingSharpeTitle} subtitle={copy.rollingSharpeSub}>
          <div className="chart-responsive" ref={rollSharpeRef}>
            <MiniLine data={p.rollSharpe} color="var(--accent-2)" band={1} fmt={v => v.toFixed(1)} width={rollSharpeWidth} />
          </div>
        </Card>
      </div>

      <Card title={copy.rebalTitle} subtitle={copy.rebalSub} pad={false}>
        <Table columns={[
          { key: "strat", label: copy.strategy, render: r => (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <strong style={{ color: "var(--text)" }}>{r.strat}</strong>
              {r.best && <Pill tone="pos" size="sm">{copy.recommended}</Pill>}
            </span>
          ) },
          { key: "ret", label: copy.annReturn, align: "right", mono: true, color: () => "var(--pos)", render: r => fmtPctSigned(r.ret) },
          { key: "vol", label: copy.annVol, align: "right", mono: true, render: r => fmtPct(r.vol) },
          { key: "sharpe", label: "Sharpe", align: "right", mono: true, render: r => fmtNum(r.sharpe) },
          { key: "turn", label: copy.turnover, align: "right", mono: true },
          { key: "note", label: copy.notes, render: r => <span style={{ color: "var(--text-faint)", fontSize: 11.5 }}>{r.note}</span> },
        ]} rows={rebal} />
      </Card>

      <Card title={copy.stressTests} subtitle={copy.stressSub} pad={false}>
        <Table columns={[
          { key: "name", label: copy.scenario, render: r => (
            <div><div style={{ color: "var(--text)", fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{r.span}</div></div>
          ) },
          { key: "eq", label: copy.equityShock, align: "right", mono: true, render: r => fmtPct(r.eq) },
          { key: "bond", label: copy.bondShock, align: "right", mono: true, color: r => r.bond >= 0 ? "var(--pos)" : "var(--neg)", render: r => fmtPctSigned(r.bond) },
          { key: "impact", label: copy.estPortfolio, align: "right", mono: true, color: () => "var(--neg)", render: r => fmtPctSigned(r.impact) },
          { key: "dollar", label: copy.estPL, align: "right", mono: true, color: r => r.dollar >= 0 ? "var(--pos)" : "var(--neg)", render: r => (r.dollar >= 0 ? "+" : "−") + fmtUSD(Math.abs(r.dollar)).slice(1) },
          { key: "bar", label: "", align: "right", render: r => {
            const mag = Math.min(1, Math.abs(r.impact) / 0.5);
            return <div style={{ width: 90, height: 6, background: "var(--panel-hi)", borderRadius: 99, marginLeft: "auto", overflow: "hidden" }}>
              <div style={{ width: (mag * 100) + "%", height: "100%", background: "var(--neg)", borderRadius: 99 }} /></div>;
          } },
        ]} rows={stressRows} />
      </Card>
      <Alert tone="accent" title={copy.profileNote}>
        {copy.profileNoteText} (<strong className="num">{fmtPct(eqW)}</strong>).{" "}
        <strong>{profileName || p.profile}</strong> {copy.profileNoteTail}
      </Alert>
    </div>
  );
}

/* ---------------- OPTIMIZATION ---------------- */
export function OptimizationTab({ p, language = "tr" }) {
  const copy = moduleCopy(language);
  const [target, setTarget] = useStateVA("sharpe");
  const opt = target === "sharpe" ? p.maxSharpe : p.minRisk;
  const scenarios = [
    { id: "current", label: copy.current, ret: p.annRet, vol: p.annVol, sharpe: p.sharpe },
    { id: "sharpe", label: copy.maxSharpe, ret: p.maxSharpe.annRet, vol: p.maxSharpe.annVol, sharpe: p.maxSharpe.sharpe },
    { id: "risk", label: copy.minRisk, ret: p.minRisk.annRet, vol: p.minRisk.annVol, sharpe: p.minRisk.sharpe },
  ];

  const changes = p.assets.map((a, i) => {
    const t = opt.target.find(x => x.t === a.t);
    const delta = t.w - a.weight;
    return {
      t: a.t,
      color: assetColor(i),
      cur: a.weight,
      tgt: t.w,
      delta,
      action: Math.abs(delta) < 0.005 ? copy.hold : delta > 0 ? copy.increase : copy.decrease,
      direction: Math.abs(delta) < 0.005 ? "hold" : delta > 0 ? "up" : "down",
    };
  }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const turnover = changes.reduce((s, c) => s + Math.abs(c.delta), 0) / 2;
  const cost = turnover * p.totalValue * 0.0008; // 8bps

  return (
    <div className="tab-body fade-up">
      <ModuleIntro
        question={copy.optimizationQ}
        answer={copy.optimizationA}
      >
        <Pill tone={target === "sharpe" ? "accent" : "neutral"}>Max Sharpe</Pill>
        <Pill tone={target === "risk" ? "accent" : "neutral"}>Min Risk</Pill>
      </ModuleIntro>

      <InsightGrid>
        <InsightCard label={copy.decisionReadLabel} value={target === "sharpe" ? copy.returnRisk : copy.lowerRisk} tone="accent">
          {copy.decisionRead} {target === "sharpe" ? copy.decisionSharpe : copy.decisionRisk} {language === "tr" ? "çalışır. Sonuç mutlaka turnover ve maliyetle birlikte okunmalı." : "The result must be read together with turnover and cost."}
        </InsightCard>
        <InsightCard label={copy.sharpeDeltaLabel} value={(opt.sharpe - p.sharpe >= 0 ? "+" : "") + fmtNum(opt.sharpe - p.sharpe)} tone={opt.sharpe >= p.sharpe ? "pos" : "warn"}>
          {copy.sharpeDelta}
        </InsightCard>
        <InsightCard label={copy.tradingLoadLabel} value={fmtPct(turnover)} tone={turnover > 0.35 ? "warn" : "neutral"}>
          {copy.tradingLoad} {copy.estCost}: <span className="num">{fmtUSD(cost)}</span>.
        </InsightCard>
      </InsightGrid>

      {/* scenario cards */}
      <div className="opt-cards">
        {scenarios.map(s => {
          const active = s.id === "current" ? false : s.id === target;
          return (
            <button key={s.id} className={"opt-card" + (s.id === "current" ? " base" : "") + (active ? " on" : "")}
              onClick={() => s.id !== "current" && setTarget(s.id)} disabled={s.id === "current"}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="eyebrow">{s.label}</span>
                {s.id === "current" ? <Pill tone="neutral" size="sm">{copy.live}</Pill> : active ? <Pill tone="accent" size="sm">{copy.selected}</Pill> : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
                <OptStat label={language === "tr" ? "Getiri" : "Return"} value={fmtPctSigned(s.ret)} color="var(--pos)" />
                <OptStat label={language === "tr" ? "Risk" : "Risk"} value={fmtPct(s.vol)} />
                <OptStat label="Sharpe" value={fmtNum(s.sharpe)} color="var(--accent)" big />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid-2-1">
        <Card title={copy.suggestedChanges} subtitle={target === "sharpe" ? copy.suggestedSubSharpe : copy.suggestedSubRisk} pad={false}>
          <Table columns={[
            { key: "t", label: copy.asset, render: r => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
                <span className="num" style={{ fontWeight: 600, color: "var(--text)" }}>{r.t}</span>
              </span>
            ) },
            { key: "action", label: copy.action, render: r => <Pill tone={r.direction === "up" ? "pos" : r.direction === "down" ? "neg" : "neutral"} size="sm">{r.action}</Pill> },
            { key: "cur", label: copy.current, align: "right", mono: true, render: r => (r.cur * 100).toFixed(1) + "%" },
            { key: "tgt", label: copy.target, align: "right", mono: true, render: r => <strong style={{ color: "var(--text)" }}>{(r.tgt * 100).toFixed(1) + "%"}</strong> },
            { key: "delta", label: copy.change, align: "right", mono: true, color: r => Math.abs(r.delta) < 0.005 ? "var(--text-faint)" : r.delta >= 0 ? "var(--pos)" : "var(--neg)", render: r => (r.delta >= 0 ? "+" : "−") + Math.abs(r.delta * 100).toFixed(1) + "pp" },
            { key: "bar", label: "", render: r => {
              const w = Math.min(50, Math.abs(r.delta) * 100 * 4);
              return <div style={{ position: "relative", height: 8, width: 110 }}>
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border)" }} />
                <div style={{ position: "absolute", left: "50%", top: 1, height: 6, width: w + "%", borderRadius: 99, background: r.delta >= 0 ? "var(--pos)" : "var(--neg)", transform: r.delta >= 0 ? "none" : "translateX(-100%)", transformOrigin: "left" }} />
              </div>;
            } },
          ]} rows={changes} />
        </Card>
        <Card title={copy.turnoverCost} subtitle={copy.turnoverCostSub}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <BigStat label={language === "tr" ? "Tek yön turnover" : "One-way turnover"} value={fmtPct(turnover)} hint={language === "tr" ? "portföy değerinin işlem gören kısmı" : "of portfolio value traded"} />
            <BigStat label={language === "tr" ? "Tahmini işlem maliyeti" : "Est. transaction cost"} value={fmtUSD(cost)} hint={language === "tr" ? "taraf başına 8 bps" : "at 8 bps per side"} tone="neg" />
            <BigStat label={language === "tr" ? "Sharpe iyileşmesi" : "Sharpe improvement"} value={"+" + (opt.sharpe - p.sharpe).toFixed(2)} hint={language === "tr" ? "mevcut portföye göre" : "vs current portfolio"} tone="pos" />
          </div>
          <Alert tone="warn" title={copy.tradeOff}>
            {language === "tr" ? `${target === "sharpe" ? "Max Sharpe" : "Minimum Risk"} hedefi` : `Reaching the ${target === "sharpe" ? "max-Sharpe" : "min-risk"} mix`} {copy.tradeOffText} <strong className="num">{fmtPct(turnover)}</strong> {copy.tradeOffTail}
          </Alert>
        </Card>
      </div>
    </div>
  );
}

function OptStat({ label, value, color, big }) {
  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div className="num" style={{ fontSize: big ? 20 : 16, fontWeight: 600, marginTop: 3, color: color || "var(--text)" }}>{value}</div>
    </div>
  );
}
function BigStat({ label, value, hint, tone }) {
  const c = tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--text)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 14px", background: "var(--panel-2)", border: "1px solid var(--border-soft)", borderRadius: 9 }}>
      <div><div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>{label}</div><div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{hint}</div></div>
      <div className="num" style={{ fontSize: 19, fontWeight: 700, color: c }}>{value}</div>
    </div>
  );
}

/* ---------------- SIMULATION ---------------- */
export function SimulationTab({ p, assumptions, language = "tr" }) {
  const copy = moduleCopy(language);
  const [fanRef, fanWidth] = useContainerWidth(760);
  const [histRef, histWidth] = useContainerWidth(760);
  const sim = useMemoVA(() => monteCarlo(p.annRet, p.annVol, p.totalValue, assumptions.horizon, assumptions.paths, 4242),
    [p.annRet, p.annVol, p.totalValue, assumptions.horizon, assumptions.paths]);
  const cagr = q => Math.pow(q / p.totalValue, 1 / assumptions.horizon) - 1;

  return (
    <div className="tab-body fade-up">
      <ModuleIntro
        question={copy.simulationQ}
        answer={copy.simulationA}
      >
        <Pill tone="accent">{assumptions.horizon}Y {language === "tr" ? "vade" : "horizon"}</Pill>
        <Pill tone="neutral">{assumptions.paths.toLocaleString()} {language === "tr" ? "yol" : "paths"}</Pill>
      </ModuleIntro>

      <InsightGrid>
        <InsightCard label={copy.baseCaseLabel} value={fmtUSD(sim.median)} tone="accent">
          {copy.baseCase}
        </InsightCard>
        <InsightCard label={copy.downsideCaseLabel} value={fmtUSD(sim.p5)} tone="neg">
          {copy.downsideCase} {copy.lossProbability}: <span className="num">{fmtPct(sim.probLoss)}</span>.
        </InsightCard>
        <InsightCard label={copy.upsideCaseLabel} value={fmtUSD(sim.p95)} tone="pos">
          {copy.upsideCase} CAGR: <span className="num">{fmtPctSigned(cagr(sim.p95))}</span>.
        </InsightCard>
      </InsightGrid>

      <div className="kpi-strip">
        <Metric label={copy.medianTerminal} value={fmtUSD(sim.median)} accent="var(--accent)" sub={`${assumptions.horizon}y · ${fmtPctSigned(cagr(sim.median))} CAGR`} />
        <Metric label={copy.percentile95} value={fmtUSD(sim.p95)} accent="var(--pos)" sub={fmtPctSigned(cagr(sim.p95)) + " CAGR"} />
        <Metric label={copy.percentile5} value={fmtUSD(sim.p5)} accent="var(--neg)" sub={fmtPctSigned(cagr(sim.p5)) + " CAGR"} />
        <Metric label={copy.probLoss} value={fmtPct(sim.probLoss)} sub={copy.endingBelowStart} glossary={language === "tr" ? "Başlangıç değerinin altında biten simülasyon yollarının oranı." : "Share of paths finishing under the starting value."} />
        <Metric label={copy.pathsSimulated} value={assumptions.paths.toLocaleString()} sub="Monte Carlo" />
      </div>

      <Card title={copy.simPaths} subtitle={`${assumptions.paths.toLocaleString()} ${copy.simPathsSub} ${assumptions.horizon} ${copy.simPathsTail}`}>
        <div className="chart-responsive" ref={fanRef}>
          <FanChart sim={sim} startValue={p.totalValue} years={assumptions.horizon} width={fanWidth} />
        </div>
      </Card>

      <div className="grid-2-1">
        <Card title={copy.terminalDistribution} subtitle={copy.terminalDistributionSub}>
          <div className="chart-responsive" ref={histRef}>
            <Histogram values={sim.terminal} startValue={p.totalValue} width={histWidth} />
          </div>
        </Card>
        <Card title={copy.outcomeScenarios} subtitle={copy.outcomeSub}>
          <Table dense zebra={false} columns={[
            { key: "p", label: copy.percentile },
            { key: "v", label: copy.value, align: "right", mono: true, render: r => <strong style={{ color: "var(--text)" }}>{fmtUSD(r.v)}</strong> },
            { key: "c", label: "CAGR", align: "right", mono: true, color: r => r.c >= 0 ? "var(--pos)" : "var(--neg)", render: r => fmtPctSigned(r.c) },
          ]} rows={[
            { p: language === "tr" ? "Kötümser (5.)" : "Pessimistic (5th)", v: sim.p5, c: cagr(sim.p5) },
            { p: language === "tr" ? "Alt bant (25.)" : "Lower (25th)", v: sim.p25, c: cagr(sim.p25) },
            { p: language === "tr" ? "Medyan (50.)" : "Median (50th)", v: sim.median, c: cagr(sim.median) },
            { p: language === "tr" ? "Üst bant (75.)" : "Upper (75th)", v: sim.p75, c: cagr(sim.p75) },
            { p: language === "tr" ? "İyimser (95.)" : "Optimistic (95th)", v: sim.p95, c: cagr(sim.p95) },
          ]} />
          <Alert tone="warn" title={copy.modelNote}>
            {copy.modelNoteText}
          </Alert>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- COMPANY DATA helpers ---------------- */

// Convert a Unix-seconds timestamp (from Finnhub) to a relative or ISO date string.
function fmtNewsDate(dt, language) {
  if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return "";
  const diff = Date.now() - dt.getTime();
  if (diff < 0) return dt.toISOString().slice(0, 10);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (language === "tr") {
    if (mins  < 2)  return "Az önce";
    if (mins  < 60) return mins  + "dk önce";
    if (hours < 24) return hours + "s önce";
    if (days  < 8)  return days  + "g önce";
  } else {
    if (mins  < 2)  return "Just now";
    if (mins  < 60) return mins  + "m ago";
    if (hours < 24) return hours + "h ago";
    if (days  < 8)  return days  + "d ago";
  }
  return dt.toISOString().slice(0, 10);
}

// Normalize one raw Finnhub news object. Returns null if headline is absent.
// Headline is capped at 120 chars to avoid overlong card rows.
function normalizeNewsItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const headline = String(raw.headline || "").trim();
  if (!headline) return null;
  const source   = String(raw.source || "").trim() || "—";
  const datetime = typeof raw.datetime === "number" && raw.datetime > 0
    ? new Date(raw.datetime * 1000) : null;
  const rawUrl   = typeof raw.url === "string" ? raw.url.trim() : "";
  const url      = (rawUrl.startsWith("https://") || rawUrl.startsWith("http://")) ? rawUrl : null;
  return {
    headline: headline.length > 120 ? headline.slice(0, 117) + "…" : headline,
    source,
    datetime,
    url,
  };
}

/* ---------------- COMPANY DATA ---------------- */
export function CompanyTab({ p, referenceDataStatus, apiStatus, language = "tr" }) {
  const copy = moduleCopy(language);
  const equities = p.assets.filter(a => a.cls === "Equity");
  const [sel, setSel] = useStateVA(equities[0] ? equities[0].t : null);
  const [newsState, setNewsState] = useStateVA({ status: "idle", items: [] });

  // proxyOk drives the news fetch — derived from the apiStatus prop passed from app.jsx
  const proxyOk = Boolean(apiStatus && apiStatus.ok);

  useEffectVA(function() {
    if (!sel || !proxyOk) {
      setNewsState({ status: !sel ? "idle" : "unavailable", items: [] });
      return;
    }
    var cancelled = false;
    setNewsState({ status: "loading", items: [] });
    var apiBase = (DATA_SOURCES && DATA_SOURCES.real && DATA_SOURCES.real.baseUrl) || "http://127.0.0.1:8787";
    var today    = new Date().toISOString().slice(0, 10);
    var fromDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    var newsUrl  = apiBase + "/api/company/news?symbol=" + encodeURIComponent(sel) + "&from=" + fromDate + "&to=" + today;
    fetch(newsUrl)
      .then(function(r) { return r.json().then(function(b) { return { httpOk: r.ok, body: b }; }); })
      .then(function(res) {
        if (cancelled) return;
        if (!res.httpOk || !res.body.ok) {
          var status = res.body && res.body.error === "rate_limited" ? "rate_limited" : "error";
          setNewsState({ status: status, items: [] });
          return;
        }
        var items = (Array.isArray(res.body.data) ? res.body.data : [])
          .map(normalizeNewsItem).filter(Boolean).slice(0, 6);
        setNewsState({ status: items.length ? "loaded" : "empty", items: items });
      })
      .catch(function() { if (!cancelled) setNewsState({ status: "error", items: [] }); });
    return function() { cancelled = true; };
  }, [sel, proxyOk]);

  if (!sel || !equities.find(e => e.t === sel)) {
    return <div className="tab-body fade-up"><Card><div style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>{copy.addEquityMessage}</div></Card></div>;
  }
  const u = equities.find(e => e.t === sel) || lookup(sel);
  const c = companyDisplay(u, COMPANY[sel], u.companyProfile);
  const profileSource = u.companyProfile ? "Finnhub company profile" : (p.source && p.source.companyProvider) || (language === "tr" ? "Şirket profili adaptörü" : "Company profile adapter");
  const quoteSource = u.quote ? "Finnhub quote" : u.dataProvider || (language === "tr" ? "portföy fiyatı" : "portfolio price");

  return (
    <div className="tab-body fade-up">
      <ModuleIntro
        question={copy.companyQ}
        answer={copy.companyA}
      >
        <Pill tone={referenceDataStatus?.status === "ready" ? "pos" : "neutral"}>
          {referenceDataStatus?.status === "ready" ? (language === "tr" ? "Canlı profil" : "Live profile") : (language === "tr" ? "Fallback hazır" : "Fallback ready")}
        </Pill>
      </ModuleIntro>

      <InsightGrid>
        <InsightCard label={copy.selectedCompanyLabel} value={u.t} tone="accent">
          {copy.selectedCompany} <strong>{c.name}</strong>.
        </InsightCard>
        <InsightCard label={copy.quoteSourceLabel} value={u.quote ? copy.liveQuote : copy.fallback} tone={u.quote ? "pos" : "neutral"}>
          {copy.quoteSource} {u.quote ? "Finnhub quote" : (language === "tr" ? "portföy fiyatı fallback" : "portfolio price fallback")}.
        </InsightCard>
        <InsightCard label={copy.profileSourceLabel} value={u.companyProfile ? "Finnhub" : copy.fallback} tone={u.companyProfile ? "pos" : "neutral"}>
          {copy.profileSource}
        </InsightCard>
      </InsightGrid>

      <div className="ticker-tabs">
        {equities.map(e => (
          <button key={e.t} className={"ticker-tab" + (e.t === sel ? " on" : "")} onClick={() => setSel(e.t)}>
            <span className="num">{e.t}</span>
          </button>
        ))}
      </div>

      <div className="grid-1-2">
        <Card title={copy.companyProfile} subtitle={`${copy.source}: ${profileSource}.`}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{u.t.slice(0, 2)}</div>
            <div><div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div><div style={{ fontSize: 11.5, color: "var(--text-faint)" }} className="num">{c.exch}: {c.ticker} · {c.currency}</div></div>
            <div style={{ marginLeft: "auto" }}><Pill tone={u.companyProfile ? "pos" : "neutral"} size="sm">{u.companyProfile ? (language === "tr" ? "Canlı profil" : "Real Profile") : copy.fallback}</Pill></div>
          </div>
          <div className="profile-grid">
            <ProfRow label={copy.industry} value={c.industry} />
            <ProfRow label={copy.marketCap} value={"$" + c.mktcap + "B"} mono />
            <ProfRow label={language === "tr" ? "Dolaşımdaki hisse" : "Shares out."} value={typeof c.shares === "number" ? c.shares.toLocaleString() + "M" : c.shares} mono />
            <ProfRow label={language === "tr" ? "Son fiyat" : "Last price"} value={`${fmtUSDc(u.px)} (${quoteSource})`} mono />
            <ProfRow label={copy.ipoDate} value={c.ipo} mono />
            <ProfRow label={copy.country} value={c.country} />
            <ProfRow label={copy.employees} value={c.emp} mono />
            <ProfRow label={copy.website} value={c.web} accent />
          </div>
        </Card>
        <Card title={copy.recentNews} subtitle={`${copy.latestHeadlines} ${u.t}.`} pad={false}>
          {(newsState.status === "idle" || newsState.status === "loading") && (
            <div style={{ padding: "16px", color: "var(--text-faint)", fontSize: 12.5 }}>{copy.newsLoading}</div>
          )}
          {newsState.status === "unavailable" && (
            <div style={{ padding: "16px", color: "var(--text-faint)", fontSize: 12.5 }}>{copy.newsUnavailable}</div>
          )}
          {(newsState.status === "error" || newsState.status === "empty") && (
            <div style={{ padding: "16px", color: "var(--text-faint)", fontSize: 12.5 }}>{copy.newsEmpty}</div>
          )}
          {newsState.status === "rate_limited" && (
            <div style={{ padding: "16px", color: "var(--warn)", fontSize: 12.5 }}>{copy.newsRateLimit}</div>
          )}
          {newsState.status === "loaded" && (
            <>
              <div className="news-list">
                {newsState.items.map((n, i) => (
                  <div key={i} className="news-item">
                    <div className="news-thumb"><span className="num">{n.source.slice(0, 2).toUpperCase()}</span></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="news-head">
                        {n.url
                          ? <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{n.headline}</a>
                          : n.headline
                        }
                      </div>
                      <div className="news-meta">
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{n.source}</span>
                        {n.datetime && <>{" · "}{fmtNewsDate(n.datetime, language)}</>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-soft)", fontSize: 10.5, color: "var(--text-faint)" }}>
                {copy.newsContextNote}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
function ProfRow({ label, value, mono, accent }) {
  return (
    <div className="prof-row">
      <span>{label}</span>
      <span className={mono ? "num" : ""} style={{ color: accent ? "var(--accent)" : "var(--text)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function companyDisplay(asset, fallback, real) {
  const base = fallback || {
    name: asset.name,
    ticker: asset.t,
    exch: "NASDAQ",
    ipo: "-",
    country: "US",
    currency: "USD",
    industry: asset.sector,
    mktcap: Math.round(asset.px * 4.2),
    shares: "-",
    web: asset.t.toLowerCase() + ".com",
    emp: "-",
  };
  if (!real) return base;
  return {
    name: real.name || base.name,
    ticker: real.ticker || asset.t,
    exch: real.exchange || base.exch,
    ipo: real.ipo || base.ipo,
    country: real.country || base.country,
    currency: real.currency || base.currency,
    industry: real.finnhubIndustry || base.industry,
    mktcap: Number.isFinite(Number(real.marketCapitalization)) ? Number(real.marketCapitalization).toFixed(2) : base.mktcap,
    shares: Number.isFinite(Number(real.shareOutstanding)) ? Number(real.shareOutstanding) : base.shares,
    web: real.weburl || base.web,
    emp: real.employeeTotal || base.emp,
  };
}

/* ---------------- RAW DATA ---------------- */
export function DataTab({ p, dateRange, apiStatus, marketDataStatus, referenceDataStatus, language = "tr" }) {
  const copy = moduleCopy(language);
  const [view, setView] = useStateVA("prices");
  const source = p.source || DATA_SOURCES.mock;
  const proxy = proxyHealthDisplay(apiStatus, language);
  const market = marketHistoryDisplay(marketDataStatus, language);
  const reference = referenceDataDisplay(referenceDataStatus, language);
  if (!p.assets.length) {
    return (
      <div className="tab-body fade-up">
        <ModuleIntro
          question={copy.dataQ}
          answer={copy.dataA}
        />
        <InsightGrid>
          <InsightCard label={copy.proxyHealth} value={proxy.status} tone={proxy.status === "ready" ? "pos" : "warn"}>
            {proxy.value}
          </InsightCard>
          <InsightCard label={copy.priceHistory} value={market.status} tone={market.status === "ready" ? "pos" : "neutral"}>
            {market.value}
          </InsightCard>
          <InsightCard label={copy.quoteProfile} value={reference.status} tone={reference.status === "ready" ? "pos" : "neutral"}>
            {reference.value}
          </InsightCard>
        </InsightGrid>

        <Card title={copy.dataAudit} subtitle={source.label || copy.configuredSource}>
          <div className="src-grid">
            <SrcItem label={copy.apiProxy} value={proxy.value} status={proxy.status} />
            <SrcItem label={copy.priceHistory} value={market.value} status={market.status} />
            <SrcItem label={copy.quoteProfile} value={reference.value} status={reference.status} />
            <SrcItem label={copy.priceModel} value={source.priceProvider || (language === "tr" ? "Fiyat adaptörü" : "Price adapter")} status={source.status || "ready"} />
            <SrcItem label={copy.companyProfile} value={source.companyProvider || (language === "tr" ? "Profil adaptörü" : "Profile adapter")} status={source.status || "ready"} />
            <SrcItem label={copy.companyNews} value={source.newsProvider || (language === "tr" ? "Haber adaptörü" : "News adapter")} status={source.status || "ready"} />
            <SrcItem label={copy.range} value={dateRange + (language === "tr" ? " - günlük" : " - daily")} status="ok" />
            <SrcItem label={copy.rows} value={`0 ${copy.points}`} status="ok" />
            <SrcItem label={copy.lastUpdate} value={source.lastUpdated || copy.session} status="ok" />
          </div>
        </Card>
        <Card title={copy.series} subtitle={copy.seriesSub}>
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
            {copy.addInstrumentRows}
          </div>
        </Card>
      </div>
    );
  }
  // build last ~12 rows of prices & returns
  const idxs = [];
  const len = p.assets[0].path.length;
  for (let i = Math.max(0, len - 12); i < len; i++) idxs.push(i);
  const dateFor = i => {
    const d = new Date(2026, 5, 4); d.setDate(d.getDate() - (len - 1 - i) * (p.days > 400 ? 60 : 14));
    return d.toISOString().slice(0, 10);
  };
  const priceCols = [{ key: "date", label: copy.date, mono: true, render: r => r.date }]
    .concat(p.assets.map(a => ({ key: a.t, label: a.t, align: "right", mono: true, render: r => fmtUSDc(r[a.t]) })));
  const priceRows = idxs.map(i => { const row = { date: dateFor(i) }; p.assets.forEach(a => row[a.t] = a.path[i]); return row; });

  const retCols = [{ key: "date", label: copy.date, mono: true, render: r => r.date }]
    .concat(p.assets.map(a => ({ key: a.t, label: a.t, align: "right", mono: true, color: r => r[a.t] >= 0 ? "var(--pos)" : "var(--neg)", render: r => fmtPctSigned(r[a.t], 2) })));
  const retRows = idxs.filter(i => i > 0).map(i => { const row = { date: dateFor(i) }; p.assets.forEach(a => row[a.t] = a.path[i] / a.path[i - 1] - 1); return row; });

  return (
    <div className="tab-body fade-up">
      <ModuleIntro
        question={copy.dataQ}
        answer={copy.dataA}
      >
        <Pill tone={source.id === "real" ? "pos" : "neutral"}>{source.id === "real" ? copy.realData : copy.mockFallback}</Pill>
      </ModuleIntro>

      <InsightGrid>
        <InsightCard label={copy.proxyHealth} value={proxy.status} tone={proxy.status === "ready" ? "pos" : "warn"}>
          {proxy.value}
        </InsightCard>
        <InsightCard label={copy.priceHistory} value={market.status} tone={market.status === "ready" ? "pos" : market.status === "missing-key" ? "warn" : "neutral"}>
          {market.value}
        </InsightCard>
        <InsightCard label={copy.quoteProfile} value={reference.status} tone={reference.status === "ready" ? "pos" : "neutral"}>
          {reference.value}
        </InsightCard>
      </InsightGrid>

      <Card title={copy.dataAudit} subtitle={source.label || copy.configuredSource}>
        <div className="src-grid">
          <SrcItem label={copy.apiProxy} value={proxy.value} status={proxy.status} />
          <SrcItem label={copy.priceHistory} value={market.value} status={market.status} />
          <SrcItem label={copy.quoteProfile} value={reference.value} status={reference.status} />
          <SrcItem label={copy.priceModel} value={source.priceProvider || (language === "tr" ? "Fiyat adaptörü" : "Price adapter")} status={source.status || "ready"} />
          <SrcItem label={copy.companyProfile} value={source.companyProvider || (language === "tr" ? "Profil adaptörü" : "Profile adapter")} status={source.status || "ready"} />
          <SrcItem label={copy.companyNews} value={source.newsProvider || (language === "tr" ? "Haber adaptörü" : "News adapter")} status={source.status || "ready"} />
          <SrcItem label={copy.range} value={dateRange + (language === "tr" ? " · günlük" : " · daily")} status="ok" />
          <SrcItem label={copy.rows} value={(p.assets.length * len).toLocaleString() + ` ${copy.points}`} status="ok" />
          <SrcItem label={copy.lastUpdate} value={source.lastUpdated || copy.session} status="ok" />
        </div>
      </Card>

      <Card title={copy.symbolSources} subtitle={copy.symbolSourcesSub} pad={false}>
        <Table dense columns={[
          { key: "t", label: copy.symbolCol, render: r => (
            <span className="num" style={{ fontWeight: 600, color: "var(--text)" }}>{r.t}</span>
          )},
          { key: "name", label: copy.nameCol },
          { key: "provider", label: copy.providerCol, render: r => (
            <Pill tone={dataProviderTone(r.provider)} size="sm">{dataProviderLabel(r.provider, language)}</Pill>
          )},
        ]} rows={p.assets.map(a => ({ t: a.t, name: a.name, provider: a.dataProvider }))} />
      </Card>

      <Card title={copy.auditDetail} subtitle={copy.auditDetailSub}
        action={<Segmented size="sm" value={view} onChange={setView} options={[{ value: "prices", label: copy.prices }, { value: "returns", label: copy.dailyReturns }]} />}
        pad={false}>
        {view === "prices"
          ? <Table dense columns={priceCols} rows={priceRows} />
          : <Table dense columns={retCols} rows={retRows} />}
      </Card>
    </div>
  );
}
function SrcItem({ label, value, status }) {
  const tone = status === "live" || status === "ready"
    ? "pos"
    : status === "missing-key" || status === "configured"
      ? "warn"
      : status === "offline"
        ? "neg"
        : "neutral";
  return (
    <div style={{ padding: "11px 13px", background: "var(--panel-2)", border: "1px solid var(--border-soft)", borderRadius: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="eyebrow" style={{ fontSize: 9.5 }}>{label}</span>
        <Pill tone={tone} size="sm">{status}</Pill>
      </div>
      <div className="num" style={{ fontSize: 12.5, marginTop: 6, color: "var(--text)" }}>{value}</div>
    </div>
  );
}

function proxyHealthDisplay(apiStatus, language = "tr") {
  if (!apiStatus || !apiStatus.checked) {
    return { status: "checking", value: language === "tr" ? "http://127.0.0.1:8787/api/health kontrol ediliyor" : "Checking http://127.0.0.1:8787/api/health" };
  }
  if (!apiStatus.ok) {
    return { status: "offline", value: apiStatus.message || (language === "tr" ? "Proxy çevrimdışı" : "Proxy offline") };
  }
  if (!apiStatus.hasFinnhubKey) {
    return { status: "missing-key", value: language === "tr" ? "Proxy çevrimiçi, FINNHUB_API_KEY eksik" : "Proxy online, FINNHUB_API_KEY missing" };
  }
  return { status: "ready", value: language === "tr" ? "Proxy çevrimiçi, Finnhub key yüklü" : "Proxy online, Finnhub key loaded" };
}

function marketHistoryDisplay(marketDataStatus, language = "tr") {
  if (!marketDataStatus || marketDataStatus.status === "idle") {
    return { status: "neutral", value: language === "tr" ? "Portföy varlıkları bekleniyor" : "Waiting for portfolio holdings" };
  }
  if (marketDataStatus.status === "loading") {
    return { status: "checking", value: language === "tr" ? "Fiyat geçmişi local proxy üzerinden yükleniyor" : "Loading history from local proxy" };
  }
  if (marketDataStatus.status === "ready") {
    return { status: "ready", value: language === "tr" ? `${marketDataStatus.loaded}/${marketDataStatus.requested} varlık canlı geçmiş kullanıyor` : `${marketDataStatus.loaded}/${marketDataStatus.requested} holdings using real history` };
  }
  if (marketDataStatus.status === "partial") {
    return { status: "missing-key", value: language === "tr" ? `${marketDataStatus.loaded}/${marketDataStatus.requested} varlık canlı geçmiş kullanıyor` : `${marketDataStatus.loaded}/${marketDataStatus.requested} holdings using real history` };
  }
  return { status: "neutral", value: marketDataStatus.message || (language === "tr" ? "Model fiyat verisi kullanılıyor" : "Using mock price model") };
}

function referenceDataDisplay(referenceDataStatus, language = "tr") {
  if (!referenceDataStatus || referenceDataStatus.status === "idle") {
    return { status: "neutral", value: language === "tr" ? "Portföy varlıkları bekleniyor" : "Waiting for portfolio holdings" };
  }
  if (referenceDataStatus.status === "loading") {
    return { status: "checking", value: language === "tr" ? "Finnhub quote/profile yükleniyor" : "Loading Finnhub quote/profile" };
  }
  if (referenceDataStatus.status === "ready") {
    return {
      status: "ready",
      value: language === "tr"
        ? `${referenceDataStatus.quoteLoaded}/${referenceDataStatus.requested} quote, ${referenceDataStatus.profileLoaded}/${referenceDataStatus.requested} profil`
        : `${referenceDataStatus.quoteLoaded}/${referenceDataStatus.requested} quotes, ${referenceDataStatus.profileLoaded}/${referenceDataStatus.requested} profiles`,
    };
  }
  return { status: "neutral", value: language === "tr" ? "Fallback quote/profile verisi kullanılıyor" : "Using fallback quote/profile data" };
}
