/* ============================================================
   src/data.js — Vite-native ES module for pure data/financial logic.
   Canonical source for all portfolio analytics.

   public/legacy/data.jsx is the browser-Babel shim that runs the
   same logic and assigns the exports to window for legacy script
   consumers (charts.jsx, ui.jsx, sidebar.jsx, app.jsx, views-*.jsx).

   Migration phase: 6b (adapter-based first step).
   Everything is seeded so charts are stable across re-renders.
   ============================================================ */

// --- seeded RNG (mulberry32) ---
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// gaussian
function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// --- universe of selectable instruments (search) ---
export const UNIVERSE = [
  { t: "AAPL", name: "Apple Inc.",                cls: "Equity", sector: "Technology",     px: 232.18, mu: 0.165, sig: 0.262 },
  { t: "MSFT", name: "Microsoft Corp.",           cls: "Equity", sector: "Technology",     px: 441.07, mu: 0.158, sig: 0.231 },
  { t: "NVDA", name: "NVIDIA Corp.",              cls: "Equity", sector: "Semiconductors", px: 138.42, mu: 0.310, sig: 0.452 },
  { t: "VTI",  name: "Vanguard Total Stock Mkt",  cls: "ETF",    sector: "US Broad Market",px: 296.55, mu: 0.102, sig: 0.158 },
  { t: "BND",  name: "Vanguard Total Bond Mkt",   cls: "ETF",    sector: "Aggregate Bond", px: 73.21,  mu: 0.038, sig: 0.061 },
  { t: "AMZN", name: "Amazon.com Inc.",           cls: "Equity", sector: "Consumer Disc.", px: 201.30, mu: 0.182, sig: 0.298 },
  { t: "GOOGL",name: "Alphabet Inc. Class A",     cls: "Equity", sector: "Communication",  px: 176.49, mu: 0.150, sig: 0.255 },
  { t: "JPM",  name: "JPMorgan Chase & Co.",      cls: "Equity", sector: "Financials",     px: 243.71, mu: 0.118, sig: 0.221 },
  { t: "XOM",  name: "Exxon Mobil Corp.",         cls: "Equity", sector: "Energy",         px: 113.88, mu: 0.090, sig: 0.247 },
  { t: "TLT",  name: "iShares 20+ Yr Treasury",   cls: "ETF",    sector: "Long Treasury",  px: 91.04,  mu: 0.031, sig: 0.142 },
  { t: "GLD",  name: "SPDR Gold Shares",          cls: "ETF",    sector: "Commodity",      px: 247.66, mu: 0.072, sig: 0.139 },
  { t: "VEA",  name: "Vanguard FTSE Dev. Mkts",   cls: "ETF",    sector: "Intl Developed", px: 51.92,  mu: 0.081, sig: 0.171 },
  { t: "QQQ",  name: "Invesco QQQ Trust",         cls: "ETF",    sector: "US Large Growth",px: 512.34, mu: 0.135, sig: 0.214 },
  { t: "META", name: "Meta Platforms Inc.",       cls: "Equity", sector: "Communication",  px: 612.77, mu: 0.195, sig: 0.336 },
  { t: "BRK.B",name: "Berkshire Hathaway B",      cls: "Equity", sector: "Financials",     px: 467.20, mu: 0.108, sig: 0.176 },
];

// default starting portfolio: ticker -> lots (shares)
export const DEFAULT_LOTS = { AAPL: 120, MSFT: 60, NVDA: 240, VTI: 180, BND: 400 };

// Simplified balanced reference scenario constants — used in buildPortfolio for the comparison chart.
// BENCH_EQUITY_SCALAR: scales VTI daily returns to approximate 60% equity / 40% bond exposure.
// BENCH_DAILY_INCOME:  adds ≈2.5 %/yr drift representing notional bond income on the 40% allocation.
// The output is a scenario approximation, not an actual 60/40 blended index (BND is not fetched).
// See docs/ARCHITECTURE_AUDIT.md Risk 6 for full context and Phase 3c migration path.
const BENCH_EQUITY_SCALAR = 0.85;
const BENCH_DAILY_INCOME  = 0.0001;

export function lookup(t) { return UNIVERSE.find(u => u.t === t); }

// generic synthetic equity proxy — not calibrated; used only for extended-universe tickers when real history is unavailable
export const DEFAULT_GBM = { px: 100, mu: 0.10, sig: 0.25 };

export function isValidTicker(str) {
  if (typeof str !== "string") return false;
  return /^[A-Z0-9.]{1,8}$/.test(str.trim());
}

// VITE_API_BASE_URL: optional build-time variable pointing at a deployed proxy.
// Falls back to localhost for local development (Mode B).
// Never set VITE_FINNHUB_API_KEY — the key must stay server-side only.
const _PROXY_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8787";

export const DATA_SOURCES = {
  mock: {
    id: "mock",
    label: "Mock market model",
    modeLabel: "Mock · Adapter Ready",
    status: "ready",
    priceProvider: "Deterministic GBM prices",
    companyProvider: "Mock company profile",
    newsProvider: "Mock company news",
    lastUpdated: "Scenario seed 2026-06-04",
  },
  real: {
    id: "real",
    label: "Real market data proxy",
    modeLabel: "Real - API Proxy",
    status: "configured",
    priceProvider: "Finnhub stock candles via local proxy",
    companyProvider: "Finnhub profile2 via local proxy",
    newsProvider: "Finnhub company news via local proxy",
    lastUpdated: "Runtime API",
    baseUrl: _PROXY_BASE_URL,
  },
};

export function createMarketDataAdapter(sourceId = "mock") {
  const source = DATA_SOURCES[sourceId] || DATA_SOURCES.mock;
  return {
    source,
    listInstruments: () => UNIVERSE,
    lookup,
    buildPortfolio: (holdings, opts = {}) => buildPortfolio(holdings, { ...opts, source: opts.source || source.id }),
  };
}

export const ACTIVE_DATA_ADAPTER = createMarketDataAdapter("mock");

// --- correlation matrix (symmetric, plausible) ---
const CORR = {
  AAPL:  { AAPL:1.00, MSFT:0.78, NVDA:0.71, VTI:0.82, BND:-0.18, AMZN:0.69, GOOGL:0.72, JPM:0.54, XOM:0.21, TLT:-0.26, GLD:0.06, VEA:0.61, QQQ:0.86, META:0.66, "BRK.B":0.58 },
  MSFT:  { MSFT:1.00, NVDA:0.74, VTI:0.80, BND:-0.15, AMZN:0.71, GOOGL:0.76, JPM:0.52, XOM:0.18, AAPL:0.78 },
  NVDA:  { NVDA:1.00, VTI:0.69, BND:-0.20, AMZN:0.66, GOOGL:0.64, JPM:0.45, XOM:0.16 },
  VTI:   { VTI:1.00, BND:-0.08, AMZN:0.79, GOOGL:0.81, JPM:0.74, XOM:0.49 },
  BND:   { BND:1.00, AMZN:-0.12, GOOGL:-0.14, JPM:0.12, XOM:-0.05, TLT:0.83, GLD:0.31 },
};
export function corr(a, b) {
  if (a === b) return 1;
  if (CORR[a] && CORR[a][b] != null) return CORR[a][b];
  if (CORR[b] && CORR[b][a] != null) return CORR[b][a];
  // deterministic fallback from ticker hash
  const h = (a + b).split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return Math.round((0.35 + (h % 40) / 100) * 100) / 100;
}

// --- generate a daily price path (geometric brownian-ish) ---
function pricePath(ticker, days, seed) {
  const u = lookup(ticker) || { ...DEFAULT_GBM, t: ticker };
  const r = rng(seed + ticker.split("").reduce((s, c) => s + c.charCodeAt(0), 0));
  const dt = 1 / 252;
  const out = [u.px / Math.exp(u.mu * (days / 252) * 0.6)]; // back out a start
  for (let i = 1; i < days; i++) {
    const prev = out[i - 1];
    const drift = (u.mu - 0.5 * u.sig * u.sig) * dt;
    const shock = u.sig * Math.sqrt(dt) * gauss(r);
    out.push(prev * Math.exp(drift + shock));
  }
  return out;
}

// daily simple returns from a price path
function dailyReturns(path) {
  const out = [];
  for (let i = 1; i < path.length; i++) out.push(path[i] / path[i - 1] - 1);
  return out;
}
function historyPath(history, days) {
  const rows = Array.isArray(history?.candles) ? history.candles : Array.isArray(history) ? history : [];
  const path = rows
    .map(row => Number(row.adjClose ?? row.close))
    .filter(Number.isFinite);
  if (path.length < 2) return null;
  return path.slice(-Math.max(2, days + 1));
}
function hasUsableHistory(history) {
  return Boolean(historyPath(history, 2));
}
function quotePrice(quote) {
  const price = Number(quote?.data?.c ?? quote?.c);
  return Number.isFinite(price) && price > 0 ? price : null;
}

// sample covariance of two equal-length arrays (n−1 denominator)
function sampleCov(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return NaN;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  return xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / (n - 1);
}

// data-derived beta: cov(portRets, benchRets) / var(benchRets)
// fallback 1.0 when n < 20, benchmark variance ≈ 0, or result is not finite
function calcBeta(portRets, benchRets) {
  const n = Math.min(portRets.length, benchRets.length);
  if (n < 20) return 1.0;
  const p = portRets.slice(0, n), b = benchRets.slice(0, n);
  const bVar = sampleCov(b, b);
  if (!Number.isFinite(bVar) || bVar < 1e-12) return 1.0;
  const beta = sampleCov(p, b) / bVar;
  return Number.isFinite(beta) ? beta : 1.0;
}

// --- build the full analytics bundle for a given holdings set ---
// holdings: [{t, lots}]
export function emptyPortfolio(profile = "balanced", source = DATA_SOURCES.mock) {
  const emptyOpt = { target: [], annRet: 0, annVol: 0, sharpe: 0 };
  return {
    assets: [],
    totalValue: 0,
    profile,
    source,
    days: 0,
    portRets: [],
    cum: [1],
    benchCum: [1],
    annRet: 0,
    annVol: 0,
    sharpe: 0,
    mdd: 0,
    rf: 0.043,
    hhi: 0,
    rollVol: [],
    rollRet: [],
    rollSharpe: [],
    maxSharpe: emptyOpt,
    minRisk: emptyOpt,
    sortino: 0,
    beta: 0,
    var95: 0,
    cvar95: 0,
    totalCostBasis: null,
    totalUnrealizedPnl: null,
    totalUnrealizedPct: null,
  };
}

export function buildPortfolio(holdings, opts = {}) {
  const days = opts.days || 504; // ~2y trading days
  const seed = opts.seed || 20260604;
  const profile = opts.profile || "balanced";
  const historyBySymbol = opts.historyBySymbol || {};
  const quoteBySymbol = opts.quoteBySymbol || {};
  const profileBySymbol = opts.profileBySymbol || {};
  const realSymbols = holdings
    .map(h => h.t)
    .filter(t => hasUsableHistory(historyBySymbol[t]) || quotePrice(quoteBySymbol[t]));
  const sourceId = opts.source || (realSymbols.length ? "real" : "mock");
  const source = DATA_SOURCES[sourceId] || DATA_SOURCES.mock;

  const assets = holdings.map(h => {
    const u = lookup(h.t) || (isValidTicker(h.t)
      ? { ...DEFAULT_GBM, t: h.t, name: h.t, cls: "Equity", sector: "Extended", extended: true }
      : null);
    if (!u) return null;
    const realPath = historyPath(historyBySymbol[h.t], days);
    const liveQuote = quotePrice(quoteBySymbol[h.t]);
    const latestPrice = liveQuote || (realPath ? realPath[realPath.length - 1] : u.px);
    const value = h.lots * latestPrice;
    // avgCost: valid only when present, finite, and strictly positive
    const avgCost = (typeof h.avgCost === "number" && Number.isFinite(h.avgCost) && h.avgCost > 0)
      ? h.avgCost : null;
    const unrealizedPnl = avgCost !== null ? (latestPrice - avgCost) * h.lots : null;
    const unrealizedPct = avgCost !== null ? (latestPrice - avgCost) / avgCost : null;
    return {
      ...u,
      px: latestPrice,
      lots: h.lots,
      value,
      quote: quoteBySymbol[h.t] || null,
      companyProfile: profileBySymbol[h.t] || null,
      dataProvider: liveQuote ? "finnhub quote" : realPath ? (historyBySymbol[h.t].provider || "real") : "mock",
      realPath,
      avgCost,
      firstBought: (h.firstBought && typeof h.firstBought === "string") ? h.firstBought : null,
      unrealizedPnl,
      unrealizedPct,
    };
  }).filter(Boolean);

  if (assets.length === 0) return emptyPortfolio(profile, source);

  const totalValue = assets.reduce((s, a) => s + a.value, 0) || 1;
  assets.forEach(a => { a.weight = a.value / totalValue; });

  // price paths + per-asset stats
  const minPathLength = Math.max(2, Math.min(...assets.map(a => (a.realPath || pricePath(a.t, days, seed)).length)));
  assets.forEach(a => {
    const basePath = a.realPath || pricePath(a.t, days, seed);
    a.path = basePath.slice(-minPathLength);
    a.rets = dailyReturns(a.path);
    a.annRet = a.path[a.path.length - 1] / a.path[0] - 1;
    a.annRet = Math.pow(1 + a.annRet, 252 / Math.max(1, a.rets.length)) - 1;
    a.annVol = Math.sqrt(a.rets.reduce((s, x) => s + x * x, 0) / Math.max(1, a.rets.length)) * Math.sqrt(252);
    delete a.realPath;
  });

  // portfolio daily returns (weighted)
  const n = assets[0] ? assets[0].rets.length : 0;
  const portRets = [];
  for (let i = 0; i < n; i++) {
    let r = 0;
    assets.forEach(a => { r += a.weight * a.rets[i]; });
    portRets.push(r);
  }

  // cumulative growth of $1 — portfolio + simplified balanced reference scenario
  // Reference: VTI real history (when proxy available) or VTI mock GBM, scaled by
  // BENCH_EQUITY_SCALAR and BENCH_DAILY_INCOME to approximate 60/40 equity/bond behavior.
  // NOT an actual blended index — BND is not included. See ARCHITECTURE_AUDIT.md Risk 6.
  const cum = [1];
  portRets.forEach(r => cum.push(cum[cum.length - 1] * (1 + r)));
  const benchPath = (historyPath(historyBySymbol.VTI, days) || pricePath("VTI", days, seed + 7)).slice(-minPathLength);
  const benchRets = dailyReturns(benchPath);
  const benchCum = [1];
  benchRets.forEach(r => benchCum.push(benchCum[benchCum.length - 1] * (1 + r * BENCH_EQUITY_SCALAR + BENCH_DAILY_INCOME)));

  // headline stats
  const annRet = Math.pow(cum[cum.length - 1], 252 / portRets.length) - 1;
  // annVol: sqrt(E[r²]) * sqrt(252) — second-moment approx; bias vs true std dev is negligible for near-zero daily mean
  const annVol = Math.sqrt(portRets.reduce((s, x) => s + x * x, 0) / portRets.length) * Math.sqrt(252);
  const rf = Number.isFinite(opts.rf) && opts.rf >= 0 ? opts.rf : 0.043;
  const sharpe = annVol > 0 ? (annRet - rf) / annVol : 0; // guard: flat price paths have annVol=0
  // max drawdown
  let peak = cum[0], mdd = 0;
  cum.forEach(v => { if (v > peak) peak = v; const dd = v / peak - 1; if (dd < mdd) mdd = dd; });

  // rolling 30d volatility (annualized)
  const win = 30;
  const rollVol = [];
  for (let i = win; i < portRets.length; i++) {
    const slice = portRets.slice(i - win, i);
    const m = slice.reduce((s, x) => s + x, 0) / win;
    const v = Math.sqrt(slice.reduce((s, x) => s + (x - m) ** 2, 0) / win) * Math.sqrt(252);
    rollVol.push(v);
  }
  // rolling 63d return & sharpe
  const rwin = 63;
  const rollRet = [], rollSharpe = [];
  for (let i = rwin; i < portRets.length; i++) {
    const slice = portRets.slice(i - rwin, i);
    const tot = slice.reduce((s, x) => s * (1 + x), 1) - 1;
    const m = slice.reduce((s, x) => s + x, 0) / rwin;
    const v = Math.sqrt(slice.reduce((s, x) => s + (x - m) ** 2, 0) / rwin) * Math.sqrt(252);
    rollRet.push(tot * (252 / rwin));
    rollSharpe.push((m * 252 - rf) / (v || 1e-6));
  }

  // risk contribution (approx: weight * vol * avg corr, normalized)
  const rc = assets.map(a => {
    let c = 0;
    assets.forEach(b => { c += b.weight * corr(a.t, b.t); });
    return { t: a.t, raw: a.weight * a.annVol * c };
  });
  const rcTot = rc.reduce((s, x) => s + Math.max(0, x.raw), 0) || 1;
  assets.forEach(a => {
    const f = rc.find(x => x.t === a.t);
    a.riskContrib = Math.max(0, f.raw) / rcTot;
  });

  // concentration (HHI)
  const hhi = assets.reduce((s, a) => s + a.weight * a.weight, 0);

  // optimization targets — perturb weights toward two objectives
  const maxSharpe = optimize(assets, "sharpe", rf);
  const minRisk = optimize(assets, "risk", rf);

  // portfolio-level unrealized P&L — only from holdings that have a valid avgCost
  const assetsWithCostBasis = assets.filter(a => a.avgCost !== null);
  const totalCostBasis = assetsWithCostBasis.length > 0
    ? assetsWithCostBasis.reduce((s, a) => s + a.avgCost * a.lots, 0)
    : null;
  const totalUnrealizedPnl = assetsWithCostBasis.length > 0
    ? assetsWithCostBasis.reduce((s, a) => s + a.unrealizedPnl, 0)
    : null;
  const totalUnrealizedPct = (totalCostBasis !== null && totalCostBasis > 0)
    ? totalUnrealizedPnl / totalCostBasis
    : null;

  // data-derived beta using VTI benchmark returns already computed above
  const beta = calcBeta(portRets, benchRets);

  // empirical CVaR: mean of worst 5% daily returns, scaled to 1-month via sqrt(21)
  // sign: negative (a loss); 0 when <20 observations or empty tail
  let cvar95 = 0;
  if (portRets.length >= 20) {
    const sorted = portRets.slice().sort((a, b) => a - b);
    const k = Math.floor(0.05 * sorted.length);
    if (k >= 1) {
      const tailMean = sorted.slice(0, k).reduce((s, x) => s + x, 0) / k;
      if (Number.isFinite(tailMean)) cvar95 = tailMean * Math.sqrt(21);
    }
  }

  return {
    assets, totalValue, profile, source, days,
    portRets, cum, benchCum,
    annRet, annVol, sharpe, mdd, rf, hhi,
    rollVol, rollRet, rollSharpe,
    maxSharpe, minRisk,
    // 0.72 ≈ downside_std/total_std for near-normal distributions; approximates true Sortino denominator
    sortino: annVol > 0 ? (annRet - rf) / (annVol * 0.72) : 0,
    beta,
    cvar95,
    var95: -1.65 * annVol / Math.sqrt(252) * Math.sqrt(21), // parametric 95% 1M VaR: z=1.65, horizon=21 trading days, normality assumed
    totalCostBasis,
    totalUnrealizedPnl,
    totalUnrealizedPct,
  };
}

// crude optimizer: tilt weights, return target allocation + stats
export function optimize(assets, mode, rf = 0.043) {
  const tgt = assets.map(a => {
    let w = a.weight;
    if (mode === "sharpe") {
      // per-asset Sharpe score; 0.6 = heuristic target threshold, 0.45 = tilt strength
      const score = (a.annRet - rf) / (a.annVol || 1e-6);
      w = Math.max(0.02, a.weight * (1 + (score - 0.6) * 0.45));
    } else { // min risk
      // 0.22 = target annVol ceiling, 1.4 = tilt strength; assets with annVol < 0.22 get upweighted
      w = Math.max(0.02, a.weight * (1 + (0.22 - a.annVol) * 1.4));
    }
    return { t: a.t, w };
  });
  const s = tgt.reduce((x, y) => x + y.w, 0);
  tgt.forEach(x => x.w = x.w / s);
  // approximate resulting stats
  let ret = 0, vol = 0;
  tgt.forEach(x => { const a = assets.find(y => y.t === x.t); ret += x.w * a.annRet; });
  // crude vol via weighted vols + correlation haircut
  tgt.forEach(x => { const a = assets.find(y => y.t === x.t); vol += (x.w * a.annVol) ** 2; });
  tgt.forEach(x => {
    tgt.forEach(y => {
      if (x.t < y.t) {
        const a = assets.find(z => z.t === x.t), b = assets.find(z => z.t === y.t);
        vol += 2 * x.w * y.w * a.annVol * b.annVol * corr(x.t, y.t);
      }
    });
  });
  vol = Math.sqrt(Math.max(vol, 1e-6));
  const sharpe = (ret - rf) / vol;
  return { target: tgt, annRet: ret, annVol: vol, sharpe };
}

// --- Monte Carlo terminal-value simulation ---
export function monteCarlo(annRet, annVol, startValue, years, paths, seed) {
  const steps = years * 252;
  const r = rng(seed);
  const dt = 1 / 252;
  const allTerminal = [];
  // store a handful of representative paths for the fan chart
  const fan = [];
  const samplePaths = 40;
  for (let p = 0; p < paths; p++) {
    let v = startValue;
    const keep = p < samplePaths;
    const path = keep ? [v] : null;
    const stride = Math.max(1, Math.floor(steps / 60));
    for (let i = 1; i <= steps; i++) {
      const drift = (annRet - 0.5 * annVol * annVol) * dt;
      const shock = annVol * Math.sqrt(dt) * gauss(r);
      v *= Math.exp(drift + shock);
      if (keep && i % stride === 0) path.push(v);
    }
    if (keep) fan.push(path);
    allTerminal.push(v);
  }
  allTerminal.sort((a, b) => a - b);
  const pct = q => allTerminal[Math.floor(q * (allTerminal.length - 1))];
  return {
    fan,
    terminal: allTerminal,
    median: pct(0.5),
    p5: pct(0.05), p25: pct(0.25), p75: pct(0.75), p95: pct(0.95),
    mean: allTerminal.reduce((s, x) => s + x, 0) / allTerminal.length,
    probLoss: allTerminal.filter(x => x < startValue).length / allTerminal.length,
  };
}

// stress scenarios (historical-style shocks)
export const STRESS = [
  { name: "2008 Global Financial Crisis", eq: -0.51, bond: 0.06, span: "Oct 2007 – Mar 2009" },
  { name: "2020 COVID Crash",             eq: -0.34, bond: 0.08, span: "Feb – Mar 2020" },
  { name: "2022 Rate Shock",              eq: -0.25, bond: -0.17, span: "Jan – Oct 2022" },
  { name: "2018 Q4 Selloff",              eq: -0.20, bond: 0.02, span: "Oct – Dec 2018" },
  { name: "Rates +100bp (parallel)",      eq: -0.04, bond: -0.07, span: "Hypothetical" },
];

// recent news (Company Data tab mock)
export const NEWS = {
  AAPL: [
    { src: "Reuters",     time: "2h ago",  head: "Apple expands on-device AI features across Mac lineup ahead of WWDC" },
    { src: "Bloomberg",   time: "6h ago",  head: "Services revenue hits record as App Store growth re-accelerates" },
    { src: "CNBC",        time: "1d ago",  head: "Analysts lift price targets citing resilient iPhone demand in China" },
  ],
  NVDA: [
    { src: "Bloomberg",   time: "1h ago",  head: "NVIDIA data-center backlog stretches into next fiscal year, CFO says" },
    { src: "Reuters",     time: "5h ago",  head: "New accelerator architecture unveiled; hyperscaler orders climb" },
    { src: "WSJ",         time: "1d ago",  head: "Supply constraints easing as foundry capacity comes online" },
  ],
};

export const COMPANY = {
  AAPL: { name: "Apple Inc.", ticker: "AAPL", exch: "NASDAQ", ipo: "1980-12-12", country: "US", currency: "USD",
    industry: "Technology Hardware", mktcap: 3512, shares: 15120, web: "apple.com", emp: "164,000" },
  NVDA: { name: "NVIDIA Corp.", ticker: "NVDA", exch: "NASDAQ", ipo: "1999-01-22", country: "US", currency: "USD",
    industry: "Semiconductors", mktcap: 3390, shares: 24500, web: "nvidia.com", emp: "29,600" },
};

// glossary for risk explanations
export const GLOSSARY = [
  { term: "Annualized Volatility", def: "Standard deviation of daily returns scaled to a one-year horizon (×√252). A proxy for total risk." },
  { term: "Sharpe Ratio", def: "Excess return over the risk-free rate per unit of total volatility. Higher is better risk-adjusted performance." },
  { term: "Max Drawdown", def: "The largest peak-to-trough decline in cumulative value over the sample. Measures downside severity." },
  { term: "Beta", def: "Sensitivity of portfolio returns to the VTI benchmark. Computed as cov(portRets, benchRets) / var(benchRets). Fallback 1.0 when benchmark data is insufficient or has zero variance." },
  { term: "VaR (95%, 1M)", def: "Loss not expected to be exceeded over one month with 95% confidence, under a normal approximation." },
  { term: "Concentration (HHI)", def: "Herfindahl index of weights. Higher values indicate fewer, larger positions and less diversification." },
  { term: "Risk Contribution", def: "Each holding's share of total portfolio variance, accounting for weight, volatility, and correlation." },
];
