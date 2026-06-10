import { createMarketDataAdapter, calcDownsideDev } from "../src/data.js";

const fail = message => { throw new Error(message); };

const adapter = createMarketDataAdapter("mock");

// Build a controlled price path for testing (linear interpolation between two prices)
function linearHistory(startPrice, endPrice, n) {
  const candles = Array.from({ length: n }, (_, i) => {
    const p = startPrice + (endPrice - startPrice) * i / Math.max(n - 1, 1);
    return { date: `2024-01-${String(i + 1).padStart(2, "0")}`, close: p, adjClose: p };
  });
  return { provider: "yahoo", candles };
}

// 1. All headline metrics finite for a normal multi-asset mock portfolio
{
  const p = adapter.buildPortfolio(
    [{ t: "AAPL", lots: 10 }, { t: "BND", lots: 50 }, { t: "VTI", lots: 20 }],
    { days: 252, profile: "balanced" },
  );
  for (const k of ["annRet", "annVol", "sharpe", "sortino", "mdd", "beta", "var95", "hhi"]) {
    if (!Number.isFinite(p[k])) fail(`Normal portfolio: ${k} must be finite, got ${p[k]}`);
  }
  if (!Number.isFinite(p.maxSharpe.annRet) || !Number.isFinite(p.maxSharpe.annVol) || !Number.isFinite(p.maxSharpe.sharpe)) {
    fail("maxSharpe optimizer stats must be finite");
  }
  if (!Number.isFinite(p.minRisk.annRet) || !Number.isFinite(p.minRisk.annVol) || !Number.isFinite(p.minRisk.sharpe)) {
    fail("minRisk optimizer stats must be finite");
  }
}

// 2. Single-asset portfolio — all metrics finite; optimizer keeps 100% weight
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 100 }], { days: 252 });
  for (const k of ["annRet", "annVol", "sharpe", "sortino", "mdd", "beta", "var95"]) {
    if (!Number.isFinite(p[k])) fail(`Single-asset: ${k} must be finite, got ${p[k]}`);
  }
  if (p.maxSharpe.target.length !== 1) fail("Single-asset maxSharpe.target should have exactly 1 entry");
  if (Math.abs(p.maxSharpe.target[0].w - 1.0) > 1e-9) {
    fail(`Single-asset optimizer must hold 100% weight; got ${p.maxSharpe.target[0].w}`);
  }
}

// 3. Negative-return scenario: declining price path → negative annRet and mdd
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], {
    days: 29, source: "real",
    historyBySymbol: { AAPL: linearHistory(120, 90, 30) },
    quoteBySymbol: {}, profileBySymbol: {},
  });
  if (!Number.isFinite(p.annRet)) fail("Negative-return: annRet must be finite");
  if (p.annRet >= 0) fail("Declining price path should produce negative annRet");
  if (p.mdd >= 0) fail("Declining price path should produce negative mdd");
  if (!Number.isFinite(p.sharpe)) fail("Negative-return: sharpe must be finite (may be negative)");
  if (!Number.isFinite(p.sortino)) fail("Negative-return: sortino must be finite (may be negative)");
}

// 4. Max drawdown bounded in (-1, 0]
{
  const p = adapter.buildPortfolio([{ t: "NVDA", lots: 10 }], { days: 252 });
  if (p.mdd > 0) fail(`mdd must be ≤ 0, got ${p.mdd}`);
  if (p.mdd < -1) fail(`mdd must be > -1 (total loss is the floor), got ${p.mdd}`);
}

// 5. VaR (var95) is negative for positive-vol portfolio
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252 });
  if (p.annVol > 0 && p.var95 >= 0) fail(`var95 must be negative for positive-vol portfolio, got ${p.var95}`);
}

// 6. Sortino > Sharpe when annRet > rf (smaller denominator gives larger ratio for positive excess return)
{
  const p = adapter.buildPortfolio([{ t: "NVDA", lots: 10 }], { days: 252, rf: 0.001 });
  if (p.annRet > p.rf) {
    if (p.sortino <= p.sharpe) {
      fail(`When annRet > rf, Sortino must exceed Sharpe (Sortino=${p.sortino.toFixed(3)}, Sharpe=${p.sharpe.toFixed(3)})`);
    }
  }
}

// 7. Sortino < Sharpe when annRet < rf
// rf=2.0 (200%) guarantees annRet < rf for any realistic equity mock.
// GBM mock produces mixed positive/negative daily returns, so downsideDev < annVol
// strictly, making Sortino more negative than Sharpe.
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252, rf: 2.0 });
  if (p.annRet < p.rf && p.sortino >= p.sharpe) {
    fail(`When annRet < rf, Sortino must be less than Sharpe (Sortino=${p.sortino.toFixed(3)}, Sharpe=${p.sharpe.toFixed(3)})`);
  }
}

// 8. Zero-vol guard: flat price path must not produce NaN or Infinity in any metric
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], {
    days: 9, source: "real",
    historyBySymbol: { AAPL: linearHistory(100, 100, 10) },
    quoteBySymbol: {}, profileBySymbol: {},
  });
  if (p.annVol !== 0) fail(`Zero-vol test setup: expected annVol=0, got ${p.annVol}`);
  if (!Number.isFinite(p.sharpe)) fail(`Zero-vol guard: sharpe must be finite, got ${p.sharpe}`);
  if (!Number.isFinite(p.sortino)) fail(`Zero-vol guard: sortino must be finite, got ${p.sortino}`);
  if (!Number.isFinite(p.beta)) fail(`Zero-vol guard: beta must be finite, got ${p.beta}`);
  if (!Number.isFinite(p.var95)) fail(`Zero-vol guard: var95 must be finite, got ${p.var95}`);
}

// 9. Optimizer weights sum to 1.0 and respect the 0.02 floor
{
  const p = adapter.buildPortfolio(
    [{ t: "AAPL", lots: 10 }, { t: "MSFT", lots: 10 }, { t: "BND", lots: 50 }, { t: "TLT", lots: 20 }],
    { days: 252 },
  );
  for (const [label, opt] of [["maxSharpe", p.maxSharpe], ["minRisk", p.minRisk]]) {
    const sum = opt.target.reduce((s, x) => s + x.w, 0);
    if (Math.abs(sum - 1.0) > 1e-9) fail(`${label} weights must sum to 1.0, got ${sum}`);
    for (const { t, w } of opt.target) {
      if (w < 0.02 - 1e-9) fail(`${label} weight for ${t} must be ≥ 0.02, got ${w}`);
    }
  }
}

// 10. Rolling metric array lengths and value validity
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252 });
  const n = p.portRets.length;
  if (n > 30 && p.rollVol.length !== n - 30) {
    fail(`rollVol length: expected ${n - 30}, got ${p.rollVol.length}`);
  }
  if (n > 63 && p.rollSharpe.length !== n - 63) {
    fail(`rollSharpe length: expected ${n - 63}, got ${p.rollSharpe.length}`);
  }
  if (p.rollVol.some(v => !Number.isFinite(v) || v < 0)) {
    fail("rollVol must contain non-negative finite values");
  }
  if (p.rollSharpe.some(v => !Number.isFinite(v))) {
    fail("rollSharpe must contain finite values");
  }
}

// 11. benchCum starts at 1 and stays finite
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252 });
  if (p.benchCum[0] !== 1) fail(`benchCum must start at 1.00, got ${p.benchCum[0]}`);
  if (!Number.isFinite(p.benchCum[p.benchCum.length - 1])) {
    fail("benchCum terminal value must be finite");
  }
}

// 12. Beta is data-derived, not the old Sharpe-based approximation
{
  const p = adapter.buildPortfolio(
    [{ t: "AAPL", lots: 10 }, { t: "BND", lots: 20 }],
    { days: 252, rf: 0.043 },
  );
  if (!Number.isFinite(p.beta)) fail(`Beta must be finite, got ${p.beta}`);
  const oldSyntheticBeta = 0.94 + (p.sharpe - 1) * 0.02;
  if (Math.abs(p.beta - oldSyntheticBeta) < 1e-9) {
    fail("Beta should be data-derived (cov/var), not the old Sharpe-based approximation");
  }
}

// 13. Beta fallback to 1.0 when benchmark has zero variance (flat VTI price path)
{
  const historyBySymbol = {
    AAPL: linearHistory(100, 130, 30),
    VTI:  linearHistory(200, 200, 30), // flat VTI — zero benchmark variance
  };
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], {
    days: 29, source: "real", historyBySymbol, quoteBySymbol: {}, profileBySymbol: {},
  });
  if (p.beta !== 1.0) fail(`Flat benchmark should give beta=1.0 fallback, got ${p.beta}`);
}

// 14. CVaR is finite, negative, and at least as conservative as VaR for a positive-vol portfolio
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252 });
  if (!Number.isFinite(p.cvar95)) fail(`cvar95 must be finite, got ${p.cvar95}`);
  if (p.annVol > 0 && p.cvar95 >= 0) {
    fail(`cvar95 must be negative for positive-vol portfolio, got ${p.cvar95}`);
  }
  if (p.cvar95 > p.var95) {
    fail(`cvar95 must be ≤ var95 (CVaR ≥ VaR in magnitude); cvar95=${p.cvar95.toFixed(4)}, var95=${p.var95.toFixed(4)}`);
  }
}

// 15. Zero-vol / short-history guard: flat or short price path → cvar95 = 0
{
  const pShort = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], {
    days: 9, source: "real",
    historyBySymbol: { AAPL: linearHistory(100, 100, 10) },
    quoteBySymbol: {}, profileBySymbol: {},
  });
  if (!Number.isFinite(pShort.cvar95)) fail(`Short-history: cvar95 must be finite, got ${pShort.cvar95}`);
  if (pShort.cvar95 !== 0) {
    fail(`Short-history (<20 returns): cvar95 should be 0, got ${pShort.cvar95}`);
  }
}

// 16. Sortino uses true downside deviation, not the old 0.72 approximation
{
  const p = adapter.buildPortfolio([{ t: "NVDA", lots: 10 }], { days: 252, rf: 0.043 });
  const oldApproxSortino = p.annVol > 0 ? (p.annRet - p.rf) / (p.annVol * 0.72) : 0;
  if (Math.abs(p.sortino - oldApproxSortino) < 1e-9) {
    fail("Sortino should use true downside deviation, not the 0.72 approximation");
  }
  if (!Number.isFinite(p.sortino)) fail(`Sortino must be finite, got ${p.sortino}`);
}

// 17. No-downside guard: monotonically rising path → all returns ≥ 0 → downsideDev = 0 → sortino = 0
{
  const p = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], {
    days: 9, source: "real",
    historyBySymbol: { AAPL: linearHistory(100, 130, 10) },
    quoteBySymbol: {}, profileBySymbol: {},
  });
  if (p.sortino !== 0) {
    fail(`All-positive returns (no downside) should produce sortino=0, got ${p.sortino}`);
  }
}

// 18–20. calcDownsideDev helper unit tests
{
  const dd1 = calcDownsideDev([0.01, -0.02, 0.03, -0.01]);
  if (!Number.isFinite(dd1) || dd1 <= 0) {
    fail(`calcDownsideDev with mixed returns should be finite and positive, got ${dd1}`);
  }
  const dd2 = calcDownsideDev([0.01, 0.02, 0.03]);
  if (dd2 !== 0) {
    fail(`calcDownsideDev with all-positive returns should return 0, got ${dd2}`);
  }
  const dd3 = calcDownsideDev([]);
  if (dd3 !== 0) {
    fail(`calcDownsideDev([]) should return 0, got ${dd3}`);
  }
}

// 21. Explicit benchmark option — different tickers produce different benchCum; p.benchmark is returned
{
  const pVTI = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252, benchmark: "VTI" });
  const pQQQ = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252, benchmark: "QQQ" });
  const termVTI = pVTI.benchCum[pVTI.benchCum.length - 1];
  const termQQQ = pQQQ.benchCum[pQQQ.benchCum.length - 1];
  if (!Number.isFinite(termVTI)) fail(`VTI benchmark: terminal benchCum must be finite, got ${termVTI}`);
  if (!Number.isFinite(termQQQ)) fail(`QQQ benchmark: terminal benchCum must be finite, got ${termQQQ}`);
  if (Math.abs(termVTI - termQQQ) < 1e-6) {
    fail(`VTI and QQQ benchmarks must produce different terminal benchCum values (got both ≈ ${termVTI.toFixed(4)})`);
  }
  if (pVTI.benchmark !== "VTI") fail(`p.benchmark must equal "VTI" when opt is "VTI", got ${pVTI.benchmark}`);
  if (pQQQ.benchmark !== "QQQ") fail(`p.benchmark must equal "QQQ" when opt is "QQQ", got ${pQQQ.benchmark}`);
}

console.log("Metrics checks passed");
