/**
 * active-state-check.mjs — verifies src/activePortfolioState.js and
 * integration points (app.jsx, sidebar.jsx, ui.js).
 *
 * All functions accept an optional storage parameter so they can be
 * tested in Node.js without a real localStorage.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACTIVE_STATE_KEY,
  ACTIVE_STATE_VERSION,
  saveActiveState,
  loadActiveState,
  clearActiveState,
} from "../src/activePortfolioState.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");

let passed = 0;
const fail = msg => { throw new Error(msg); };

function check(label, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    throw new Error(`[FAIL] ${label}: ${e.message}`);
  }
}

function makeStorage() {
  const store = {};
  return {
    getItem:    k => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

const DEFAULT_ASSUMPTIONS = { rf: 0.043, horizon: 5, paths: 2000 };

// ── 1. File existence and constants ──────────────────────────────────────────
check("src/activePortfolioState.js exists", () => {
  const p = path.join(root, "src", "activePortfolioState.js");
  if (!fs.existsSync(p)) fail("file not found");
});

check("ACTIVE_STATE_KEY === 'qpa-active-state'", () => {
  if (ACTIVE_STATE_KEY !== "qpa-active-state") fail(`Got "${ACTIVE_STATE_KEY}"`);
});

check("ACTIVE_STATE_VERSION === 1", () => {
  if (ACTIVE_STATE_VERSION !== 1) fail(`Got ${ACTIVE_STATE_VERSION}`);
});

// ── 2. Source text checks ─────────────────────────────────────────────────────
const src = fs.readFileSync(path.join(root, "src", "activePortfolioState.js"), "utf8");

check("No FINNHUB_API_KEY in activePortfolioState.js", () => {
  if (src.toUpperCase().includes("FINNHUB")) fail("FINNHUB must not appear");
});

check("No VITE_FINNHUB_API_KEY in activePortfolioState.js", () => {
  if (src.includes("VITE_FINNHUB_API_KEY")) fail("VITE_FINNHUB_API_KEY must not appear");
});

check("No advisory language in activePortfolioState.js", () => {
  const lower = src.toLowerCase();
  for (const term of ["recommend", "target price", "buy signal", "sell signal"]) {
    if (lower.includes(term)) fail(`Advisory term "${term}" found`);
  }
});

check("No React import in activePortfolioState.js", () => {
  if (src.includes('from "react"') || src.includes("from 'react'")) fail("Must not import React");
});

check("schemaVersion: 1 in source", () => {
  if (!src.includes("ACTIVE_STATE_VERSION")) fail("ACTIVE_STATE_VERSION not found in source");
});

check("qpa-active-state key in source", () => {
  if (!src.includes("qpa-active-state")) fail("qpa-active-state not found in source");
});

// ── 3. saveActiveState ───────────────────────────────────────────────────────
check("saveActiveState: returns {ok:true, savedAt}", () => {
  const st = makeStorage();
  const result = saveActiveState([{ t: "AAPL", lots: 10 }], DEFAULT_ASSUMPTIONS, "notes", st);
  if (!result.ok) fail("Should succeed");
  if (typeof result.savedAt !== "string") fail("savedAt must be a string");
  if (result.savedAt.length < 10) fail("savedAt must be ISO timestamp");
});

check("saveActiveState: serializes schemaVersion 1", () => {
  const st = makeStorage();
  saveActiveState([{ t: "AAPL", lots: 10 }], DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.schemaVersion !== 1) fail(`Expected schemaVersion 1, got ${raw.schemaVersion}`);
});

check("saveActiveState: saves holdings", () => {
  const st = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10 }, { t: "MSFT", lots: 5 }];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.holdings.length !== 2) fail(`Expected 2 holdings, got ${raw.holdings.length}`);
  if (raw.holdings[0].t !== "AAPL") fail("AAPL not found");
  if (raw.holdings[1].lots !== 5) fail("MSFT lots wrong");
});

check("saveActiveState: preserves avgCost", () => {
  const st = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, avgCost: 150.50 }];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.holdings[0].avgCost !== 150.50) fail(`avgCost mismatch: ${raw.holdings[0].avgCost}`);
});

check("saveActiveState: preserves firstBought", () => {
  const st = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, firstBought: "2023-01-15" }];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.holdings[0].firstBought !== "2023-01-15") fail("firstBought mismatch");
});

check("saveActiveState: preserves extended tickers", () => {
  const st = makeStorage();
  const holdings = [{ t: "TSM", lots: 20 }, { t: "BIST30.IS", lots: 5 }];
  // BIST30.IS is uppercase+dot format — valid per isValidTicker pattern
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  const tickers = raw.holdings.map(h => h.t);
  if (!tickers.includes("TSM")) fail("TSM missing");
});

check("saveActiveState: saves assumptions", () => {
  const st = makeStorage();
  const assumptions = { rf: 0.05, horizon: 7, paths: 3000 };
  saveActiveState([{ t: "AAPL", lots: 10 }], assumptions, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.assumptions.rf !== 0.05) fail("rf mismatch");
  if (raw.assumptions.horizon !== 7) fail("horizon mismatch");
  if (raw.assumptions.paths !== 3000) fail("paths mismatch");
});

check("saveActiveState: caps notes at 500 chars", () => {
  const st = makeStorage();
  const longNote = "x".repeat(600);
  saveActiveState([{ t: "AAPL", lots: 10 }], DEFAULT_ASSUMPTIONS, longNote, st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.notes.length !== 500) fail(`Expected 500, got ${raw.notes.length}`);
});

check("saveActiveState: filters invalid holdings (negative lots)", () => {
  const st = makeStorage();
  const holdings = [
    { t: "AAPL", lots: 10 },
    { t: "MSFT", lots: -5 }, // invalid
  ];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.holdings.length !== 1) fail(`Expected 1 valid holding, got ${raw.holdings.length}`);
});

check("saveActiveState: filters invalid ticker format", () => {
  const st = makeStorage();
  const holdings = [
    { t: "AAPL", lots: 10 },
    { t: "aapl", lots: 5 }, // lowercase — invalid per ticker format
  ];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (raw.holdings.length !== 1) fail(`Expected 1 valid holding, got ${raw.holdings.length}`);
});

check("saveActiveState: omits invalid avgCost (negative)", () => {
  const st = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, avgCost: -50 }];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if ("avgCost" in raw.holdings[0]) fail("Negative avgCost should be omitted");
});

check("saveActiveState: omits invalid firstBought format", () => {
  const st = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, firstBought: "01/15/2023" }];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if ("firstBought" in raw.holdings[0]) fail("Invalid firstBought format should be omitted");
});

check("saveActiveState: handles null holdings gracefully", () => {
  const st = makeStorage();
  const result = saveActiveState(null, DEFAULT_ASSUMPTIONS, "", st);
  if (!result.ok) fail("Should succeed even with null holdings");
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (!Array.isArray(raw.holdings) || raw.holdings.length !== 0) fail("holdings should be []");
});

check("saveActiveState: saves savedAt ISO string", () => {
  const st = makeStorage();
  saveActiveState([{ t: "AAPL", lots: 10 }], DEFAULT_ASSUMPTIONS, "", st);
  const raw = JSON.parse(st.getItem(ACTIVE_STATE_KEY));
  if (typeof raw.savedAt !== "string") fail("savedAt must be a string");
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw.savedAt)) fail("savedAt must be ISO format");
});

// ── 4. loadActiveState ───────────────────────────────────────────────────────
check("loadActiveState: returns null if missing", () => {
  const st = makeStorage();
  if (loadActiveState(st) !== null) fail("Should return null when no key exists");
});

check("loadActiveState: handles malformed JSON safely", () => {
  const st = makeStorage();
  st.setItem(ACTIVE_STATE_KEY, "not-json{{{");
  const result = loadActiveState(st);
  if (result !== null) fail("Should return null on malformed JSON");
});

check("loadActiveState: rejects wrong schemaVersion", () => {
  const st = makeStorage();
  st.setItem(ACTIVE_STATE_KEY, JSON.stringify({
    schemaVersion: 99,
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: DEFAULT_ASSUMPTIONS,
    notes: "",
  }));
  if (loadActiveState(st) !== null) fail("Should reject wrong schemaVersion");
});

check("loadActiveState: rejects invalid assumptions (bad rf)", () => {
  const st = makeStorage();
  st.setItem(ACTIVE_STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: { rf: "bad", horizon: 5, paths: 2000 },
    notes: "",
  }));
  if (loadActiveState(st) !== null) fail("Should reject invalid rf");
});

check("loadActiveState: returns holdings, assumptions, notes, savedAt", () => {
  const st = makeStorage();
  saveActiveState([{ t: "AAPL", lots: 10 }], DEFAULT_ASSUMPTIONS, "test note", st);
  const result = loadActiveState(st);
  if (!result) fail("Should return state object");
  if (!Array.isArray(result.holdings)) fail("holdings must be array");
  if (!result.assumptions) fail("assumptions must be present");
  if (typeof result.notes !== "string") fail("notes must be string");
  if (typeof result.savedAt !== "string") fail("savedAt must be string");
});

check("loadActiveState: filters invalid holdings on load", () => {
  const st = makeStorage();
  st.setItem(ACTIVE_STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    holdings: [
      { t: "AAPL", lots: 10 },
      { t: "bad!", lots: 5 }, // invalid ticker format
      { t: "MSFT", lots: -1 }, // invalid lots
    ],
    assumptions: DEFAULT_ASSUMPTIONS,
    notes: "",
  }));
  const result = loadActiveState(st);
  if (!result) fail("Should succeed with partial holdings");
  if (result.holdings.length !== 1) fail(`Expected 1 valid holding, got ${result.holdings.length}`);
});

check("loadActiveState: accepts empty holdings (valid state)", () => {
  const st = makeStorage();
  saveActiveState([], DEFAULT_ASSUMPTIONS, "", st);
  const result = loadActiveState(st);
  if (!result) fail("Should return state even with empty holdings");
  if (!Array.isArray(result.holdings) || result.holdings.length !== 0) {
    fail("Empty holdings should be preserved");
  }
});

check("loadActiveState: accepts valid extended tickers", () => {
  const st = makeStorage();
  const holdings = [{ t: "TSM", lots: 20 }];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "", st);
  const result = loadActiveState(st);
  if (!result) fail("Should succeed");
  if (!result.holdings.some(h => h.t === "TSM")) fail("Extended ticker TSM missing");
});

check("loadActiveState: round-trip preserves avgCost and firstBought", () => {
  const st = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, avgCost: 150.25, firstBought: "2023-06-01" }];
  saveActiveState(holdings, DEFAULT_ASSUMPTIONS, "my note", st);
  const result = loadActiveState(st);
  if (!result) fail("Should succeed");
  if (result.holdings[0].avgCost !== 150.25) fail("avgCost not preserved");
  if (result.holdings[0].firstBought !== "2023-06-01") fail("firstBought not preserved");
  if (result.notes !== "my note") fail("notes not preserved");
});

check("loadActiveState: round-trip preserves assumptions", () => {
  const st = makeStorage();
  const assumptions = { rf: 0.055, horizon: 8, paths: 4000 };
  saveActiveState([{ t: "AAPL", lots: 10 }], assumptions, "", st);
  const result = loadActiveState(st);
  if (!result) fail("Should succeed");
  if (Math.abs(result.assumptions.rf - 0.055) > 1e-9) fail("rf not preserved");
  if (result.assumptions.horizon !== 8) fail("horizon not preserved");
  if (result.assumptions.paths !== 4000) fail("paths not preserved");
});

// ── 5. clearActiveState ──────────────────────────────────────────────────────
check("clearActiveState: removes the key", () => {
  const st = makeStorage();
  saveActiveState([{ t: "AAPL", lots: 10 }], DEFAULT_ASSUMPTIONS, "", st);
  if (!loadActiveState(st)) fail("Should have state before clear");
  clearActiveState(st);
  if (loadActiveState(st) !== null) fail("Should return null after clear");
});

check("clearActiveState does not crash on empty storage", () => {
  const st = makeStorage();
  clearActiveState(st); // should not throw
});

check("reset behavior: clearActiveState must be called explicitly (not automatic)", () => {
  // The module does NOT call clearActiveState automatically — it's always explicit.
  // Verify clearActiveState is exported and clearable only when called.
  const st = makeStorage();
  saveActiveState([{ t: "AAPL", lots: 10 }], DEFAULT_ASSUMPTIONS, "", st);
  // Simulate "reset to default" without calling clearActiveState
  // Active state should still be there
  const result = loadActiveState(st);
  if (!result) fail("Active state should survive without explicit clearActiveState call");
});

// ── 6. app.jsx integration checks ────────────────────────────────────────────
const appSrc = fs.readFileSync(path.join(root, "src", "app.jsx"), "utf8");

check("app.jsx imports loadActiveState", () => {
  if (!appSrc.includes("loadActiveState")) fail("loadActiveState must be imported/used in app.jsx");
});

check("app.jsx imports saveActiveState", () => {
  if (!appSrc.includes("saveActiveState")) fail("saveActiveState must be imported/used in app.jsx");
});

check("app.jsx imports from activePortfolioState.js", () => {
  if (!appSrc.includes("activePortfolioState.js")) fail("activePortfolioState.js must be imported in app.jsx");
});

check("app.jsx uses loadActiveState in useState for holdings", () => {
  if (!appSrc.includes("loadActiveState")) fail("loadActiveState must be called in holdings useState");
  // Check startup integration: loadActiveState result used for holdings initialization
  const holdingsInit = appSrc.slice(appSrc.indexOf("setHoldings"), appSrc.indexOf("setHoldings") + 50);
  // Actually check that the initial state section mentions loadActiveState
  if (!appSrc.match(/useState\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?loadActiveState/)) {
    fail("loadActiveState must be used inside a useState initializer function");
  }
});

check("app.jsx defines handleSaveActiveState", () => {
  if (!appSrc.includes("handleSaveActiveState")) fail("handleSaveActiveState must be defined in app.jsx");
});

check("app.jsx passes onSaveActiveState to Sidebar", () => {
  if (!appSrc.includes("onSaveActiveState")) fail("onSaveActiveState must be passed to Sidebar");
});

check("app.jsx passes lastActiveSavedAt to Sidebar", () => {
  if (!appSrc.includes("lastActiveSavedAt")) fail("lastActiveSavedAt must be passed to Sidebar");
});

check("app.jsx calls saveActiveState in handleImportBackup", () => {
  const importBackupFn = appSrc.slice(
    appSrc.indexOf("function handleImportBackup"),
    appSrc.indexOf("function handleSaveActiveState")
  );
  if (!importBackupFn.includes("saveActiveState")) {
    fail("handleImportBackup must call saveActiveState after successful import");
  }
});

// ── 7. sidebar.jsx integration checks ────────────────────────────────────────
const sidebarSrc = fs.readFileSync(path.join(root, "src", "sidebar.jsx"), "utf8");

check("sidebar.jsx destructures onSaveActiveState prop", () => {
  if (!sidebarSrc.includes("onSaveActiveState")) fail("onSaveActiveState must be destructured in Sidebar props");
});

check("sidebar.jsx destructures lastActiveSavedAt prop", () => {
  if (!sidebarSrc.includes("lastActiveSavedAt")) fail("lastActiveSavedAt must be destructured in Sidebar props");
});

check("sidebar.jsx has Save Current State button", () => {
  if (!sidebarSrc.includes("saveActiveState")) fail("saveActiveState i18n key must appear in sidebar");
  if (!sidebarSrc.includes("save-active-btn")) fail("save-active-btn CSS class must appear in sidebar");
});

check("sidebar.jsx shows last saved status", () => {
  if (!sidebarSrc.includes("save-active-status")) fail("save-active-status CSS class must appear in sidebar");
  if (!sidebarSrc.includes("activeStateLastSaved")) fail("activeStateLastSaved i18n key must appear in sidebar");
  if (!sidebarSrc.includes("activeStateNeverSaved")) fail("activeStateNeverSaved i18n key must appear in sidebar");
});

check("sidebar.jsx has save feedback (activeStateSaved)", () => {
  if (!sidebarSrc.includes("activeStateSaved")) fail("activeStateSaved i18n key must appear in sidebar for feedback");
});

// ── 8. ui.js EN/TR parity checks ─────────────────────────────────────────────
const uiSrc = fs.readFileSync(path.join(root, "src", "ui.js"), "utf8");

const activeStateKeys = ["saveActiveState", "activeStateSaved", "activeStateLastSaved", "activeStateNeverSaved"];
for (const key of activeStateKeys) {
  check(`ui.js EN has key "${key}"`, () => {
    if (!uiSrc.includes(`${key}:`)) fail(`EN key "${key}" not found`);
  });
}

check("ui.js TR has all 4 active-state keys (EN/TR parity)", () => {
  // Verify TR section includes all 4 keys by checking the TR object
  const trStart = uiSrc.indexOf("tr: {");
  const trSection = uiSrc.slice(trStart);
  for (const key of activeStateKeys) {
    if (!trSection.includes(`${key}:`)) fail(`TR missing key "${key}"`);
  }
});

check("ui.js saveActiveState EN value is non-empty string", () => {
  if (!uiSrc.includes('"Save Current State"')) fail('EN saveActiveState must be "Save Current State"');
});

check("ui.js saveActiveState TR value is non-empty string", () => {
  if (!uiSrc.includes('"Geçerli Durumu Kaydet"')) fail('TR saveActiveState must be "Geçerli Durumu Kaydet"');
});

// ── Final ─────────────────────────────────────────────────────────────────────
console.log(`active-state checks passed (${passed} tests)`);
