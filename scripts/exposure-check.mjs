/**
 * exposure-check.mjs — verifies the pure exposure aggregation in src/exposure.js.
 *
 * Descriptive composition only: sector and asset-class breakdowns of existing
 * holdings. No advice, recommendations, or target allocations are involved.
 *
 * Pure-function tests — no DOM, no network, deterministic.
 */

import {
  sectorExposure,
  classExposure,
  computeExposure,
  sectorKey,
  classKey,
  UNKNOWN_LABEL,
  EXTENDED_LABEL,
} from "../src/exposure.js";

let passed = 0;
const fail = msg => { throw new Error("exposure-check FAILED: " + msg); };
const ok = msg => { passed++; if (process.env.VERBOSE) console.log("  ✓ " + msg); };
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── 1. Empty holdings → empty arrays (no fabricated data) ──────────────────
{
  if (sectorExposure([]).length !== 0) fail("empty holdings must yield empty sector exposure");
  if (classExposure([]).length !== 0) fail("empty holdings must yield empty class exposure");
  const both = computeExposure([]);
  if (both.sector.length !== 0 || both.assetClass.length !== 0) fail("computeExposure([]) must be empty");
  if (sectorExposure(null).length !== 0 || sectorExposure(undefined).length !== 0) fail("non-array input must be safe");
  ok("empty / invalid input returns empty arrays");
}

// ── Shared fixture: a small known portfolio ────────────────────────────────
const assets = [
  { t: "AAPL", value: 4000, sector: "Technology", cls: "Equity" },
  { t: "MSFT", value: 2000, sector: "Technology", cls: "Equity" },
  { t: "JPM",  value: 1000, sector: "Financials", cls: "Equity" },
  { t: "VTI",  value: 3000, sector: "US Broad Market", cls: "ETF" },
];
const TOTAL = 10000;

// ── 2. Sector aggregation correctness ──────────────────────────────────────
{
  const rows = sectorExposure(assets);
  const tech = rows.find(r => r.key === "Technology");
  const fin = rows.find(r => r.key === "Financials");
  const broad = rows.find(r => r.key === "US Broad Market");
  if (!tech || !fin || !broad) fail("expected three sector buckets");
  if (tech.value !== 6000) fail("Technology value should be 6000, got " + tech.value);
  if (tech.count !== 2) fail("Technology count should be 2, got " + tech.count);
  if (!approx(tech.weight, 0.6)) fail("Technology weight should be 0.6, got " + tech.weight);
  if (JSON.stringify(tech.tickers) !== JSON.stringify(["AAPL", "MSFT"])) fail("Technology tickers should be sorted [AAPL, MSFT]");
  if (fin.value !== 1000 || broad.value !== 3000) fail("Financials/Broad values wrong");
  ok("sector aggregation (value, weight, count, tickers) correct");
}

// ── 3. Asset-class aggregation correctness ─────────────────────────────────
{
  const rows = classExposure(assets);
  const eq = rows.find(r => r.key === "Equity");
  const etf = rows.find(r => r.key === "ETF");
  if (!eq || !etf) fail("expected Equity and ETF buckets");
  if (eq.value !== 7000 || eq.count !== 3) fail("Equity should be 7000 / 3 holdings");
  if (etf.value !== 3000 || etf.count !== 1) fail("ETF should be 3000 / 1 holding");
  ok("asset-class aggregation correct");
}

// ── 4. Missing metadata falls back to Unknown ──────────────────────────────
{
  const a = [
    { t: "AAA", value: 500 },                        // no sector, no cls
    { t: "BBB", value: 500, sector: "   ", cls: "" }, // blank → Unknown
  ];
  const s = sectorExposure(a);
  const c = classExposure(a);
  if (s.length !== 1 || s[0].key !== UNKNOWN_LABEL || s[0].count !== 2) fail("missing sector must bucket as Unknown");
  if (c.length !== 1 || c[0].key !== UNKNOWN_LABEL || c[0].count !== 2) fail("missing class must bucket as Unknown");
  if (sectorKey({}) !== UNKNOWN_LABEL || classKey({}) !== UNKNOWN_LABEL) fail("keys must default to Unknown");
  ok("missing metadata falls back to Unknown");
}

// ── 5. Extended tickers bucket as Extended ─────────────────────────────────
{
  const a = [
    { t: "WMT", value: 1000, sector: "Extended", extended: true, cls: "Equity" },
    { t: "ZZZ", value: 1000, extended: true, cls: "Equity" },
  ];
  const s = sectorExposure(a);
  if (s.length !== 1 || s[0].key !== EXTENDED_LABEL || s[0].count !== 2) fail("extended tickers must bucket as Extended");
  if (sectorKey({ extended: true }) !== EXTENDED_LABEL) fail("extended flag must yield Extended");
  ok("extended tickers bucket as Extended");
}

// ── 6. Weights sum to ~100% for non-empty portfolios ───────────────────────
{
  for (const rows of [sectorExposure(assets), classExposure(assets)]) {
    const sum = rows.reduce((s, r) => s + r.weight, 0);
    if (!approx(sum, 1, 1e-9)) fail("weights must sum to ~1, got " + sum);
  }
  // zero-value safety: should not throw / divide-by-zero
  const z = sectorExposure([{ t: "X", value: 0, sector: "Technology" }]);
  if (z.length !== 1 || !approx(z[0].weight, 0)) fail("zero-value portfolio must be weight 0, no NaN");
  ok("weights sum to ~100% (and zero-value is safe)");
}

// ── 7. Deterministic sorting: desc weight, then alpha label ────────────────
{
  const a = [
    { t: "B1", value: 100, sector: "Beta" },
    { t: "A1", value: 100, sector: "Alpha" }, // tie with Beta on weight → Alpha first
    { t: "C1", value: 300, sector: "Gamma" }, // largest → first
  ];
  const rows = sectorExposure(a);
  const order = rows.map(r => r.key);
  if (JSON.stringify(order) !== JSON.stringify(["Gamma", "Alpha", "Beta"])) {
    fail("sort must be desc weight then alpha, got " + JSON.stringify(order));
  }
  ok("sorting is deterministic (desc weight, alpha tie-break)");
}

// ── 8. Inputs are not mutated ──────────────────────────────────────────────
{
  const a = [{ t: "AAPL", value: 4000, sector: "Technology", cls: "Equity" }];
  const snapshot = JSON.stringify(a);
  sectorExposure(a);
  classExposure(a);
  computeExposure(a);
  if (JSON.stringify(a) !== snapshot) fail("input holdings must not be mutated");
  ok("input holdings are not mutated");
}

console.log(`exposure checks passed (${passed} assertions)`);
