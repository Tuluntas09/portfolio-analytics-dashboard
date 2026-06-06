/**
 * analysis-check.mjs — verifies src/views/analysis.jsx exports the expected
 * Analysis, Optimization, Simulation, Company, and Data tab components.
 *
 * Node.js cannot parse JSX, so this script reads src/views/analysis.jsx as
 * source text. Component exports, JSX pragma, import declarations, private
 * constant privacy, and public/legacy/views-analysis.jsx window export list
 * are verified via text analysis.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

// ── 1. src/views/analysis.jsx exists ──────────────────────────────────────
{
  const p = path.join(root, "src", "views", "analysis.jsx");
  if (!fs.existsSync(p)) fail("src/views/analysis.jsx must exist");
}

const analysisSrc = fs.readFileSync(
  path.join(root, "src", "views", "analysis.jsx"), "utf8"
);

// ── 2. All 5 exports are present ───────────────────────────────────────────
{
  const expectedExports = ["AnalysisTab", "OptimizationTab", "SimulationTab", "CompanyTab", "DataTab"];
  for (const name of expectedExports) {
    const hasFn    = analysisSrc.includes(`export function ${name}`);
    const hasConst = analysisSrc.includes(`export const ${name}`);
    if (!hasFn && !hasConst) {
      fail(`src/views/analysis.jsx must export "${name}"`);
    }
  }
}

// ── 3. JSX pragma is present (classic mode — global React) ─────────────────
{
  if (!analysisSrc.includes("@jsx React.createElement")) {
    fail("src/views/analysis.jsx must have @jsx pragma pointing at React.createElement");
  }
}

// ── 4. React hooks are aliased from global React (not imported as npm) ─────
{
  if (!analysisSrc.includes("useMemo: useMemoVA")) {
    fail("src/views/analysis.jsx must alias useMemo as useMemoVA from global React");
  }
  if (!analysisSrc.includes("useState: useStateVA")) {
    fail("src/views/analysis.jsx must alias useState as useStateVA from global React");
  }
  if (!analysisSrc.includes("useEffect: useEffectVA")) {
    fail("src/views/analysis.jsx must alias useEffect as useEffectVA from global React");
  }
}

// ── 5. Imports from src/ui.js ─────────────────────────────────────────────
{
  const requiredFromUiJs = ["assetColor", "fmtUSD", "fmtPct", "fmtPctSigned", "fmtNum", "fmtUSDc"];
  if (!analysisSrc.includes('from "../ui.js"')) {
    fail('src/views/analysis.jsx must import from "../ui.js"');
  }
  for (const sym of requiredFromUiJs) {
    if (!analysisSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/ui\\.js["']`))) {
      fail(`src/views/analysis.jsx must import "${sym}" from "../ui.js"`);
    }
  }
}

// ── 6. Imports from src/ui.jsx ────────────────────────────────────────────
{
  const requiredFromUiJsx = ["ModuleIntro", "Pill", "InsightGrid", "InsightCard", "Card", "Table", "Alert", "Metric", "Segmented"];
  if (!analysisSrc.includes('from "../ui.jsx"')) {
    fail('src/views/analysis.jsx must import from "../ui.jsx"');
  }
  for (const sym of requiredFromUiJsx) {
    if (!analysisSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/ui\\.jsx["']`))) {
      fail(`src/views/analysis.jsx must import "${sym}" from "../ui.jsx"`);
    }
  }
}

// ── 7. Imports from src/charts.jsx ───────────────────────────────────────
{
  const requiredFromCharts = ["VBars", "MiniLine", "FanChart", "Histogram"];
  if (!analysisSrc.includes('from "../charts.jsx"')) {
    fail('src/views/analysis.jsx must import from "../charts.jsx"');
  }
  for (const sym of requiredFromCharts) {
    if (!analysisSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/charts\\.jsx["']`))) {
      fail(`src/views/analysis.jsx must import "${sym}" from "../charts.jsx"`);
    }
  }
}

// ── 8. Imports from src/data.js ───────────────────────────────────────────
{
  const requiredFromData = ["STRESS", "monteCarlo", "COMPANY", "lookup", "DATA_SOURCES"];
  if (!analysisSrc.includes('from "../data.js"')) {
    fail('src/views/analysis.jsx must import from "../data.js"');
  }
  for (const sym of requiredFromData) {
    if (!analysisSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/data\\.js["']`))) {
      fail(`src/views/analysis.jsx must import "${sym}" from "../data.js"`);
    }
  }
}

// ── 9. Imports dataProviderLabel and dataProviderTone from src/views/overview.jsx
{
  const requiredFromOverview = ["dataProviderLabel", "dataProviderTone"];
  if (!analysisSrc.includes('from "./overview.jsx"')) {
    fail('src/views/analysis.jsx must import from "./overview.jsx"');
  }
  for (const sym of requiredFromOverview) {
    if (!analysisSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\/overview\\.jsx["']`))) {
      fail(`src/views/analysis.jsx must import "${sym}" from "./overview.jsx"`);
    }
  }
}

// ── 10. MODULE_COPY is private (not exported) and is present ───────────────
{
  if (analysisSrc.match(/export\s+(const\s+MODULE_COPY|function\s+MODULE_COPY)/)) {
    fail("MODULE_COPY is a private constant and must not be exported from src/views/analysis.jsx");
  }
  if (!analysisSrc.includes("MODULE_COPY")) {
    fail("src/views/analysis.jsx must still define the MODULE_COPY constant");
  }
}

// ── 11. Private helpers are not exported ────────────────────────────────────
{
  const privateNames = [
    "moduleCopy", "classOf",
    "OptStat", "BigStat",
    "fmtNewsDate", "normalizeNewsItem",
    "ProfRow", "companyDisplay",
    "SrcItem", "proxyHealthDisplay", "marketHistoryDisplay", "referenceDataDisplay",
  ];
  for (const name of privateNames) {
    if (analysisSrc.match(new RegExp(`export\\s+(function|const|class)\\s+${name}\\b`))) {
      fail(`"${name}" is a private helper and must not be exported from src/views/analysis.jsx`);
    }
    if (!analysisSrc.includes(name)) {
      fail(`src/views/analysis.jsx must define the private helper "${name}"`);
    }
  }
}

// ── 12. No Object.assign(window, ...) in src/views/analysis.jsx ───────────
{
  if (analysisSrc.includes("Object.assign(window")) {
    fail("src/views/analysis.jsx must NOT have Object.assign(window, ...) — that belongs only in the legacy shim");
  }
}

// ── 13. npm React import required (Phase 6i-prep: window.React no longer relied on) ──
{
  if (!analysisSrc.includes('from "react"') && !analysisSrc.includes("from 'react'")) {
    fail("src/views/analysis.jsx must import React from the npm package (not window.React UMD global)");
  }
}

// ── 14. window.DATA_SOURCES removed — only imported DATA_SOURCES used ─────
{
  // CompanyTab's news fetch must use imported DATA_SOURCES, not window.DATA_SOURCES
  if (analysisSrc.includes("window.DATA_SOURCES")) {
    fail('src/views/analysis.jsx must not reference window.DATA_SOURCES — use the imported DATA_SOURCES constant');
  }
}

// ── 15. Rate-limit handling is present (newsRateLimit copy key) ───────────
{
  if (!analysisSrc.includes("newsRateLimit")) {
    fail('src/views/analysis.jsx must include newsRateLimit copy key (required for rate-limit UI handling)');
  }
}

// ── 16. Non-advisory copy key present (newsContextNote) ───────────────────
{
  if (!analysisSrc.includes("newsContextNote")) {
    fail('src/views/analysis.jsx must include newsContextNote copy key (required for non-advisory footer)');
  }
  // The actual TR/EN copy must not contain advisory language.
  // "advice" is intentionally excluded from the banned list because
  // the copy contains the non-advisory disclaimer "not financial advice".
  const ctxStart = analysisSrc.indexOf("newsContextNote");
  const ctxBlock = analysisSrc.slice(ctxStart, ctxStart + 200);
  const advisory = ["buy", "sell", "recommendation", "target price"];
  for (const word of advisory) {
    if (ctxBlock.toLowerCase().includes(word)) {
      fail(`newsContextNote copy must not contain advisory language — found: "${word}"`);
    }
  }
}

// ── 17. public/legacy/views-analysis.jsx unchanged — all 5 window exports ─
{
  const legacyPath = path.join(root, "public", "legacy", "views-analysis.jsx");
  if (!fs.existsSync(legacyPath)) fail("public/legacy/views-analysis.jsx must still exist (legacy shim)");
  const legacySrc = fs.readFileSync(legacyPath, "utf8");
  const assignBlock = legacySrc.slice(legacySrc.lastIndexOf("Object.assign(window"));
  if (!assignBlock) fail("public/legacy/views-analysis.jsx must contain Object.assign(window, {...}) at the end");
  const expectedWindowExports = ["AnalysisTab", "OptimizationTab", "SimulationTab", "CompanyTab", "DataTab"];
  for (const name of expectedWindowExports) {
    if (!assignBlock.includes(name)) {
      fail(`public/legacy/views-analysis.jsx window export "${name}" missing from Object.assign block`);
    }
  }
}

// ── 18. Export count — exactly 5 named exports ────────────────────────────
{
  const fnExports    = [...analysisSrc.matchAll(/^export function (\w+)/mg)].map(m => m[1]);
  const constExports = [...analysisSrc.matchAll(/^export const (\w+)/mg)].map(m => m[1]);
  const allExports   = [...fnExports, ...constExports];
  if (allExports.length !== 5) {
    fail(`src/views/analysis.jsx should have exactly 5 named exports, found ${allExports.length}: ${allExports.join(", ")}`);
  }
  const expectedSet = new Set(["AnalysisTab", "OptimizationTab", "SimulationTab", "CompanyTab", "DataTab"]);
  for (const name of allExports) {
    if (!expectedSet.has(name)) {
      fail(`Unexpected export found in src/views/analysis.jsx: "${name}"`);
    }
  }
}

console.log("analysis checks passed");
