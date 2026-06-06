/**
 * ui-check.mjs — verifies src/ui.js exports the expected UI primitives.
 *
 * Node.js cannot parse JSX, so this script imports from src/ui.js (pure JS).
 * The React component exports live in src/ui.jsx (browser-only); their
 * existence is verified via file-system check, not import.
 * The public/legacy/ui.jsx window export list is verified by reading the
 * source text, ensuring the legacy shim has not accidentally lost any symbol.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  fmtPct, fmtPctSigned, fmtUSD, fmtUSDc, fmtNum,
  SERIES_COLORS, assetColor,
  I18N, t,
} from "../src/ui.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

// ── 1. fmtPct ──────────────────────────────────────────────────────────────
{
  if (fmtPct(0.125) !== "12.5%") fail(`fmtPct(0.125) → expected "12.5%", got "${fmtPct(0.125)}"`);
  // negative uses Unicode minus U+2212, not ASCII hyphen
  const neg = fmtPct(-0.05);
  if (!neg.endsWith("5.0%")) fail(`fmtPct(-0.05) → should end with "5.0%", got "${neg}"`);
  if (neg.startsWith("-"))   fail(`fmtPct(-0.05) → should use Unicode minus "−", not ASCII "-"`);
}

// ── 2. fmtPctSigned ────────────────────────────────────────────────────────
{
  if (fmtPctSigned(0.125) !== "+12.5%") fail(`fmtPctSigned(0.125) → expected "+12.5%", got "${fmtPctSigned(0.125)}"`);
  const neg = fmtPctSigned(-0.05);
  if (!neg.endsWith("5.0%")) fail(`fmtPctSigned(-0.05) → should end with "5.0%", got "${neg}"`);
  if (neg.startsWith("-"))   fail(`fmtPctSigned(-0.05) → should use Unicode minus "−", not ASCII "-"`);
}

// ── 3. fmtUSD ──────────────────────────────────────────────────────────────
{
  const r = fmtUSD(1234567);
  if (!r.startsWith("$")) fail(`fmtUSD(1234567) → should start with "$", got "${r}"`);
  if (!r.includes("234")) fail(`fmtUSD(1234567) → should include the numeric digits, got "${r}"`);
  if (fmtUSD(0) !== "$0") fail(`fmtUSD(0) → expected "$0", got "${fmtUSD(0)}"`);
}

// ── 4. fmtUSDc ─────────────────────────────────────────────────────────────
{
  const r = fmtUSDc(99.9);
  if (!r.startsWith("$")) fail(`fmtUSDc(99.9) → should start with "$", got "${r}"`);
  if (!r.includes("99.90")) fail(`fmtUSDc(99.9) → should include "99.90", got "${r}"`);
  if (!fmtUSDc(1.005).includes(".00") && !fmtUSDc(1.005).includes(".01")) {
    fail(`fmtUSDc(1.005) → result "${fmtUSDc(1.005)}" looks wrong`);
  }
}

// ── 5. fmtNum ──────────────────────────────────────────────────────────────
{
  if (fmtNum(3.14159) !== "3.14") fail(`fmtNum(3.14159) → expected "3.14", got "${fmtNum(3.14159)}"`);
  if (fmtNum(1.0, 3) !== "1.000") fail(`fmtNum(1.0, 3) → expected "1.000", got "${fmtNum(1.0, 3)}"`);
  if (fmtNum(0, 0) !== "0") fail(`fmtNum(0, 0) → expected "0", got "${fmtNum(0, 0)}"`);
}

// ── 6. SERIES_COLORS ───────────────────────────────────────────────────────
{
  if (!Array.isArray(SERIES_COLORS)) fail("SERIES_COLORS must be an array");
  if (SERIES_COLORS.length < 6) fail(`SERIES_COLORS should have ≥6 entries, got ${SERIES_COLORS.length}`);
  if (!SERIES_COLORS[0].includes("var(--accent)")) {
    fail(`SERIES_COLORS[0] should be "var(--accent)", got "${SERIES_COLORS[0]}"`);
  }
  if (!SERIES_COLORS[1].includes("var(--accent-2)")) {
    fail(`SERIES_COLORS[1] should be "var(--accent-2)", got "${SERIES_COLORS[1]}"`);
  }
}

// ── 7. assetColor wraps modulo ─────────────────────────────────────────────
{
  if (assetColor(0) !== SERIES_COLORS[0]) fail("assetColor(0) should return SERIES_COLORS[0]");
  if (assetColor(1) !== SERIES_COLORS[1]) fail("assetColor(1) should return SERIES_COLORS[1]");
  if (assetColor(SERIES_COLORS.length) !== SERIES_COLORS[0]) {
    fail("assetColor should wrap around via modulo");
  }
}

// ── 8. I18N structure ──────────────────────────────────────────────────────
{
  if (typeof I18N !== "object" || I18N === null) fail("I18N must be a plain object");
  if (!I18N.en) fail("I18N must have an 'en' key");
  if (!I18N.tr) fail("I18N must have a 'tr' key");
  const requiredKeys = [
    "annReturn", "sharpe", "maxDd", "portfolio",
    "dataAdapterReady", "proxyOffline", "rateLimitWarn",
    "proxyReady", "proxyKeyMissing", "holdings", "range",
  ];
  for (const key of requiredKeys) {
    if (!I18N.en[key]) fail(`I18N.en is missing required key: "${key}"`);
    if (!I18N.tr[key]) fail(`I18N.tr is missing required key: "${key}"`);
  }
}

// ── 9. t() helper ──────────────────────────────────────────────────────────
{
  if (t("en", "sharpe") !== "Sharpe") fail(`t("en","sharpe") → expected "Sharpe"`);
  if (t("tr", "sharpe") !== "Sharpe") fail(`t("tr","sharpe") → expected "Sharpe" (same spelling in TR)`);
  if (t("en", "annReturn") !== "Ann. Return") fail(`t("en","annReturn") → expected "Ann. Return"`);
  if (t("fr", "sharpe") !== "Sharpe") fail("t() should fall back to EN for an unknown language");
  const sentinel = "nonExistentKey_xyz";
  if (t("en", sentinel) !== sentinel) fail("t() should fall back to the key itself when missing from all locales");
}

// ── 10. Bilingual rate-limit copy ──────────────────────────────────────────
{
  if (!I18N.en.rateLimitWarn.includes("Rate limit")) {
    fail(`EN rateLimitWarn must include "Rate limit", got: "${I18N.en.rateLimitWarn}"`);
  }
  if (!I18N.tr.rateLimitWarn.includes("Rate limit")) {
    fail(`TR rateLimitWarn must include "Rate limit", got: "${I18N.tr.rateLimitWarn}"`);
  }
  if (I18N.en.rateLimitWarn === I18N.tr.rateLimitWarn) {
    fail("EN and TR rateLimitWarn should be different (distinct language copy)");
  }
}

// ── 11. src/ui.jsx exists (React components layer) ─────────────────────────
{
  const uiJsxPath = path.join(root, "src", "ui.jsx");
  if (!fs.existsSync(uiJsxPath)) fail("src/ui.jsx must exist as the React component layer");
  const uiJsxSrc = fs.readFileSync(uiJsxPath, "utf8");
  const expectedComponents = ["Card", "Metric", "Pill", "Table", "Alert", "ModuleIntro",
    "InsightGrid", "InsightCard", "Segmented", "Spark"];
  for (const name of expectedComponents) {
    if (!uiJsxSrc.includes(`export function ${name}`)) {
      fail(`src/ui.jsx must export function ${name}`);
    }
  }
  if (!uiJsxSrc.includes("@jsx React.createElement")) {
    fail("src/ui.jsx must have @jsx pragma pointing at React.createElement");
  }
}

// ── 12. public/legacy/ui.jsx still has all expected window exports ──────────
{
  const legacySrc = fs.readFileSync(path.join(root, "public", "legacy", "ui.jsx"), "utf8");
  const expectedWindowExports = [
    "fmtPct", "fmtPctSigned", "fmtUSD", "fmtUSDc", "fmtNum",
    "assetColor", "SERIES_COLORS",
    "I18N", "t",
    "Card", "Metric", "Pill", "Table", "Alert", "ModuleIntro",
    "InsightGrid", "InsightCard", "Segmented", "Spark",
  ];
  const assignLine = legacySrc.slice(legacySrc.lastIndexOf("Object.assign(window"));
  if (!assignLine) fail("public/legacy/ui.jsx must contain Object.assign(window, {...}) at the end");
  for (const name of expectedWindowExports) {
    if (!assignLine.includes(name)) {
      fail(`public/legacy/ui.jsx window export "${name}" missing from Object.assign block`);
    }
  }
}

// ── 13. var_ is not exported from src/ui.js ────────────────────────────────
{
  const uiJsSrc = fs.readFileSync(path.join(root, "src", "ui.js"), "utf8");
  if (uiJsSrc.includes("export") && uiJsSrc.includes("var_")) {
    if (uiJsSrc.match(/export\s+(const\s+var_|function\s+var_)/)) {
      fail("var_ is an internal helper and must not be exported from src/ui.js");
    }
  }
}

// ── 14. I18N key parity between EN and TR ─────────────────────────────────
{
  const enKeys = Object.keys(I18N.en);
  const trKeys = Object.keys(I18N.tr);
  for (const k of enKeys) {
    if (!I18N.tr[k]) fail(`I18N.tr is missing key "${k}" that exists in I18N.en`);
  }
  for (const k of trKeys) {
    if (!I18N.en[k]) fail(`I18N.en is missing key "${k}" that exists in I18N.tr`);
  }
}

console.log("UI checks passed");
