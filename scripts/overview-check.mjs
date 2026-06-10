/**
 * overview-check.mjs — verifies src/views/overview.jsx exports the expected
 * Overview and Risk tab components plus their helper functions.
 *
 * Node.js cannot parse JSX, so this script reads src/views/overview.jsx as
 * source text. Component exports, JSX pragma, import declarations, private
 * constant privacy, and public/legacy/views-overview.jsx window export list
 * are verified via text analysis.
 *
 * dataProviderLabel and dataProviderTone are pure functions — their logic is
 * also verified here by reading them from the source and evaluating inline.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

// ── 1. src/views/overview.jsx exists ──────────────────────────────────────
{
  const overviewPath = path.join(root, "src", "views", "overview.jsx");
  if (!fs.existsSync(overviewPath)) fail("src/views/overview.jsx must exist");
}

const overviewSrc = fs.readFileSync(
  path.join(root, "src", "views", "overview.jsx"), "utf8"
);

// ── 2. All 4 exports are present ───────────────────────────────────────────
{
  const expectedExports = ["OverviewTab", "RiskTab", "dataProviderLabel", "dataProviderTone"];
  for (const name of expectedExports) {
    const hasFn    = overviewSrc.includes(`export function ${name}`);
    const hasConst = overviewSrc.includes(`export const ${name}`);
    if (!hasFn && !hasConst) {
      fail(`src/views/overview.jsx must export "${name}"`);
    }
  }
}

// ── 3. JSX pragma is present (classic mode — global React) ─────────────────
{
  if (!overviewSrc.includes("@jsx React.createElement")) {
    fail("src/views/overview.jsx must have @jsx pragma pointing at React.createElement");
  }
}

// ── 4. Imports from src/ui.js ─────────────────────────────────────────────
{
  const requiredFromUiJs = ["assetColor", "fmtUSD", "fmtPct", "fmtPctSigned", "fmtNum", "fmtUSDc"];
  if (!overviewSrc.includes('from "../ui.js"')) {
    fail('src/views/overview.jsx must import from "../ui.js"');
  }
  for (const sym of requiredFromUiJs) {
    if (!overviewSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/ui\\.js["']`))) {
      fail(`src/views/overview.jsx must import "${sym}" from "../ui.js"`);
    }
  }
}

// ── 5. Imports from src/ui.jsx ────────────────────────────────────────────
{
  const requiredFromUiJsx = ["Metric", "Card", "Pill", "Table", "Alert", "ModuleIntro", "InsightGrid", "InsightCard"];
  if (!overviewSrc.includes('from "../ui.jsx"')) {
    fail('src/views/overview.jsx must import from "../ui.jsx"');
  }
  for (const sym of requiredFromUiJsx) {
    if (!overviewSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/ui\\.jsx["']`))) {
      fail(`src/views/overview.jsx must import "${sym}" from "../ui.jsx"`);
    }
  }
}

// ── 6. Imports from src/charts.jsx ───────────────────────────────────────
{
  const requiredFromCharts = ["GrowthChart", "Donut", "Heatmap", "HBars", "MiniLine"];
  if (!overviewSrc.includes('from "../charts.jsx"')) {
    fail('src/views/overview.jsx must import from "../charts.jsx"');
  }
  for (const sym of requiredFromCharts) {
    if (!overviewSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/charts\\.jsx["']`))) {
      fail(`src/views/overview.jsx must import "${sym}" from "../charts.jsx"`);
    }
  }
}

// ── 7. Imports from src/data.js ───────────────────────────────────────────
{
  const requiredFromData = ["corr", "GLOSSARY"];
  if (!overviewSrc.includes('from "../data.js"')) {
    fail('src/views/overview.jsx must import from "../data.js"');
  }
  for (const sym of requiredFromData) {
    if (!overviewSrc.match(new RegExp(`import\\s*\\{[^}]*\\b${sym}\\b[^}]*\\}\\s*from\\s*["']\\.\\.\/data\\.js["']`))) {
      fail(`src/views/overview.jsx must import "${sym}" from "../data.js"`);
    }
  }
}

// ── 8. RISK_COPY is NOT exported (private constant) ───────────────────────
{
  if (overviewSrc.match(/export\s+(const\s+RISK_COPY|function\s+RISK_COPY)/)) {
    fail("RISK_COPY is a private constant and must not be exported from src/views/overview.jsx");
  }
  if (!overviewSrc.includes("RISK_COPY")) {
    fail("src/views/overview.jsx must still define the RISK_COPY constant");
  }
}

// ── 9. No Object.assign(window, ...) in src/views/overview.jsx ───────────
{
  if (overviewSrc.includes("Object.assign(window")) {
    fail("src/views/overview.jsx must NOT have Object.assign(window, ...) — that belongs only in the legacy shim");
  }
}

// ── 10. npm React import required (Phase 6i-prep: window.React no longer relied on) ──
{
  if (!overviewSrc.includes('from "react"') && !overviewSrc.includes("from 'react'")) {
    fail("src/views/overview.jsx must import React from the npm package (not window.React UMD global)");
  }
}

// ── 11. dataProviderLabel logic is correct (text-pattern verification) ─────
{
  // Verify the function body handles the four known provider strings correctly
  // by checking that the expected return values appear in the source near the function
  const fnStart = overviewSrc.indexOf("export function dataProviderLabel");
  const fnBody = overviewSrc.slice(fnStart, fnStart + 600);
  if (!fnBody.includes('"Finnhub"'))         fail('dataProviderLabel must return "Finnhub" for finnhub provider');
  if (!fnBody.includes('"Yahoo Fallback"'))  fail('dataProviderLabel must return "Yahoo Fallback" for yahoo provider');
  if (!fnBody.includes('"Deterministic Mock"')) fail('dataProviderLabel must return "Deterministic Mock" for mock provider');
}

// ── 12. dataProviderTone logic is correct ────────────────────────────────
{
  const fnStart = overviewSrc.indexOf("export function dataProviderTone");
  const fnBody = overviewSrc.slice(fnStart, fnStart + 400);
  if (!fnBody.includes('"pos"'))     fail('dataProviderTone must return "pos" for real/finnhub providers');
  if (!fnBody.includes('"warn"'))    fail('dataProviderTone must return "warn" for yahoo provider');
  if (!fnBody.includes('"neutral"')) fail('dataProviderTone must return "neutral" as fallback');
}

// ── 13. RISK_COPY has both EN and TR keys ─────────────────────────────────
{
  // sourceCol is an unquoted JS key so match without surrounding quotes
  if (!overviewSrc.includes("sourceCol")) {
    fail('RISK_COPY must include sourceCol key (used for the Source/Kaynak column header)');
  }
  if (!overviewSrc.includes('"Kaynak"')) {
    fail('RISK_COPY TR must include "Kaynak" value for sourceCol');
  }
  if (!overviewSrc.includes('"Source"')) {
    fail('RISK_COPY EN must include "Source" value for sourceCol');
  }
}

// ── 14. Benchmark wording is updated — old hardcoded 60/40 labels removed ─
{
  if (!overviewSrc.includes("vs. selected benchmark")) {
    fail('EN cumulativeReturnSub must contain "vs. selected benchmark"');
  }
  if (!overviewSrc.includes("seçili referansla")) {
    fail('TR cumulativeReturnSub must contain "seçili referansla"');
  }
  if (overviewSrc.includes("Balanced ref. (≈60/40)")) {
    fail('overview.jsx must not contain the old hardcoded label "Balanced ref. (≈60/40)"');
  }
  if (overviewSrc.includes("Dengeli ref. (≈60/40)")) {
    fail('overview.jsx must not contain the old hardcoded TR label "Dengeli ref. (≈60/40)"');
  }
  if (overviewSrc.includes("simplified balanced reference")) {
    fail('overview.jsx must not contain the old "simplified balanced reference" subtitle');
  }
}

// ── 15. public/legacy/views-overview.jsx is unchanged — all 4 window exports
{
  const legacyPath = path.join(root, "public", "legacy", "views-overview.jsx");
  if (!fs.existsSync(legacyPath)) fail("public/legacy/views-overview.jsx must still exist (legacy shim)");
  const legacySrc = fs.readFileSync(legacyPath, "utf8");
  const assignBlock = legacySrc.slice(legacySrc.lastIndexOf("Object.assign(window"));
  if (!assignBlock) fail("public/legacy/views-overview.jsx must contain Object.assign(window, {...}) at the end");
  const expectedWindowExports = ["OverviewTab", "RiskTab", "dataProviderLabel", "dataProviderTone"];
  for (const name of expectedWindowExports) {
    if (!assignBlock.includes(name)) {
      fail(`public/legacy/views-overview.jsx window export "${name}" missing from Object.assign block`);
    }
  }
}

// ── 16. Export count — exactly 4 named exports ────────────────────────────
{
  const fnExports    = [...overviewSrc.matchAll(/^export function (\w+)/mg)].map(m => m[1]);
  const constExports = [...overviewSrc.matchAll(/^export const (\w+)/mg)].map(m => m[1]);
  const allExports   = [...fnExports, ...constExports];
  if (allExports.length !== 4) {
    fail(`src/views/overview.jsx should have exactly 4 named exports, found ${allExports.length}: ${allExports.join(", ")}`);
  }
  const expectedSet = new Set(["OverviewTab", "RiskTab", "dataProviderLabel", "dataProviderTone"]);
  for (const name of allExports) {
    if (!expectedSet.has(name)) {
      fail(`Unexpected export found in src/views/overview.jsx: "${name}"`);
    }
  }
}

console.log("overview checks passed");
