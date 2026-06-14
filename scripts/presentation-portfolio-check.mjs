/**
 * presentation-portfolio-check.mjs — verifies the first-launch demo seed
 * in src/presentationPortfolio.js and its wiring in app.jsx.
 *
 * All helpers accept an injectable storage object so this runs in Node.js
 * without a real localStorage.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRESENTATION_PORTFOLIO_NAME,
  PRESENTATION_PORTFOLIO_NOTE,
  PRESENTATION_HOLDINGS,
  PRESENTATION_ASSUMPTIONS,
  bootstrapPresentationPortfolio,
} from "../src/presentationPortfolio.js";
import { loadSaves, savePortfolio, STORAGE_KEY } from "../src/portfolioStorage.js";
import { loadActiveState, saveActiveState, ACTIVE_STATE_KEY } from "../src/activePortfolioState.js";
import { UNIVERSE } from "../src/data.js";

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

const VALID_TICKERS = new Set(UNIVERSE.map(u => u.t));
const ADVISORY_TERMS = [
  "recommend", "recommended", "optimal", "best ", "suggested investment",
  "model portfolio", "buy signal", "sell signal", "target price",
];

// ── 1. Constants and shape ───────────────────────────────────────────────────
check("name is the neutral 'QPA Presentation Portfolio'", () => {
  if (PRESENTATION_PORTFOLIO_NAME !== "QPA Presentation Portfolio") {
    fail(`Got "${PRESENTATION_PORTFOLIO_NAME}"`);
  }
});

check("note is the neutral onboarding sentence", () => {
  if (PRESENTATION_PORTFOLIO_NOTE !== "Starter portfolio for presentation and onboarding.") {
    fail(`Got "${PRESENTATION_PORTFOLIO_NOTE}"`);
  }
});

check("holdings count is 4–6", () => {
  if (PRESENTATION_HOLDINGS.length < 4 || PRESENTATION_HOLDINGS.length > 6) {
    fail(`Got ${PRESENTATION_HOLDINGS.length} holdings`);
  }
});

check("all holdings use tickers supported by the app (UNIVERSE)", () => {
  for (const h of PRESENTATION_HOLDINGS) {
    if (!VALID_TICKERS.has(h.t)) fail(`Unsupported ticker "${h.t}"`);
    if (typeof h.lots !== "number" || !(h.lots > 0)) fail(`Bad lots for ${h.t}`);
  }
});

check("assumptions are the app defaults", () => {
  if (PRESENTATION_ASSUMPTIONS.rf !== 0.043) fail("rf mismatch");
  if (PRESENTATION_ASSUMPTIONS.horizon !== 5) fail("horizon mismatch");
  if (PRESENTATION_ASSUMPTIONS.paths !== 2000) fail("paths mismatch");
});

// ── 2. First-launch bootstrap (empty storage) ────────────────────────────────
check("bootstraps on empty storage and returns true", () => {
  const st = makeStorage();
  const seeded = bootstrapPresentationPortfolio(st);
  if (seeded !== true) fail("Should return true on empty storage");
});

check("starter portfolio is saved separately as a named save", () => {
  const st = makeStorage();
  bootstrapPresentationPortfolio(st);
  const saves = loadSaves(st);
  if (saves.length !== 1) fail(`Expected 1 saved portfolio, got ${saves.length}`);
  if (saves[0].name !== PRESENTATION_PORTFOLIO_NAME) fail("Saved under wrong name");
  if (saves[0].holdings.length !== PRESENTATION_HOLDINGS.length) fail("Holdings count mismatch in save");
});

check("starter portfolio is loaded as the active state", () => {
  const st = makeStorage();
  bootstrapPresentationPortfolio(st);
  const active = loadActiveState(st);
  if (!active) fail("Active state should be set");
  const tickers = active.holdings.map(h => h.t).sort();
  const expected = PRESENTATION_HOLDINGS.map(h => h.t).sort();
  if (JSON.stringify(tickers) !== JSON.stringify(expected)) fail("Active holdings mismatch");
  if (active.notes !== PRESENTATION_PORTFOLIO_NOTE) fail("Active note mismatch");
});

// ── 3. Idempotency / never overwrite existing data ───────────────────────────
check("does NOT overwrite existing saved portfolios", () => {
  const st = makeStorage();
  savePortfolio("My Real Portfolio", [{ t: "AAPL", lots: 5 }], PRESENTATION_ASSUMPTIONS, "mine", st);
  const seeded = bootstrapPresentationPortfolio(st);
  if (seeded !== false) fail("Should not seed when a saved portfolio exists");
  const saves = loadSaves(st);
  if (saves.length !== 1) fail(`Expected only the existing save, got ${saves.length}`);
  if (saves[0].name !== "My Real Portfolio") fail("Existing save was altered");
});

check("does NOT overwrite existing active state", () => {
  const st = makeStorage();
  saveActiveState([{ t: "TSLA", lots: 12 }], PRESENTATION_ASSUMPTIONS, "existing", st);
  const seeded = bootstrapPresentationPortfolio(st);
  if (seeded !== false) fail("Should not seed when active state exists");
  const active = loadActiveState(st);
  if (!active.holdings.some(h => h.t === "TSLA")) fail("Existing active state was altered");
  // and it must not have created a saved portfolio either
  if (loadSaves(st).length !== 0) fail("Should not create a saved portfolio when active state exists");
});

check("second call after a successful seed is a no-op", () => {
  const st = makeStorage();
  bootstrapPresentationPortfolio(st);
  const seededAgain = bootstrapPresentationPortfolio(st);
  if (seededAgain !== false) fail("Second bootstrap should be a no-op");
  if (loadSaves(st).length !== 1) fail("Should still have exactly 1 saved portfolio");
});

check("seeded starter portfolio can be deleted normally (not special-cased)", () => {
  const st = makeStorage();
  bootstrapPresentationPortfolio(st);
  // Delete via the normal storage path, then confirm it is gone.
  const next = loadSaves(st).filter(e => e.name !== PRESENTATION_PORTFOLIO_NAME);
  st.setItem(STORAGE_KEY, JSON.stringify(next));
  if (loadSaves(st).some(e => e.name === PRESENTATION_PORTFOLIO_NAME)) fail("Starter should be deletable");
});

check("returns false with no storage", () => {
  if (bootstrapPresentationPortfolio(null) !== false) fail("Should return false when storage is null");
});

// ── 4. No investment-advice wording ──────────────────────────────────────────
const moduleSrc = fs.readFileSync(path.join(root, "src", "presentationPortfolio.js"), "utf8");

check("module name/note/source contain no advisory wording", () => {
  const haystack = [
    PRESENTATION_PORTFOLIO_NAME.toLowerCase(),
    PRESENTATION_PORTFOLIO_NOTE.toLowerCase(),
  ].join(" ");
  for (const term of ADVISORY_TERMS) {
    if (haystack.includes(term.trim())) fail(`Advisory term "${term.trim()}" found in name/note`);
  }
  // The source file describes what it is NOT; allow negated mentions only.
  // Confirm there is no positive advisory claim like "recommended portfolio".
  const lower = moduleSrc.toLowerCase();
  if (lower.includes("recommended portfolio")) fail('"recommended portfolio" must not appear');
  if (lower.includes("model portfolio") && !lower.includes("not a")) fail("model portfolio used non-negated");
});

// ── 5. app.jsx wiring ─────────────────────────────────────────────────────────
const appSrc = fs.readFileSync(path.join(root, "src", "app.jsx"), "utf8");

check("app.jsx imports bootstrapPresentationPortfolio", () => {
  if (!appSrc.includes("bootstrapPresentationPortfolio")) fail("bootstrap import missing");
  if (!appSrc.includes("presentationPortfolio.js")) fail("module not imported in app.jsx");
});

check("app.jsx calls bootstrap before createRoot", () => {
  const callIdx = appSrc.indexOf("bootstrapPresentationPortfolio(");
  const rootIdx = appSrc.indexOf("createRoot(");
  if (callIdx === -1) fail("bootstrap call missing");
  // last occurrence of the call (the invocation, not the import) must precede createRoot render
  const invokeIdx = appSrc.lastIndexOf("bootstrapPresentationPortfolio()");
  if (invokeIdx === -1 || invokeIdx > rootIdx) fail("bootstrap must run before createRoot render");
});

// ── Final ─────────────────────────────────────────────────────────────────────
console.log(`presentation-portfolio checks passed (${passed} tests)`);
