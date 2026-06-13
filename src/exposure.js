/* ============================================================
   src/exposure.js — pure portfolio composition aggregation.

   DESCRIPTIVE ONLY. This module summarizes the user's existing
   holdings by sector and by asset/instrument class. It does NOT
   produce advice, recommendations, target allocations, signals,
   or any judgement about what the portfolio "should" be.

   Pure functions: no mutation of inputs, no I/O, no globals.
   Node-importable (plain JS) — verified by scripts/exposure-check.mjs.
   ============================================================ */

export const UNKNOWN_LABEL = "Unknown";
export const EXTENDED_LABEL = "Extended";

// Sector bucket for one asset-like object.
// Extended (out-of-universe) instruments are grouped under "Extended";
// missing/blank sector falls back to "Unknown".
export function sectorKey(a) {
  if (a && a.extended) return EXTENDED_LABEL;
  const s = a && typeof a.sector === "string" ? a.sector.trim() : "";
  if (!s) return UNKNOWN_LABEL;
  return s === EXTENDED_LABEL ? EXTENDED_LABEL : s;
}

// Asset / instrument class bucket for one asset-like object.
// Missing/blank class falls back to "Unknown".
export function classKey(a) {
  const c = a && typeof a.cls === "string" ? a.cls.trim() : "";
  return c || UNKNOWN_LABEL;
}

// Group assets by a key function into deterministic exposure rows.
// Each row: { key, label, value, weight, count, tickers }
//   value  — summed market value of the bucket
//   weight — bucket value / total portfolio value (0..1)
//   count  — number of holdings in the bucket
//   tickers— sorted constituent tickers
// Sorted by descending weight, then alphabetical label as tie-breaker.
function aggregate(assets, keyOf) {
  if (!Array.isArray(assets) || assets.length === 0) return [];

  const total = assets.reduce((s, a) => s + (Number(a && a.value) || 0), 0);
  const denom = total > 0 ? total : 1;

  const groups = new Map();
  for (const a of assets) {
    const key = keyOf(a);
    const value = Number(a && a.value) || 0;
    let g = groups.get(key);
    if (!g) { g = { key, label: key, value: 0, count: 0, tickers: [] }; groups.set(key, g); }
    g.value += value;
    g.count += 1;
    if (a && typeof a.t === "string" && a.t) g.tickers.push(a.t);
  }

  const rows = [];
  for (const g of groups.values()) {
    rows.push({
      key: g.key,
      label: g.label,
      value: g.value,
      weight: g.value / denom,
      count: g.count,
      tickers: g.tickers.slice().sort(),
    });
  }
  rows.sort((a, b) => (b.weight - a.weight) || a.label.localeCompare(b.label));
  return rows;
}

export function sectorExposure(assets) { return aggregate(assets, sectorKey); }
export function classExposure(assets) { return aggregate(assets, classKey); }

// Convenience: both breakdowns at once.
export function computeExposure(assets) {
  return {
    sector: sectorExposure(assets),
    assetClass: classExposure(assets),
  };
}
