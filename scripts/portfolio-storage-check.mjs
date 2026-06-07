/**
 * portfolio-storage-check.mjs — tests for src/portfolioStorage.js.
 *
 * All tests run in Node.js without a browser. A mock storage object is
 * injected via the optional `storage` parameter so globalThis.localStorage
 * is never touched.
 */

import {
  loadSaves, savePortfolio, deletePortfolio, validateEntry,
  STORAGE_KEY, SCHEMA_VERSION, MAX_SAVES,
} from "../src/portfolioStorage.js";

const fail = msg => { throw new Error(msg); };

let passed = 0;
function pass(label) { passed++; console.log("  ✓", label); }

// ── Mock storage factory ──────────────────────────────────────────────────────
function makeStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    getItem:    key      => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem:    (key, v) => { data[key] = v; },
    removeItem: key      => { delete data[key]; },
    _data:      data,
  };
}

const HOLDINGS_A = [{ t: "AAPL", lots: 120 }, { t: "MSFT", lots: 60 }];
const ASSUMPTIONS_A = { rf: 0.043, horizon: 5, paths: 2000 };
const VALID_TICKERS = new Set(["AAPL", "MSFT", "NVDA", "VTI", "BND", "AMZN", "GOOGL", "JPM", "XOM", "TLT", "GLD", "VEA", "QQQ", "META", "BRK.B"]);

// ── 1. Empty storage returns [] ───────────────────────────────────────────────
{
  const s = makeStorage();
  const result = loadSaves(s);
  if (!Array.isArray(result)) fail("loadSaves should return an array");
  if (result.length !== 0) fail(`Expected [] from empty storage, got ${JSON.stringify(result)}`);
  pass("empty storage returns []");
}

// ── 2. Malformed JSON returns [] ──────────────────────────────────────────────
{
  const s = makeStorage({ [STORAGE_KEY]: "NOT_VALID_JSON{{{" });
  const result = loadSaves(s);
  if (!Array.isArray(result) || result.length !== 0) {
    fail(`Malformed JSON should return [], got ${JSON.stringify(result)}`);
  }
  pass("malformed JSON returns []");
}

// ── 3. Valid save serializes holdings + assumptions only ──────────────────────
{
  const s = makeStorage();
  const r = savePortfolio("Alpha Save", HOLDINGS_A, ASSUMPTIONS_A, s);
  if (!r.ok) fail(`savePortfolio failed: ${r.error}`);
  const saves = loadSaves(s);
  if (saves.length !== 1) fail(`Expected 1 save, got ${saves.length}`);
  const entry = saves[0];
  if (entry.name !== "Alpha Save") fail(`Wrong name: ${entry.name}`);
  if (entry.schemaVersion !== SCHEMA_VERSION) fail(`Wrong schemaVersion: ${entry.schemaVersion}`);
  if (!Array.isArray(entry.holdings) || entry.holdings.length !== 2) fail("holdings not serialized correctly");
  if (entry.holdings[0].t !== "AAPL" || entry.holdings[0].lots !== 120) fail("First holding mismatch");
  if (typeof entry.assumptions !== "object") fail("assumptions not serialized");
  if (entry.assumptions.rf !== 0.043) fail(`rf mismatch: ${entry.assumptions.rf}`);
  if (entry.assumptions.horizon !== 5) fail(`horizon mismatch: ${entry.assumptions.horizon}`);
  if (entry.assumptions.paths !== 2000) fail(`paths mismatch: ${entry.assumptions.paths}`);
  if (typeof entry.savedAt !== "string" || !entry.savedAt.includes("T")) fail("savedAt must be an ISO string");
  pass("valid save serializes holdings + assumptions correctly");
}

// ── 4. Computed metrics / fetched data are NOT serialized ─────────────────────
{
  const s = makeStorage();
  savePortfolio("Beta Save", HOLDINGS_A, ASSUMPTIONS_A, s);
  const raw = JSON.parse(s.getItem(STORAGE_KEY));
  const entry = raw[0];
  const forbidden = ["annRet", "annVol", "mdd", "sharpe", "sortino", "cvar95", "beta",
    "assets", "candles", "history", "quote", "profile", "news", "apiStatus",
    "rateLimitWarning", "historyBySymbol", "quoteBySymbol", "profileBySymbol"];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      fail(`Serialized entry must not include computed/fetched field: "${key}"`);
    }
  }
  pass("computed metrics and fetched data are not serialized");
}

// ── 5. Max 10 saved portfolios enforced ───────────────────────────────────────
{
  const s = makeStorage();
  for (let i = 1; i <= MAX_SAVES; i++) {
    const r = savePortfolio(`Portfolio ${i}`, HOLDINGS_A, ASSUMPTIONS_A, s);
    if (!r.ok) fail(`Save #${i} should succeed, got error: ${r.error}`);
  }
  if (loadSaves(s).length !== MAX_SAVES) fail(`Expected ${MAX_SAVES} saves after max fills`);
  const overflow = savePortfolio("Overflow", HOLDINGS_A, ASSUMPTIONS_A, s);
  if (overflow.ok) fail("Saving beyond max should return ok:false");
  if (overflow.error !== "max_reached") fail(`Expected error "max_reached", got "${overflow.error}"`);
  if (loadSaves(s).length !== MAX_SAVES) fail("Overflow save must not be added");
  pass(`max ${MAX_SAVES} portfolios enforced`);
}

// ── 6. Duplicate name overwrites the existing entry ───────────────────────────
{
  const s = makeStorage();
  savePortfolio("My Portfolio", [{ t: "AAPL", lots: 10 }], ASSUMPTIONS_A, s);
  savePortfolio("My Portfolio", [{ t: "MSFT", lots: 20 }], ASSUMPTIONS_A, s);
  const saves = loadSaves(s);
  if (saves.length !== 1) fail(`Duplicate name should leave 1 entry, got ${saves.length}`);
  if (saves[0].holdings[0].t !== "MSFT") fail("Overwrite should replace holdings with the new value");
  pass("duplicate name silently overwrites the existing entry");
}

// ── 7. Delete removes only the intended portfolio ─────────────────────────────
{
  const s = makeStorage();
  savePortfolio("Keep Me", HOLDINGS_A, ASSUMPTIONS_A, s);
  savePortfolio("Delete Me", [{ t: "VTI", lots: 50 }], ASSUMPTIONS_A, s);
  if (loadSaves(s).length !== 2) fail("Setup: expected 2 saves before delete");
  const r = deletePortfolio("Delete Me", s);
  if (!r.ok) fail(`deletePortfolio failed: ${r.error}`);
  const after = loadSaves(s);
  if (after.length !== 1) fail(`Expected 1 save after delete, got ${after.length}`);
  if (after[0].name !== "Keep Me") fail(`Wrong entry remains: "${after[0].name}"`);
  pass("delete removes only the intended portfolio");
}

// ── 8. Unknown schemaVersion is ignored (not loaded) ─────────────────────────
{
  const s = makeStorage();
  const fakeFuture = JSON.stringify([{
    schemaVersion: 99,
    name: "Future Format",
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: { rf: 0.04, horizon: 5, paths: 1000 },
    savedAt: new Date().toISOString(),
  }]);
  s.setItem(STORAGE_KEY, fakeFuture);
  const result = loadSaves(s);
  if (result.length !== 0) fail(`Unknown schemaVersion should be filtered out, got ${result.length} entries`);
  pass("unknown schemaVersion is ignored");
}

// ── 9. validateEntry: invalid holdings are filtered / entry rejected ───────────
{
  // Valid entry passes
  const validEntry = {
    schemaVersion: SCHEMA_VERSION,
    name: "Good Entry",
    holdings: [{ t: "AAPL", lots: 10 }, { t: "INVALID_TICKER", lots: 5 }],
    assumptions: { rf: 0.043, horizon: 5, paths: 2000 },
    savedAt: new Date().toISOString(),
  };
  const loaded = validateEntry(validEntry, VALID_TICKERS);
  if (!loaded) fail("validateEntry should accept entry with at least one valid holding");
  if (loaded.holdings.length !== 1) fail(`Should keep 1 valid holding, got ${loaded.holdings.length}`);
  if (loaded.holdings[0].t !== "AAPL") fail("Should keep the valid AAPL holding");
  pass("validateEntry: unknown ticker filtered, valid ticker kept");

  // All invalid holdings → null
  const allBad = {
    schemaVersion: SCHEMA_VERSION,
    name: "All Bad",
    holdings: [{ t: "FAKE1", lots: 10 }, { t: "FAKE2", lots: 5 }],
    assumptions: { rf: 0.043, horizon: 5, paths: 2000 },
    savedAt: new Date().toISOString(),
  };
  if (validateEntry(allBad, VALID_TICKERS) !== null) fail("All-invalid holdings should return null");
  pass("validateEntry: all invalid holdings returns null");

  // NaN lots → filtered
  const nanLots = {
    schemaVersion: SCHEMA_VERSION,
    name: "NaN Lots",
    holdings: [{ t: "AAPL", lots: NaN }],
    assumptions: { rf: 0.043, horizon: 5, paths: 2000 },
    savedAt: new Date().toISOString(),
  };
  if (validateEntry(nanLots, VALID_TICKERS) !== null) fail("NaN lots should return null");
  pass("validateEntry: NaN lots returns null");

  // Negative lots → filtered
  const negLots = {
    schemaVersion: SCHEMA_VERSION,
    name: "Neg Lots",
    holdings: [{ t: "AAPL", lots: -5 }],
    assumptions: { rf: 0.043, horizon: 5, paths: 2000 },
    savedAt: new Date().toISOString(),
  };
  if (validateEntry(negLots, VALID_TICKERS) !== null) fail("Negative lots should return null");
  pass("validateEntry: negative lots returns null");

  // Unknown schemaVersion → null
  const wrongVersion = { ...validEntry, schemaVersion: 42 };
  if (validateEntry(wrongVersion, VALID_TICKERS) !== null) {
    fail("validateEntry should return null for unknown schemaVersion");
  }
  pass("validateEntry: unknown schemaVersion returns null");
}

// ── 10. QuotaExceededError handled without throw ──────────────────────────────
{
  const s = makeStorage();
  // Populate with a valid save first so loadSaves() inside savePortfolio returns data
  s.setItem(STORAGE_KEY, JSON.stringify([{
    schemaVersion: SCHEMA_VERSION,
    name: "Existing",
    holdings: [{ t: "VTI", lots: 100 }],
    assumptions: ASSUMPTIONS_A,
    savedAt: new Date().toISOString(),
  }]));
  // Now make setItem throw on the next call (simulates QuotaExceededError)
  s.setItem = () => { throw Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" }); };

  let result;
  try {
    result = savePortfolio("New Name", HOLDINGS_A, ASSUMPTIONS_A, s);
  } catch (e) {
    fail(`savePortfolio must not throw on storage error, but threw: ${e.message}`);
  }
  if (!result || result.ok !== false) fail("Expected ok:false on storage error");
  if (result.error !== "storage_error") fail(`Expected error "storage_error", got "${result.error}"`);
  pass("QuotaExceededError is caught and returned as { ok: false, error: 'storage_error' }");
}

// ── done ──────────────────────────────────────────────────────────────────────
console.log(`\nportfolio-storage checks: ${passed} passed`);
