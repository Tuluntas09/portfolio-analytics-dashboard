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

// ── done ─────────────────────────────────────────────────────────────────────
console.log(`\nexport checks: ${passed} passed`);
