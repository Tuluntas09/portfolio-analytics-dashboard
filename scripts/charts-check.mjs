/**
 * charts-check.mjs — verifies src/charts.jsx exports the expected SVG chart components.
 *
 * Node.js cannot parse JSX, so this script reads src/charts.jsx as source text.
 * Component exports, JSX pragma, private helper privacy, and the public/legacy/charts.jsx
 * window export list are all verified via text analysis.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

// ── 1. src/charts.jsx exists ───────────────────────────────────────────────
{
  const chartsJsxPath = path.join(root, "src", "charts.jsx");
  if (!fs.existsSync(chartsJsxPath)) fail("src/charts.jsx must exist");
}

const chartsSrc = fs.readFileSync(path.join(root, "src", "charts.jsx"), "utf8");

// ── 2. All 8 chart components are exported ─────────────────────────────────
{
  const expectedComponents = [
    "GrowthChart", "Donut", "HBars", "VBars",
    "MiniLine", "Heatmap", "FanChart", "Histogram",
  ];
  for (const name of expectedComponents) {
    if (!chartsSrc.includes(`export function ${name}`)) {
      fail(`src/charts.jsx must export function ${name}`);
    }
  }
}

// ── 3. JSX pragma is present (classic mode — global React) ─────────────────
{
  if (!chartsSrc.includes("@jsx React.createElement")) {
    fail("src/charts.jsx must have @jsx pragma pointing at React.createElement");
  }
}

// ── 4. Private helpers extent and pathFrom are NOT exported ────────────────
{
  const exportedExtent   = /export\s+(function\s+extent|const\s+extent)/.test(chartsSrc);
  const exportedPathFrom = /export\s+(function\s+pathFrom|const\s+pathFrom)/.test(chartsSrc);
  if (exportedExtent)   fail("extent() is a private helper and must not be exported from src/charts.jsx");
  if (exportedPathFrom) fail("pathFrom() is a private helper and must not be exported from src/charts.jsx");
  // Sanity: they must still be defined somewhere in the file
  if (!chartsSrc.includes("function extent"))   fail("src/charts.jsx must define extent() helper");
  if (!chartsSrc.includes("function pathFrom")) fail("src/charts.jsx must define pathFrom() helper");
}

// ── 5. Uses React destructuring at module top ─────────────────────────────
{
  if (!chartsSrc.includes("const { useState") || !chartsSrc.includes("} = React;")) {
    fail('src/charts.jsx must destructure React hooks with "const { ... } = React;"');
  }
}

// ── 6. No Object.assign(window, ...) in src/charts.jsx ────────────────────
{
  if (chartsSrc.includes("Object.assign(window")) {
    fail("src/charts.jsx must NOT have Object.assign(window, ...) — that belongs only in the legacy shim");
  }
}

// ── 7. public/legacy/charts.jsx is unchanged — all 8 window exports present
{
  const legacyPath = path.join(root, "public", "legacy", "charts.jsx");
  if (!fs.existsSync(legacyPath)) fail("public/legacy/charts.jsx must still exist (legacy shim)");
  const legacySrc = fs.readFileSync(legacyPath, "utf8");
  const assignBlock = legacySrc.slice(legacySrc.lastIndexOf("Object.assign(window"));
  if (!assignBlock) fail("public/legacy/charts.jsx must contain Object.assign(window, {...}) at the end");
  const expectedExports = [
    "GrowthChart", "Donut", "HBars", "VBars",
    "MiniLine", "Heatmap", "FanChart", "Histogram",
  ];
  for (const name of expectedExports) {
    if (!assignBlock.includes(name)) {
      fail(`public/legacy/charts.jsx window export "${name}" missing from Object.assign block`);
    }
  }
}

// ── 8. npm React import required (Phase 6i-prep: window.React no longer relied on) ──
{
  if (!chartsSrc.includes('from "react"') && !chartsSrc.includes("from 'react'")) {
    fail('src/charts.jsx must import React from the npm package (not window.React UMD global)');
  }
}

// ── 9. CSS custom properties are used for theming (no hardcoded hex colors) -
{
  // The charts must use CSS vars for primary theming
  if (!chartsSrc.includes("var(--accent)")) {
    fail('src/charts.jsx must use CSS custom properties (var(--accent)) for theming');
  }
  if (!chartsSrc.includes("var(--grid)")) {
    fail('src/charts.jsx must use CSS custom properties (var(--grid)) for grid lines');
  }
}

// ── 10. Export count — exactly 8 named component exports (no extras) ───────
{
  const exportMatches = [...chartsSrc.matchAll(/^export function (\w+)/mg)].map(m => m[1]);
  if (exportMatches.length !== 8) {
    fail(`src/charts.jsx should have exactly 8 exported functions, found ${exportMatches.length}: ${exportMatches.join(", ")}`);
  }
}

// ── Phase 12c: Responsive chart sizing ────────────────────────────────────

// ── 11. SVG chart components must not use a raw pixel integer as the SVG width ──
{
  // All scale-to-container charts should use width="100%" (or a prop-driven value).
  // A pattern like width={760} on an SVG element would be a hardcoded pixel width
  // that ignores the container — catch any such regression.
  if (/width=\{\d+\}/.test(chartsSrc)) {
    fail('src/charts.jsx must not use a raw numeric literal as an SVG width attribute — use width="100%" for scalable charts');
  }
}

// ── 12. Overview view uses chart-responsive wrapper ────────────────────────
{
  const overviewPath = path.join(root, "src", "views", "overview.jsx");
  if (!fs.existsSync(overviewPath)) fail("src/views/overview.jsx must exist");
  const overviewSrc = fs.readFileSync(overviewPath, "utf8");
  if (!overviewSrc.includes("chart-responsive")) {
    fail('src/views/overview.jsx must use className="chart-responsive" wrapper around chart call sites (Phase 12c)');
  }
  if (!overviewSrc.includes("useContainerWidth")) {
    fail("src/views/overview.jsx must define useContainerWidth hook (Phase 12c)");
  }
}

// ── 13. Analysis view uses chart-responsive wrapper ────────────────────────
{
  const analysisPath = path.join(root, "src", "views", "analysis.jsx");
  if (!fs.existsSync(analysisPath)) fail("src/views/analysis.jsx must exist");
  const analysisSrc = fs.readFileSync(analysisPath, "utf8");
  if (!analysisSrc.includes("chart-responsive")) {
    fail('src/views/analysis.jsx must use className="chart-responsive" wrapper around chart call sites (Phase 12c)');
  }
  if (!analysisSrc.includes("useContainerWidth")) {
    fail("src/views/analysis.jsx must define useContainerWidth hook (Phase 12c)");
  }
}

console.log("charts checks passed");
