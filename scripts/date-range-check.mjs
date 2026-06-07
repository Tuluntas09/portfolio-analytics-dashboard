/**
 * date-range-check.mjs — tests for Phase 8d (custom date range).
 *
 * Imports pure functions from src/dateUtils.js and does source-text
 * analysis of app.jsx and sidebar.jsx for integration checks.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultCustomFrom, validateDateRange, calendarToTradingDays } from "../src/dateUtils.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

let passed = 0;
function pass(label) { passed++; console.log("  ✓", label); }

const appSrc  = fs.readFileSync(path.join(root, "src", "app.jsx"),     "utf8");
const sbSrc   = fs.readFileSync(path.join(root, "src", "sidebar.jsx"), "utf8");
const uiSrc   = fs.readFileSync(path.join(root, "src", "ui.js"),       "utf8");

// ── 1. getDefaultCustomFrom returns a date ~900 days ago ────────────────────
{
  const result = getDefaultCustomFrom();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) fail(`getDefaultCustomFrom must return YYYY-MM-DD, got "${result}"`);
  const today = new Date();
  const resultDate = new Date(result);
  const diffDays = (today - resultDate) / (1000 * 60 * 60 * 24);
  if (diffDays < 895 || diffDays > 905) fail(`getDefaultCustomFrom should be ~900 days ago, got ${Math.round(diffDays)} days`);
  pass("getDefaultCustomFrom returns a date approximately 900 days ago");
}

// ── 2. validateDateRange accepts a valid 30+ day range ──────────────────────
{
  const err = validateDateRange("2024-01-01", "2025-01-01");
  if (err !== null) fail(`Valid range should return null, got "${err}"`);
  pass("validateDateRange returns null for a valid 365-day range");
}

// ── 3. validateDateRange rejects start date after end date ──────────────────
{
  const err = validateDateRange("2025-06-01", "2024-06-01");
  if (err !== "dateRangeStartAfterEnd") fail(`Expected "dateRangeStartAfterEnd", got "${err}"`);
  pass("validateDateRange rejects start >= end (dateRangeStartAfterEnd)");
}

// ── 4. validateDateRange rejects future end date ─────────────────────────────
{
  const futureDate = new Date();
  futureDate.setUTCDate(futureDate.getUTCDate() + 30);
  const toStr = futureDate.toISOString().slice(0, 10);
  const fromStr = "2024-01-01";
  const err = validateDateRange(fromStr, toStr);
  if (err !== "dateRangeFutureEnd") fail(`Expected "dateRangeFutureEnd", got "${err}"`);
  pass("validateDateRange rejects end date in the future (dateRangeFutureEnd)");
}

// ── 5. validateDateRange rejects ranges shorter than 30 days ─────────────────
{
  const err = validateDateRange("2025-01-01", "2025-01-15");
  if (err !== "dateRangeTooShort") fail(`Expected "dateRangeTooShort", got "${err}"`);
  pass("validateDateRange rejects ranges < 30 days (dateRangeTooShort)");
}

// ── 6. validateDateRange rejects missing / empty dates ───────────────────────
{
  const e1 = validateDateRange("", "2025-01-01");
  const e2 = validateDateRange("2024-01-01", "");
  const e3 = validateDateRange("", "");
  if (e1 !== "dateRangeMissing") fail(`Expected "dateRangeMissing" for empty from, got "${e1}"`);
  if (e2 !== "dateRangeMissing") fail(`Expected "dateRangeMissing" for empty to, got "${e2}"`);
  if (e3 !== "dateRangeMissing") fail(`Expected "dateRangeMissing" for both empty, got "${e3}"`);
  pass("validateDateRange rejects empty / missing dates (dateRangeMissing)");
}

// ── 7. calendarToTradingDays returns ~252 for a full year ────────────────────
{
  const days = calendarToTradingDays("2024-01-01", "2025-01-01");
  // 365 calendar days × 5/7 ≈ 261; allow ±5 margin
  if (days < 256 || days > 266) fail(`calendarToTradingDays for 1Y should be ~261, got ${days}`);
  pass(`calendarToTradingDays("2024-01-01","2025-01-01") = ${days} (expected ~261)`);
}

// ── 8. calendarToTradingDays enforces minimum of 30 ─────────────────────────
{
  const days = calendarToTradingDays("2025-01-01", "2025-01-05");
  if (days < 30) fail(`calendarToTradingDays minimum is 30, got ${days}`);
  pass("calendarToTradingDays min bound is 30 trading days");
}

// ── 9. app.jsx imports from ./dateUtils.js ───────────────────────────────────
{
  if (!appSrc.includes('./dateUtils.js"') && !appSrc.includes("./dateUtils.js'")) {
    fail("src/app.jsx must import from ./dateUtils.js");
  }
  if (!appSrc.includes("getDefaultCustomFrom")) fail("src/app.jsx must import getDefaultCustomFrom");
  if (!appSrc.includes("calendarToTradingDays")) fail("src/app.jsx must import calendarToTradingDays");
  pass("app.jsx imports getDefaultCustomFrom and calendarToTradingDays from ./dateUtils.js");
}

// ── 10. app.jsx passes customFrom/customTo as Sidebar props ─────────────────
{
  if (!appSrc.includes("customFrom={customFrom}")) fail("app.jsx must pass customFrom prop to Sidebar");
  if (!appSrc.includes("customTo={customTo}"))   fail("app.jsx must pass customTo prop to Sidebar");
  if (!appSrc.includes("setCustomFrom={setCustomFrom}")) fail("app.jsx must pass setCustomFrom prop to Sidebar");
  if (!appSrc.includes("setCustomTo={setCustomTo}"))   fail("app.jsx must pass setCustomTo prop to Sidebar");
  pass("app.jsx passes customFrom/customTo and setters as props to Sidebar");
}

// ── 11. app.jsx calls historyWindow with 3 args (dateRange, customFrom, customTo) ──
{
  if (!appSrc.includes("historyWindow(dateRange, customFrom, customTo)")) {
    fail("app.jsx must call historyWindow(dateRange, customFrom, customTo)");
  }
  pass("app.jsx calls historyWindow with dateRange, customFrom, customTo");
}

// ── 12. app.jsx uses calendarToTradingDays in useMemo ───────────────────────
{
  if (!appSrc.includes("calendarToTradingDays(customFrom, customTo)")) {
    fail("app.jsx must call calendarToTradingDays(customFrom, customTo) in useMemo");
  }
  pass("app.jsx uses calendarToTradingDays in buildPortfolio useMemo");
}

// ── 13. All 5 validation i18n keys present in EN ─────────────────────────────
{
  const enBlock = uiSrc.slice(0, uiSrc.indexOf("tr: {"));
  const keys = ["customDateRange", "dateRangeMissing", "dateRangeStartAfterEnd", "dateRangeFutureEnd", "dateRangeTooShort"];
  for (const k of keys) {
    if (!enBlock.includes(`${k}:`)) fail(`EN locale missing i18n key: ${k}`);
  }
  pass("All 5 date-range i18n keys present in EN locale");
}

// ── 14. All 5 validation i18n keys present in TR ─────────────────────────────
{
  const trStart = uiSrc.indexOf("tr: {");
  const trBlock = uiSrc.slice(trStart);
  const keys = ["customDateRange", "dateRangeMissing", "dateRangeStartAfterEnd", "dateRangeFutureEnd", "dateRangeTooShort"];
  for (const k of keys) {
    if (!trBlock.includes(`${k}:`)) fail(`TR locale missing i18n key: ${k}`);
  }
  pass("All 5 date-range i18n keys present in TR locale");
}

// ── 15. sidebar.jsx imports validateDateRange from ./dateUtils.js ────────────
{
  if (!sbSrc.includes('./dateUtils.js"') && !sbSrc.includes("./dateUtils.js'")) {
    fail("src/sidebar.jsx must import from ./dateUtils.js");
  }
  if (!sbSrc.includes("validateDateRange")) fail("src/sidebar.jsx must use validateDateRange");
  pass("sidebar.jsx imports and uses validateDateRange from ./dateUtils.js");
}

// ── 16. sidebar.jsx renders <input type="date"> fields for Custom ────────────
{
  if (!sbSrc.includes('type="date"')) fail('src/sidebar.jsx must render <input type="date"> for custom range');
  if (!sbSrc.includes("date-input")) fail("src/sidebar.jsx must apply .date-input class to date inputs");
  if (!sbSrc.includes("date-error")) fail("src/sidebar.jsx must render .date-error validation message");
  pass("sidebar.jsx renders date inputs and validation message for Custom preset");
}

// ── 17. rangeStart remains defined (private helper, not exported) ─────────────
{
  if (!sbSrc.includes("function rangeStart")) fail("sidebar.jsx must still define rangeStart private helper");
  if (sbSrc.includes("export function rangeStart") || sbSrc.includes("export const rangeStart")) {
    fail("rangeStart must not be exported from sidebar.jsx");
  }
  pass("rangeStart is still defined and remains private (not exported)");
}

// ── 18. Existing export hooks unchanged (regression check) ───────────────────
{
  if (!appSrc.includes("window.__exportTab")) fail("window.__exportTab must still be present");
  if (!appSrc.includes("window.__exportDone")) fail("window.__exportDone must still be present");
  pass("window.__exportTab and window.__exportDone are preserved");
}

// ── 19. Saved portfolio schema unchanged (no date range in saves) ─────────────
{
  const storageSrc = fs.readFileSync(path.join(root, "src", "portfolioStorage.js"), "utf8");
  if (storageSrc.includes("customFrom") || storageSrc.includes("customTo")) {
    fail("portfolioStorage.js must not include customFrom/customTo — date range is not part of saved schema");
  }
  if (!storageSrc.includes("schemaVersion")) fail("portfolioStorage.js must still define schemaVersion");
  pass("Saved portfolio schema unchanged: no date range fields, schemaVersion preserved");
}

// ── done ─────────────────────────────────────────────────────────────────────
console.log(`\ndate-range checks: ${passed} passed`);
