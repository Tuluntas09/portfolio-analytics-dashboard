/**
 * app-check.mjs — verifies src/app.jsx meets Phase 6i acceptance criteria.
 *
 * All checks are source-text analysis (Node.js cannot parse JSX at runtime).
 * The file is read as a string and pattern-matched.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

const appPath = path.join(root, "src", "app.jsx");
if (!fs.existsSync(appPath)) fail("src/app.jsx must exist");
const src = fs.readFileSync(appPath, "utf8");

// ── 1. React imported from npm ─────────────────────────────────────────────
{
  if (!src.includes('from "react"') && !src.includes("from 'react'")) {
    fail('src/app.jsx must import React from the npm "react" package');
  }
}

// ── 2. createRoot imported from react-dom/client ──────────────────────────
{
  if (!src.includes('from "react-dom/client"') && !src.includes("from 'react-dom/client'")) {
    fail('src/app.jsx must import createRoot from "react-dom/client"');
  }
}

// ── 3. Imports from src/data.js ────────────────────────────────────────────
{
  const required = ["DATA_SOURCES", "ACTIVE_DATA_ADAPTER", "DEFAULT_LOTS"];
  for (const name of required) {
    if (!src.includes(name)) fail(`src/app.jsx must import/use ${name} from ./data.js`);
  }
  if (!src.includes('./data.js"') && !src.includes("./data.js'")) {
    fail('src/app.jsx must import from "./data.js"');
  }
}

// ── 4. Imports from src/ui.js ─────────────────────────────────────────────
{
  const required = ["fmtUSD", "fmtPctSigned", "fmtNum", "fmtPct"];
  for (const name of required) {
    if (!src.includes(name)) fail(`src/app.jsx must import/use ${name} from ./ui.js`);
  }
  if (!src.includes('./ui.js"') && !src.includes("./ui.js'")) {
    fail('src/app.jsx must import from "./ui.js"');
  }
}

// ── 5. Pill imported from src/ui.jsx ──────────────────────────────────────
{
  if (!src.includes("Pill")) fail('src/app.jsx must import/use Pill from "./ui.jsx"');
  if (!src.includes('./ui.jsx"') && !src.includes("./ui.jsx'")) {
    fail('src/app.jsx must import from "./ui.jsx"');
  }
}

// ── 6. Sidebar imported from src/sidebar.jsx ──────────────────────────────
{
  if (!src.includes('./sidebar.jsx"') && !src.includes("./sidebar.jsx'")) {
    fail('src/app.jsx must import Sidebar from "./sidebar.jsx"');
  }
}

// ── 7. Overview/Risk tabs imported from src/views/overview.jsx ────────────
{
  if (!src.includes("OverviewTab") || !src.includes("RiskTab")) {
    fail('src/app.jsx must import OverviewTab and RiskTab from "./views/overview.jsx"');
  }
  if (!src.includes('./views/overview.jsx"') && !src.includes("./views/overview.jsx'")) {
    fail('src/app.jsx must import from "./views/overview.jsx"');
  }
}

// ── 8. Analysis tabs imported from src/views/analysis.jsx ─────────────────
{
  const required = ["AnalysisTab", "OptimizationTab", "SimulationTab", "CompanyTab", "DataTab"];
  for (const name of required) {
    if (!src.includes(name)) fail(`src/app.jsx must import/use ${name} from "./views/analysis.jsx"`);
  }
  if (!src.includes('./views/analysis.jsx"') && !src.includes("./views/analysis.jsx'")) {
    fail('src/app.jsx must import from "./views/analysis.jsx"');
  }
}

// ── 9. Standard hook names used (not App-suffixed aliases) ────────────────
{
  if (src.includes("useStateApp") || src.includes("useMemoApp") || src.includes("useEffectApp")) {
    fail('src/app.jsx must use standard hook names (useState, useMemo, useEffect), not App-suffixed aliases');
  }
}

// ── 10. TABS constant with all 7 ids ──────────────────────────────────────
{
  const tabIds = ["overview", "risk", "optimization", "simulation", "analysis", "company", "data"];
  for (const id of tabIds) {
    if (!src.includes(`"${id}"`)) fail(`src/app.jsx TABS must include tab id "${id}"`);
  }
}

// ── 11. PROFILE_LABELS present ────────────────────────────────────────────
{
  if (!src.includes("PROFILE_LABELS")) fail("src/app.jsx must define PROFILE_LABELS");
  if (!src.includes('"balanced"') || !src.includes('"Balanced"')) {
    fail('src/app.jsx PROFILE_LABELS must include "balanced"/"Balanced"');
  }
}

// ── 12. API_BASE_URL derived from DATA_SOURCES with fallback ──────────────
{
  if (!src.includes("API_BASE_URL")) fail("src/app.jsx must define API_BASE_URL");
  if (!src.includes("127.0.0.1:8787")) fail("src/app.jsx API_BASE_URL must include the localhost fallback");
}

// ── 13. historyWindow helper present ──────────────────────────────────────
{
  if (!src.includes("function historyWindow")) fail("src/app.jsx must define historyWindow()");
  if (!src.includes("toISOString().slice(0, 10)")) fail("src/app.jsx historyWindow must include ISO date slicing");
}

// ── 14. All 14 state variables present ────────────────────────────────────
{
  const stateVars = [
    "theme", "language", "holdings", "dateRange", "profile",
    "assumptions", "tab", "apiStatus", "rateLimitWarning",
    "historyBySymbol", "quoteBySymbol", "profileBySymbol",
    "marketDataStatus", "referenceDataStatus",
  ];
  for (const v of stateVars) {
    if (!src.includes(v)) fail(`src/app.jsx must declare state variable: ${v}`);
  }
}

// ── 15. localStorage keys preserved ───────────────────────────────────────
{
  if (!src.includes('"qpa-theme"')) fail('src/app.jsx must use localStorage key "qpa-theme"');
  if (!src.includes('"qpa-language"')) fail('src/app.jsx must use localStorage key "qpa-language"');
}

// ── 16. Both useMemo hooks present (p and pAdj) ───────────────────────────
{
  if (!src.includes("buildPortfolio")) fail("src/app.jsx must call buildPortfolio in useMemo");
  if (!src.includes("const pAdj")) fail("src/app.jsx must define pAdj useMemo");
  if (!src.includes("0.72")) fail("src/app.jsx pAdj must include the sortino 0.72 factor");
}

// ── 17. rateLimitWarning detection present in fetch chains ────────────────
{
  if (!src.includes('"rate_limited"')) {
    fail('src/app.jsx must detect body.error === "rate_limited" in fetch chains');
  }
}

// ── 18. rate-limit-banner class present ───────────────────────────────────
{
  if (!src.includes("rate-limit-banner")) {
    fail('src/app.jsx must render a .rate-limit-banner div when rateLimitWarning is true');
  }
}

// ── 19. Inline style block present ────────────────────────────────────────
{
  if (!src.includes("<style>{`")) fail("src/app.jsx must contain an inline <style> JSX block");
  if (!src.includes(".tabnav")) fail("src/app.jsx inline style must include .tabnav");
  if (!src.includes(".tab-btn")) fail("src/app.jsx inline style must include .tab-btn");
  if (!src.includes(".topbar")) fail("src/app.jsx inline style must include .topbar");
  if (!src.includes(".kpi-strip")) fail("src/app.jsx inline style must include .kpi-strip");
  if (!src.includes(".opt-cards")) fail("src/app.jsx inline style must include .opt-cards");
  if (!src.includes(".src-grid")) fail("src/app.jsx inline style must include .src-grid");
}

// ── 20. window.__exportTab and window.__exportDone preserved ──────────────
{
  if (!src.includes("window.__exportTab")) fail("src/app.jsx must define window.__exportTab");
  if (!src.includes("window.__exportDone")) fail("src/app.jsx must define window.__exportDone");
  if (!src.includes("export-mode")) fail("src/app.jsx export helpers must reference export-mode class");
}

// ── 21. createRoot mount call present ─────────────────────────────────────
{
  if (!src.includes('createRoot(document.getElementById("root"))')) {
    fail('src/app.jsx must call createRoot(document.getElementById("root"))');
  }
}

// ── 22. No Object.assign(window, ...) — app.jsx does not export to window ─
{
  if (src.includes("Object.assign(window")) {
    fail("src/app.jsx must not use Object.assign(window, ...) — it does not export to window");
  }
}

// ── 23. No window.* consumer references (only the intentional export hooks) ─
{
  // Strip out the two intentional window.__ assignments at the bottom
  const withoutExports = src
    .replace(/window\.__exportTab\s*=/, "")
    .replace(/window\.__exportDone\s*=/, "");
  // The only remaining window.* should be inside the export helpers themselves
  // (window.scrollTo, document.body — those are DOM APIs not window global reads)
  const windowConsumers = withoutExports.match(/\bwindow\.\w+/g) || [];
  const allowedPatterns = ["window.scrollTo", "window.__exportTab", "window.__exportDone", "window.print"];
  const illegal = windowConsumers.filter(w => !allowedPatterns.some(a => w.startsWith(a.split("(")[0])));
  if (illegal.length > 0) {
    fail(`src/app.jsx has unexpected window.* references: ${illegal.join(", ")}`);
  }
}

// ── 24. public/legacy/app.jsx still exists and is unchanged ───────────────
{
  const legacyPath = path.join(root, "public", "legacy", "app.jsx");
  if (!fs.existsSync(legacyPath)) fail("public/legacy/app.jsx must still exist (never delete legacy files)");
  const legacySrc = fs.readFileSync(legacyPath, "utf8");
  if (!legacySrc.includes("ReactDOM.createRoot")) fail("public/legacy/app.jsx appears modified — it must be preserved unchanged");
}

// ── 25. index.html uses module entry, not legacy babel chain ──────────────
{
  const htmlPath = path.join(root, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  if (html.includes("babel.min.js") || html.includes("babel.js")) {
    fail("index.html must not load Babel Standalone — the Vite module entry replaces it");
  }
  if (html.includes("react.development.js") || html.includes("react-dom.development.js")) {
    fail("index.html must not load React UMD CDN scripts — npm React is bundled by Vite");
  }
  if (html.includes('type="text/babel"')) {
    fail('index.html must not have <script type="text/babel"> tags — the legacy Babel chain is removed');
  }
  if (!html.includes('type="module"') || !html.includes("src/app.jsx")) {
    fail('index.html must load src/app.jsx as <script type="module">');
  }
}

console.log("app checks passed");
