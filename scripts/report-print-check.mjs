/**
 * report-print-check.mjs — verifies Phase C print/report presentation.
 *
 * Static, deterministic checks (no DOM, no network) over the report
 * component (src/report.jsx), shared i18n copy (src/ui.js), and the
 * print CSS in src/app.jsx. The report is DESCRIPTIVE ONLY — these
 * checks also guard that no investment-advice language was introduced
 * and that report-only work did not touch financial/risk/provider/
 * import-export/saved-state logic files.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error("report-print-check FAILED: " + msg); };
let passed = 0;
const ok = msg => { passed++; if (process.env.VERBOSE) console.log("  ✓ " + msg); };

const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const reportSrc = read("src/report.jsx");
const uiSrc = read("src/ui.js");
const appSrc = read("src/app.jsx");

// ── 1. Report title + non-advisory line present ────────────────────────────
{
  if (!uiSrc.includes("Portfolio Analytics Report")) fail("EN report title missing");
  if (!uiSrc.includes("Portföy Analitik Raporu")) fail("TR report title missing");
  if (!uiSrc.includes("Personal analytics report — not investment advice.")) fail("EN non-advisory line missing");
  if (!uiSrc.includes("Kişisel analiz raporu — yatırım tavsiyesi değildir.")) fail("TR non-advisory line missing");
  if (!reportSrc.includes("reportNonAdvisory")) fail("report must render the non-advisory line");
  ok("report title and non-advisory line present (EN/TR)");
}

// ── 2. Required metadata labels present and rendered ───────────────────────
{
  const enLabels = ["Generated", "Benchmark", "Analysis period", "Portfolio"];
  const trLabels = ["Oluşturulma tarihi", "Kıyaslama", "Analiz dönemi", "Portföy"];
  for (const s of enLabels) if (!uiSrc.includes(s)) fail(`EN metadata label missing: "${s}"`);
  for (const s of trLabels) if (!uiSrc.includes(s)) fail(`TR metadata label missing: "${s}"`);
  for (const key of ["printHeaderGenerated", "printHeaderBenchmark", "reportAnalysisPeriod", "reportPortfolio"]) {
    if (!reportSrc.includes(key)) fail(`report must render metadata key: ${key}`);
  }
  // metadata values are wired from app.jsx
  for (const prop of ["generated=", "benchmark=", "period=", "dataSourceLabel="]) {
    if (!appSrc.includes(prop)) fail(`app.jsx must pass report prop: ${prop}`);
  }
  ok("metadata labels (generated/benchmark/period/portfolio) present and wired");
}

// ── 3. Section labels present (summary, metrics, allocation, holdings, notes,
//       methodology) and the report renders their keys ─────────────────────
{
  const sectionKeys = [
    "reportSecSummary", "reportSecMetrics", "reportSecAllocation",
    "reportSecHoldings", "reportSecNotes", "reportSecMethodology",
  ];
  for (const key of sectionKeys) {
    if (!uiSrc.includes(key)) fail(`i18n must define section key: ${key}`);
    if (!reportSrc.includes(key)) fail(`report must render section key: ${key}`);
  }
  const enSections = ["Portfolio Summary", "Performance & Risk Metrics", "Allocation & Exposure", "Holdings Detail", "Notes", "Methodology & Disclaimer"];
  const trSections = ["Portföy Özeti", "Performans ve Risk Metrikleri", "Dağılım ve Maruziyet", "Varlık Detayı", "Notlar", "Metodoloji ve Uyarı"];
  for (const s of enSections) if (!uiSrc.includes(s)) fail(`EN section label missing: "${s}"`);
  for (const s of trSections) if (!uiSrc.includes(s)) fail(`TR section label missing: "${s}"`);
  ok("all six report section labels present (EN/TR) and rendered");
}

// ── 4. Exposure analytics reused (pure helper), not recalculated ───────────
{
  if (!reportSrc.includes('from "./exposure.js"') || !reportSrc.includes("computeExposure")) {
    fail("report must reuse computeExposure from the pure exposure helper");
  }
  if (!reportSrc.includes("sectorExposure") || !reportSrc.includes("assetClassExposure")) {
    fail("report must surface sector and asset-class exposure");
  }
  ok("exposure analytics reuse the pure helper and print sector + asset-class");
}

// ── 5. Empty-state and notes handling ──────────────────────────────────────
{
  if (!uiSrc.includes("No holdings available for report.")) fail("EN empty-report state missing");
  if (!uiSrc.includes("Rapor için varlık bulunmuyor.")) fail("TR empty-report state missing");
  if (!reportSrc.includes("reportEmpty")) fail("report must render the empty state");
  // notes only when present
  if (!/note\s*&&\s*note\.trim\(\)/.test(reportSrc)) fail("notes section must render only when a note is present");
  ok("empty-state copy present; notes render only when present");
}

// ── 6. Disclaimer remains intact in the report ─────────────────────────────
{
  if (!uiSrc.includes("not financial advice. Past performance does not guarantee future results.")) {
    fail("existing EN print disclaimer must remain intact");
  }
  if (!reportSrc.includes("printHeaderDisclaimer")) fail("report must render the disclaimer");
  ok("existing disclaimer remains intact and is rendered in the report");
}

// ── 7. Print CSS includes safe page-break handling ─────────────────────────
{
  if (!appSrc.includes("@media print")) fail("print CSS block missing");
  if (!appSrc.includes("break-inside: avoid") || !appSrc.includes("page-break-inside: avoid")) {
    fail("print CSS must include break-inside / page-break-inside safety");
  }
  if (!appSrc.includes(".content { display: none !important; }")) {
    fail("print CSS must hide live dashboard content when printing the report");
  }
  if (!appSrc.includes(".report-doc { display: none; }")) {
    fail("report doc must be hidden on screen (print-only)");
  }
  ok("print CSS hides live content, reveals report, and guards page breaks");
}

// ── 8. No investment-advice language introduced in report copy ─────────────
{
  // Scan only user-facing copy, not code identifiers or source comments:
  //   - the REPORT_COPY localized label object in report.jsx
  //   - the report-specific i18n value lines in ui.js
  const copyBlockMatch = reportSrc.match(/const REPORT_COPY = \{[\s\S]*?\n\};/);
  if (!copyBlockMatch) fail("could not locate REPORT_COPY block for copy scan");
  const reportI18n = uiSrc.split("\n").filter(l => /report(Brand|NonAdvisory|Portfolio|AnalysisPeriod|Proxy|Sec|Empty|Methodology)/.test(l)).join(" ");
  const corpus = (copyBlockMatch[0] + " " + reportI18n).toLowerCase();
  const banned = [
    "recommend", "recommended", "suggest", "suggested", "target price",
    "opportunity", "best allocation", "safe portfolio", "model portfolio",
    "guaranteed", "real-time guaranteed",
  ];
  for (const w of banned) {
    if (corpus.includes(w)) fail(`banned advice phrase "${w}" found in report copy`);
  }
  // standalone buy/sell/hold as words (avoid false positives like "holdings", "household")
  for (const w of ["buy", "sell", "hold"]) {
    if (new RegExp(`\\b${w}\\b`, "i").test(corpus)) {
      fail(`banned advice word "${w}" found in report copy`);
    }
  }
  ok("report copy contains no investment-advice language");
}

// ── 9. Report is descriptive only — no provider/network/storage logic ──────
{
  for (const marker of ["fetch(", "http://", "https://", "XMLHttpRequest", "localStorage"]) {
    if (reportSrc.includes(marker)) fail(`report.jsx must stay presentation-only — found "${marker}"`);
  }
  for (const bad of ["./data.js", "./portfolioStorage.js", "./portfolioBackup.js", "./activePortfolioState.js", "./holdingsCsv.js"]) {
    if (reportSrc.includes(bad)) fail(`report.jsx must not import logic module: ${bad}`);
  }
  ok("report.jsx is presentation-only (no provider/network/storage logic)");
}

// ── 10. Report-only work did not modify protected logic files ──────────────
{
  // these files must not reference the new report component / report markup
  const protectedFiles = [
    "src/data.js", "src/exposure.js", "src/portfolioStorage.js",
    "src/portfolioBackup.js", "src/activePortfolioState.js", "src/holdingsCsv.js",
    "src/portfolioSnapshots.js", "src/dataStatus.js",
  ];
  for (const rel of protectedFiles) {
    const src = read(rel);
    if (src.includes("ReportDocument") || src.includes("report-doc")) {
      fail(`protected logic file changed for report work: ${rel}`);
    }
  }
  ok("no financial/risk/provider/import-export/saved-state logic touched for report");
}

console.log(`report-print checks passed (${passed} assertions)`);
