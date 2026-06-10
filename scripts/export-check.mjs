/**
 * export-check.mjs — source-level tests for Phase 8c (Print Report).
 *
 * Runs in Node.js. Checks src/app.jsx and src/ui.js for required patterns.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

let passed = 0;
function pass(label) { passed++; console.log("  ✓", label); }

const appSrc = fs.readFileSync(path.join(root, "src", "app.jsx"), "utf8");
const uiSrc = fs.readFileSync(path.join(root, "src", "ui.js"), "utf8");
const appCheckSrc = fs.readFileSync(path.join(root, "scripts", "app-check.mjs"), "utf8");

// ── 1. handlePrintReport defined in app.jsx ──────────────────────────────────
{
  if (!appSrc.includes("function handlePrintReport")) fail("app.jsx must define handlePrintReport function");
  pass("handlePrintReport function defined");
}

// ── 2. window.print() called inside handlePrintReport ───────────────────────
{
  if (!appSrc.includes("window.print()")) fail("app.jsx must call window.print()");
  pass("window.print() called");
}

// ── 3. export-mode class added before print ──────────────────────────────────
{
  const fnMatch = appSrc.match(/function handlePrintReport\s*\(\s*\)\s*\{([^}]+)\}/s);
  if (!fnMatch) fail("Could not locate handlePrintReport body");
  const body = fnMatch[1];
  if (!body.includes("export-mode")) fail("handlePrintReport must add export-mode class");
  pass("export-mode class added in handlePrintReport");
}

// ── 4. afterprint cleanup listener present ───────────────────────────────────
{
  if (!appSrc.includes("afterprint")) fail("app.jsx must register an afterprint cleanup listener");
  pass("afterprint cleanup listener registered");
}

// ── 5. print-btn class rendered in topbar ────────────────────────────────────
{
  if (!appSrc.includes("print-btn")) fail("app.jsx must render a .print-btn element");
  pass(".print-btn rendered in topbar");
}

// ── 6. @media print block present with sidebar hidden ───────────────────────
{
  if (!appSrc.includes("@media print")) fail("app.jsx must include @media print CSS block");
  if (!appSrc.includes(".sidebar { display: none")) fail("@media print must hide .sidebar");
  pass("@media print block hides sidebar");
}

// ── 7. printReport i18n key present in EN locale ─────────────────────────────
{
  const enBlock = uiSrc.slice(0, uiSrc.indexOf("tr: {"));
  if (!enBlock.includes("printReport:")) fail("ui.js EN locale must have printReport key");
  pass("printReport key present in EN locale");
}

// ── 8. printReport i18n key present in TR locale ─────────────────────────────
{
  const trStart = uiSrc.indexOf("tr: {");
  const trBlock = uiSrc.slice(trStart);
  if (!trBlock.includes("printReport:")) fail("ui.js TR locale must have printReport key");
  pass("printReport key present in TR locale");
}

// ── 9. app-check.mjs allows window.print ────────────────────────────────────
{
  if (!appCheckSrc.includes('"window.print"')) fail('app-check.mjs test 23 must include "window.print" in allowedPatterns');
  pass('app-check.mjs allowedPatterns includes "window.print"');
}

// ── 10. Legacy export hooks still present (regression) ──────────────────────
{
  if (!appSrc.includes("window.__exportTab")) fail("window.__exportTab must still be present");
  if (!appSrc.includes("window.__exportDone")) fail("window.__exportDone must still be present");
  pass("legacy window.__exportTab and window.__exportDone preserved");
}

// ── 11. print-header element present in app.jsx JSX ────────────────────────
{
  if (!appSrc.includes('className="print-header"'))
    fail('app.jsx must render a <div className="print-header"> element');
  pass('print-header element present in app.jsx JSX');
}

// ── 12. print-header hidden on screen ───────────────────────────────────────
{
  if (!appSrc.includes('.print-header { display: none'))
    fail('app.jsx must set .print-header { display: none } in screen CSS');
  pass('.print-header display:none in screen CSS');
}

// ── 13. print-header shown in @media print ──────────────────────────────────
{
  const printBlock = appSrc.slice(appSrc.indexOf('@media print'));
  if (!printBlock.includes('.print-header'))
    fail('@media print block must reference .print-header');
  pass('.print-header visible in @media print');
}

// ── 14. rate-limit-banner hidden in @media print ────────────────────────────
{
  const printBlock = appSrc.slice(appSrc.indexOf('@media print'));
  if (!printBlock.includes('.rate-limit-banner'))
    fail('@media print must hide .rate-limit-banner');
  pass('.rate-limit-banner hidden in @media print');
}

// ── 15. @page margin rule present ───────────────────────────────────────────
{
  if (!appSrc.includes('@page'))
    fail('app.jsx must include an @page margin rule in @media print');
  pass('@page rule present');
}

// ── 16. page-break-inside: avoid on .card ───────────────────────────────────
{
  if (!appSrc.includes('page-break-inside: avoid') && !appSrc.includes('break-inside: avoid'))
    fail('app.jsx @media print must set page-break-inside:avoid on .card');
  pass('page-break-inside: avoid set for print');
}

// ── 17. print CSS var overrides present ─────────────────────────────────────
{
  if (!appSrc.includes('--bg: #ffffff'))
    fail('app.jsx @media print must override --bg to #ffffff');
  pass('@media print overrides --bg to #ffffff');
}

// ── 18. benchmark reference in print header ─────────────────────────────────
{
  if (!appSrc.includes('{benchmark}'))
    fail('app.jsx print-header must include {benchmark}');
  pass('print-header references {benchmark}');
}

// ── 19. disclaimer i18n key used in print header ────────────────────────────
{
  if (!appSrc.includes('printHeaderDisclaimer'))
    fail('app.jsx print-header must use t(language, "printHeaderDisclaimer")');
  pass('printHeaderDisclaimer key used in print-header');
}

// ── 20. printHeaderDisclaimer key in EN locale ──────────────────────────────
{
  const enBlock = uiSrc.slice(0, uiSrc.indexOf('tr: {'));
  if (!enBlock.includes('printHeaderDisclaimer:'))
    fail('ui.js EN locale must have printHeaderDisclaimer key');
  pass('printHeaderDisclaimer key in EN locale');
}

// ── 21. printHeaderDisclaimer key in TR locale ──────────────────────────────
{
  const trStart = uiSrc.indexOf('tr: {');
  const trBlock = uiSrc.slice(trStart);
  if (!trBlock.includes('printHeaderDisclaimer:'))
    fail('ui.js TR locale must have printHeaderDisclaimer key');
  pass('printHeaderDisclaimer key in TR locale');
}

// ── 22. printHeaderTitle key in EN locale ───────────────────────────────────
{
  const enBlock = uiSrc.slice(0, uiSrc.indexOf('tr: {'));
  if (!enBlock.includes('printHeaderTitle:'))
    fail('ui.js EN locale must have printHeaderTitle key');
  pass('printHeaderTitle key in EN locale');
}

// ── 23. printHeaderTitle key in TR locale ───────────────────────────────────
{
  const trStart = uiSrc.indexOf('tr: {');
  const trBlock = uiSrc.slice(trStart);
  if (!trBlock.includes('printHeaderTitle:'))
    fail('ui.js TR locale must have printHeaderTitle key');
  pass('printHeaderTitle key in TR locale');
}

// ── done ─────────────────────────────────────────────────────────────────────
console.log(`\nexport checks: ${passed} passed`);
