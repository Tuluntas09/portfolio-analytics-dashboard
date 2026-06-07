/**
 * csv-check.mjs — tests for src/holdingsCsv.js (Phase 8a).
 *
 * Runs in Node.js. Imports pure functions only (no DOM required).
 */

import { parseHoldingsCsv, serializeHoldingsCsv, CSV_HEADER } from "../src/holdingsCsv.js";

const fail = msg => { throw new Error(msg); };

let passed = 0;
function pass(label) { passed++; console.log("  ✓", label); }

// Supported tickers for test isolation (subset of UNIVERSE).
const TICKERS = new Set(["AAPL", "MSFT", "NVDA", "VTI", "BND", "AMZN", "GOOGL", "BRK.B"]);

// ── 1. Import without header ──────────────────────────────────────────────────
{
  const csv = "AAPL,10\nMSFT,5";
  const { holdings, importedCount, invalidRows, unsupportedTickers } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`Expected 2 imported, got ${importedCount}`);
  if (invalidRows !== 0) fail(`Expected 0 invalid rows, got ${invalidRows}`);
  if (unsupportedTickers.length !== 0) fail(`Expected no unsupported tickers`);
  const aapl = holdings.find(h => h.t === "AAPL");
  const msft = holdings.find(h => h.t === "MSFT");
  if (!aapl || aapl.lots !== 10) fail(`AAPL lots should be 10, got ${aapl?.lots}`);
  if (!msft || msft.lots !== 5) fail(`MSFT lots should be 5, got ${msft?.lots}`);
  pass("import without header: 2 holdings parsed");
}

// ── 2. Import with header ─────────────────────────────────────────────────────
{
  const csv = "ticker,lots\nAAPL,10\nMSFT,5";
  const { holdings, importedCount, invalidRows } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`Expected 2 imported (header skipped), got ${importedCount}`);
  if (invalidRows !== 0) fail(`Header row must not count as invalid, got ${invalidRows}`);
  pass("import with header: header skipped, 2 holdings parsed");
}

// ── 3. Ticker normalization (lowercase → uppercase) ───────────────────────────
{
  const csv = "aapl,10\nmsft,5";
  const { holdings, importedCount } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`Expected 2 after normalization, got ${importedCount}`);
  if (holdings[0].t !== "AAPL") fail(`Expected "AAPL", got "${holdings[0].t}"`);
  if (holdings[1].t !== "MSFT") fail(`Expected "MSFT", got "${holdings[1].t}"`);
  pass("ticker normalization: lowercase input → uppercase holdings");
}

// ── 4. Positive decimal lots ──────────────────────────────────────────────────
{
  const csv = "NVDA,2.5\nBND,100.75";
  const { holdings, importedCount } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`Expected 2, got ${importedCount}`);
  if (holdings[0].lots !== 2.5) fail(`Expected 2.5, got ${holdings[0].lots}`);
  if (holdings[1].lots !== 100.75) fail(`Expected 100.75, got ${holdings[1].lots}`);
  pass("positive decimal lots accepted");
}

// ── 5. Duplicate ticker aggregation ──────────────────────────────────────────
{
  const csv = "AAPL,5\nAAPL,3\nMSFT,10\nAAPL,2";
  const { holdings, importedCount } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`Expected 2 unique holdings, got ${importedCount}`);
  const aapl = holdings.find(h => h.t === "AAPL");
  if (!aapl) fail("AAPL missing from aggregated result");
  if (aapl.lots !== 10) fail(`AAPL lots should be 5+3+2=10, got ${aapl.lots}`);
  pass("duplicate tickers aggregated: AAPL 5+3+2=10");
}

// ── 6. Unsupported ticker warning ─────────────────────────────────────────────
{
  const csv = "AAPL,10\nTSLA,5\nSPY,3\nMSFT,8";
  const { importedCount, unsupportedTickers, invalidRows } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`Expected 2 valid holdings, got ${importedCount}`);
  if (unsupportedTickers.length !== 2) fail(`Expected 2 unsupported, got ${unsupportedTickers.length}`);
  if (!unsupportedTickers.includes("TSLA")) fail("TSLA should be in unsupportedTickers");
  if (!unsupportedTickers.includes("SPY")) fail("SPY should be in unsupportedTickers");
  if (invalidRows !== 0) fail(`Unsupported rows must not count as invalid, got ${invalidRows}`);
  pass("unsupported tickers reported separately, valid rows still imported");
}

// ── 7. Invalid lots rejection ─────────────────────────────────────────────────
{
  const csv = [
    "AAPL,0",       // zero
    "MSFT,-5",      // negative
    "NVDA,abc",     // non-numeric
    "VTI,",         // empty
    "BND,Infinity", // Infinity
    "AMZN,10",      // valid — should be the only imported row
  ].join("\n");
  const { importedCount, invalidRows } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 1) fail(`Expected 1 valid row (AMZN), got ${importedCount}`);
  if (invalidRows !== 5) fail(`Expected 5 invalid rows, got ${invalidRows}`);
  pass("invalid lots rejected: zero, negative, non-numeric, empty, Infinity");
}

// ── 8. Empty file / no valid rows ─────────────────────────────────────────────
{
  const { importedCount: c1 } = parseHoldingsCsv("", TICKERS);
  if (c1 !== 0) fail(`Empty string: expected 0, got ${c1}`);
  pass("empty string: importedCount is 0");

  const { importedCount: c2 } = parseHoldingsCsv("\n\n   \n", TICKERS);
  if (c2 !== 0) fail(`Whitespace-only: expected 0, got ${c2}`);
  pass("whitespace-only: importedCount is 0");

  const { importedCount: c3, unsupportedTickers } = parseHoldingsCsv("TSLA,10\nXYZ,5", TICKERS);
  if (c3 !== 0) fail(`All unsupported: expected 0 imported, got ${c3}`);
  if (unsupportedTickers.length !== 2) fail(`Expected 2 unsupported, got ${unsupportedTickers.length}`);
  pass("all unsupported tickers: importedCount is 0");
}

// ── 9. Export format includes header row ──────────────────────────────────────
{
  const holdings = [{ t: "AAPL", lots: 10 }, { t: "MSFT", lots: 5 }];
  const csv = serializeHoldingsCsv(holdings);
  const lines = csv.split("\n");
  if (lines[0] !== CSV_HEADER) fail(`First line must be "${CSV_HEADER}", got "${lines[0]}"`);
  if (lines[1] !== "AAPL,10") fail(`Second line must be "AAPL,10", got "${lines[1]}"`);
  if (lines[2] !== "MSFT,5") fail(`Third line must be "MSFT,5", got "${lines[2]}"`);
  if (lines.length !== 3) fail(`Expected 3 lines, got ${lines.length}`);
  pass("export includes header row, correct format");
}

// ── 10. Export excludes non-holdings data ─────────────────────────────────────
{
  // Simulate holdings array mixed with extra fields (shouldn't appear in output)
  const holdings = [
    { t: "AAPL", lots: 10, px: 232.18, weight: 0.45, value: 23218 },
    { t: "MSFT", lots: 5, annRet: 0.15, sharpe: 1.2 },
  ];
  const csv = serializeHoldingsCsv(holdings);
  const forbidden = ["px", "weight", "value", "annRet", "sharpe"];
  for (const field of forbidden) {
    if (csv.includes(field)) fail(`Export must not include field "${field}"`);
  }
  // Only ticker and lots in the data rows
  if (!csv.includes("AAPL,10")) fail("AAPL,10 not found in export");
  if (!csv.includes("MSFT,5")) fail("MSFT,5 not found in export");
  pass("export excludes prices, weights, metrics — only ticker,lots");
}

// ── 11. CRLF tolerance ────────────────────────────────────────────────────────
{
  const csv = "ticker,lots\r\nAAPL,10\r\nMSFT,5\r\n";
  const { importedCount } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`CRLF line endings: expected 2, got ${importedCount}`);
  pass("CRLF line endings handled correctly");
}

// ── 12. Extra columns are ignored ─────────────────────────────────────────────
{
  const csv = "AAPL,10,extra,columns\nMSFT,5,more,data";
  const { importedCount } = parseHoldingsCsv(csv, TICKERS);
  if (importedCount !== 2) fail(`Extra columns: expected 2, got ${importedCount}`);
  pass("extra CSV columns are ignored");
}

// ── 13. Ticker with dot (BRK.B) ───────────────────────────────────────────────
{
  const csv = "BRK.B,50\nbrk.b,20";
  const { holdings, importedCount } = parseHoldingsCsv(csv, TICKERS);
  // BRK.B appears twice → aggregated to 70
  if (importedCount !== 1) fail(`Expected 1 holding (BRK.B aggregated), got ${importedCount}`);
  if (holdings[0].lots !== 70) fail(`BRK.B lots should be 50+20=70, got ${holdings[0].lots}`);
  pass("ticker with dot (BRK.B) normalized and aggregated");
}

// ── done ──────────────────────────────────────────────────────────────────────
console.log(`\ncsv checks: ${passed} passed`);
