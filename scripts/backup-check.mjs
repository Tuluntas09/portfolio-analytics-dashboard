#!/usr/bin/env node
/**
 * scripts/backup-check.mjs — Phase 9b test suite for portfolioBackup.js
 * Run: node scripts/backup-check.mjs
 */

import { exportBackup, importBackup, makeBackupFilename, BACKUP_VERSION } from "../src/portfolioBackup.js";
import { readFileSync } from "fs";

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function assertEq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}  actual=${JSON.stringify(actual)}  expected=${JSON.stringify(expected)}`);
    failed++;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

const ALL_TICKERS = new Set(["AAPL", "MSFT", "GOOGL", "BRK.B", "SPY", "QQQ", "BTC-USD", "ETH-USD"]);
const validSet = { has: t => ALL_TICKERS.has(t) };

function makeHolding(t, lots, extra = {}) {
  return { t, lots, ...extra };
}

function makeAssumptions(overrides = {}) {
  return { rf: 0.043, horizon: 5, paths: 2000, ...overrides };
}

function roundTrip(holdings, assumptions, notes, savedPortfolios) {
  const payload = exportBackup(holdings, assumptions, notes, savedPortfolios);
  return importBackup(payload, validSet);
}

// ── BACKUP_VERSION ────────────────────────────────────────────────────────────
console.log("\n=== BACKUP_VERSION ===");
assert("BACKUP_VERSION is 1", BACKUP_VERSION === 1);

// ── makeBackupFilename ────────────────────────────────────────────────────────
console.log("\n=== makeBackupFilename ===");
const fname = makeBackupFilename();
assert("returns a string", typeof fname === "string");
assert("starts with portfolio-backup-", fname.startsWith("portfolio-backup-"));
assert("ends with .json", fname.endsWith(".json"));
assert("matches date pattern", /^portfolio-backup-\d{4}-\d{2}-\d{2}\.json$/.test(fname));

// ── exportBackup ──────────────────────────────────────────────────────────────
console.log("\n=== exportBackup — structure ===");
const h1 = [makeHolding("AAPL", 10), makeHolding("MSFT", 5, { avgCost: 300, firstBought: "2023-01-15" })];
const asmp = makeAssumptions();
const payload = exportBackup(h1, asmp, "notes text", []);

assert("backupVersion === 1", payload.backupVersion === 1);
assert("exportedAt is a string", typeof payload.exportedAt === "string");
assert("exportedAt is ISO-like", /^\d{4}-\d{2}-\d{2}T/.test(payload.exportedAt));
assert("current.holdings is array", Array.isArray(payload.current.holdings));
assert("current.holdings has 2 entries", payload.current.holdings.length === 2);
assert("assumptions.rf preserved", payload.current.assumptions.rf === 0.043);
assert("assumptions.horizon preserved", payload.current.assumptions.horizon === 5);
assert("assumptions.paths preserved", payload.current.assumptions.paths === 2000);
assert("notes preserved", payload.current.notes === "notes text");
assert("savedPortfolios is array", Array.isArray(payload.savedPortfolios));

console.log("\n=== exportBackup — holdings fields ===");
const h0 = payload.current.holdings[0];
const h1e = payload.current.holdings[1];
assert("AAPL: t", h0.t === "AAPL");
assert("AAPL: lots", h0.lots === 10);
assert("AAPL: no avgCost when absent", !("avgCost" in h0));
assert("AAPL: no firstBought when absent", !("firstBought" in h0));
assert("MSFT: avgCost included", h1e.avgCost === 300);
assert("MSFT: firstBought included", h1e.firstBought === "2023-01-15");

console.log("\n=== exportBackup — notes capped at 500 chars ===");
const longNote = "x".repeat(600);
const pLong = exportBackup(h1, asmp, longNote, []);
assert("notes capped at 500", pLong.current.notes.length === 500);

console.log("\n=== exportBackup — invalid avgCost/firstBought not emitted ===");
const hBad = [makeHolding("AAPL", 10, { avgCost: -50, firstBought: "not-a-date" })];
const pBad = exportBackup(hBad, asmp, "", []);
assert("negative avgCost omitted", !("avgCost" in pBad.current.holdings[0]));
assert("bad firstBought omitted", !("firstBought" in pBad.current.holdings[0]));

console.log("\n=== exportBackup — empty holdings array ===");
const pEmpty = exportBackup([], asmp, "", []);
assert("empty holdings array", pEmpty.current.holdings.length === 0);

console.log("\n=== exportBackup — non-array holdings fallback ===");
const pNull = exportBackup(null, asmp, "", []);
assert("null holdings → empty array", Array.isArray(pNull.current.holdings) && pNull.current.holdings.length === 0);

// ── importBackup — validation ─────────────────────────────────────────────────
console.log("\n=== importBackup — null/array/non-object ===");
assertEq("null → invalid_format", importBackup(null, validSet).error, "invalid_format");
assertEq("array → invalid_format", importBackup([], validSet).error, "invalid_format");
assertEq("string → invalid_format", importBackup("hello", validSet).error, "invalid_format");

console.log("\n=== importBackup — wrong backupVersion ===");
assertEq("version 0 → unsupported_version", importBackup({ backupVersion: 0 }, validSet).error, "unsupported_version");
assertEq("version 2 → unsupported_version", importBackup({ backupVersion: 2 }, validSet).error, "unsupported_version");
assertEq("missing version → unsupported_version", importBackup({}, validSet).error, "unsupported_version");

console.log("\n=== importBackup — missing/invalid current ===");
assertEq("no current → invalid_format",
  importBackup({ backupVersion: 1 }, validSet).error, "invalid_format");
assertEq("current=array → invalid_format",
  importBackup({ backupVersion: 1, current: [] }, validSet).error, "invalid_format");

console.log("\n=== importBackup — missing/invalid assumptions ===");
const baseWithBadAsmp = {
  backupVersion: 1,
  current: {
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: { rf: "not-a-number", horizon: 5, paths: 2000 },
    notes: "",
  },
  savedPortfolios: [],
};
assertEq("bad rf → invalid_assumptions", importBackup(baseWithBadAsmp, validSet).error, "invalid_assumptions");
assertEq("horizon=0 → invalid_assumptions",
  importBackup({ ...baseWithBadAsmp, current: { ...baseWithBadAsmp.current, assumptions: { rf: 0.04, horizon: 0, paths: 2000 } } }, validSet).error,
  "invalid_assumptions");
assertEq("paths=-1 → invalid_assumptions",
  importBackup({ ...baseWithBadAsmp, current: { ...baseWithBadAsmp.current, assumptions: { rf: 0.04, horizon: 5, paths: -1 } } }, validSet).error,
  "invalid_assumptions");

console.log("\n=== importBackup — unknown tickers filtered → no_valid_holdings ===");
const unknownPayload = {
  backupVersion: 1,
  current: {
    holdings: [{ t: "FAKE", lots: 5 }],
    assumptions: { rf: 0.04, horizon: 5, paths: 2000 },
    notes: "",
  },
  savedPortfolios: [],
};
assertEq("unknown ticker → no_valid_holdings", importBackup(unknownPayload, validSet).error, "no_valid_holdings");

console.log("\n=== importBackup — negative lots filtered ===");
const negLotPayload = {
  backupVersion: 1,
  current: {
    holdings: [{ t: "AAPL", lots: -1 }],
    assumptions: { rf: 0.04, horizon: 5, paths: 2000 },
    notes: "",
  },
  savedPortfolios: [],
};
assertEq("negative lots → no_valid_holdings", importBackup(negLotPayload, validSet).error, "no_valid_holdings");

// ── round-trip ────────────────────────────────────────────────────────────────
console.log("\n=== round-trip — basic ===");
const holdings = [
  makeHolding("AAPL", 10),
  makeHolding("MSFT", 5, { avgCost: 300, firstBought: "2023-01-15" }),
  makeHolding("SPY", 2),
];
const rt = roundTrip(holdings, asmp, "my notes", []);
assert("ok === true", rt.ok === true);
assert("holdings count", rt.current.holdings.length === 3);
assert("AAPL lots", rt.current.holdings[0].lots === 10);
assert("MSFT avgCost", rt.current.holdings[1].avgCost === 300);
assert("MSFT firstBought", rt.current.holdings[1].firstBought === "2023-01-15");
assert("AAPL no avgCost", !("avgCost" in rt.current.holdings[0]));
assert("notes preserved", rt.current.notes === "my notes");
assert("rf preserved", rt.current.assumptions.rf === 0.043);

console.log("\n=== round-trip — zero lots allowed ===");
const rtZero = roundTrip([makeHolding("AAPL", 0)], asmp, "", []);
assert("zero lots allowed", rtZero.ok === true && rtZero.current.holdings[0].lots === 0);

console.log("\n=== round-trip — BRK.B ticker (dot in name) ===");
const rtBrk = roundTrip([makeHolding("BRK.B", 3)], asmp, "", []);
assert("BRK.B preserved", rtBrk.ok === true && rtBrk.current.holdings[0].t === "BRK.B");

console.log("\n=== round-trip — savedPortfolios filtered ===");
const wellFormedSaved = [{
  schemaVersion: 1,
  name: "My Portfolio",
  holdings: [{ t: "AAPL", lots: 5 }],
  assumptions: { rf: 0.04, horizon: 5, paths: 2000 },
}];
const badSaved = [{ name: "bad" }];  // missing schemaVersion
const rtSaved = roundTrip([makeHolding("AAPL", 1)], asmp, "", [...wellFormedSaved, ...badSaved]);
assert("well-formed saved portfolio kept", rtSaved.savedPortfolios.length === 1);
assert("malformed saved portfolio dropped", rtSaved.savedPortfolios[0].name === "My Portfolio");

// ── source-text checks ────────────────────────────────────────────────────────
console.log("\n=== source-text checks ===");
const src = readFileSync(new URL("../src/portfolioBackup.js", import.meta.url), "utf8");

assert("exports BACKUP_VERSION", src.includes("export const BACKUP_VERSION"));
assert("exports exportBackup", src.includes("export function exportBackup"));
assert("exports importBackup", src.includes("export function importBackup"));
assert("exports makeBackupFilename", src.includes("export function makeBackupFilename"));
assert("imports SCHEMA_VERSION and isWellFormed from portfolioStorage.js",
  src.includes("SCHEMA_VERSION") && src.includes("isWellFormed") && src.includes("portfolioStorage.js"));
assert("T-B1: _STORAGE_SCHEMA_VERSION removed (no private mirror)", !src.includes("_STORAGE_SCHEMA_VERSION"));
assert("T-B2: _isSavedPortfolioWellFormed removed (no duplicate logic)", !src.includes("_isSavedPortfolioWellFormed"));
assert("no FINNHUB", !src.includes("FINNHUB"));
assert("no VITE_", !src.includes("VITE_"));

// ── summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`backup-check: ${passed}/${total} passed ✓`);
} else {
  console.error(`backup-check: ${passed}/${total} passed, ${failed} FAILED`);
  process.exit(1);
}
