/**
 * sidebar-check.mjs — verifies src/sidebar.jsx exports the expected sidebar components.
 *
 * Node.js cannot parse JSX, so this script reads src/sidebar.jsx as source text.
 * Component exports, JSX pragma, import declarations, private helper privacy,
 * and the public/legacy/sidebar.jsx window export list are all verified via text analysis.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error(msg); };

// ── 1. src/sidebar.jsx exists ──────────────────────────────────────────────
{
  const sidebarPath = path.join(root, "src", "sidebar.jsx");
  if (!fs.existsSync(sidebarPath)) fail("src/sidebar.jsx must exist");
}

const sidebarSrc = fs.readFileSync(path.join(root, "src", "sidebar.jsx"), "utf8");

// ── 2. All 3 exports are present ───────────────────────────────────────────
{
  const expectedExports = ["Sidebar", "Icon", "PROFILES"];
  for (const name of expectedExports) {
    const hasExportFn  = sidebarSrc.includes(`export function ${name}`);
    const hasExportCon = sidebarSrc.includes(`export const ${name}`);
    if (!hasExportFn && !hasExportCon) {
      fail(`src/sidebar.jsx must export "${name}" (as export function or export const)`);
    }
  }
}

// ── 3. JSX pragma is present (classic mode — global React) ─────────────────
{
  if (!sidebarSrc.includes("@jsx React.createElement")) {
    fail("src/sidebar.jsx must have @jsx pragma pointing at React.createElement");
  }
}

// ── 4. Imports from src/ui.js (t and fmtUSD) ───────────────────────────────
{
  if (!sidebarSrc.includes('from "./ui.js"')) {
    fail('src/sidebar.jsx must import from "./ui.js" for t and fmtUSD');
  }
  if (!sidebarSrc.match(/import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*["']\.\/ui\.js["']/)) {
    fail('src/sidebar.jsx must import "t" from "./ui.js"');
  }
  if (!sidebarSrc.match(/import\s*\{[^}]*\bfmtUSD\b[^}]*\}\s*from\s*["']\.\/ui\.js["']/)) {
    fail('src/sidebar.jsx must import "fmtUSD" from "./ui.js"');
  }
}

// ── 5. Imports from src/data.js (UNIVERSE, lookup, BENCHMARK_TICKERS) ─────
{
  if (!sidebarSrc.includes('from "./data.js"')) {
    fail('src/sidebar.jsx must import from "./data.js" for UNIVERSE and lookup');
  }
  if (!sidebarSrc.match(/import\s*\{[^}]*\bUNIVERSE\b[^}]*\}\s*from\s*["']\.\/data\.js["']/)) {
    fail('src/sidebar.jsx must import "UNIVERSE" from "./data.js"');
  }
  if (!sidebarSrc.match(/import\s*\{[^}]*\blookup\b[^}]*\}\s*from\s*["']\.\/data\.js["']/)) {
    fail('src/sidebar.jsx must import "lookup" from "./data.js"');
  }
  if (!sidebarSrc.match(/import\s*\{[^}]*\bBENCHMARK_TICKERS\b[^}]*\}\s*from\s*["']\.\/data\.js["']/)) {
    fail('src/sidebar.jsx must import "BENCHMARK_TICKERS" from "./data.js"');
  }
}

// ── 6. No Object.assign(window, ...) in src/sidebar.jsx ───────────────────
{
  if (sidebarSrc.includes("Object.assign(window")) {
    fail("src/sidebar.jsx must NOT have Object.assign(window, ...) — that belongs only in the legacy shim");
  }
}

// ── 7. npm React import required (Phase 6i-prep: window.React no longer relied on) ──
{
  if (!sidebarSrc.includes('from "react"') && !sidebarSrc.includes("from 'react'")) {
    fail('src/sidebar.jsx must import React from the npm package (not window.React UMD global)');
  }
}

// ── 8. Private helpers are NOT exported ────────────────────────────────────
{
  const shouldBePrivate = ["rangeStart", "PROFILE_COPY", "DATE_PRESETS"];
  for (const name of shouldBePrivate) {
    if (sidebarSrc.match(new RegExp(`export\\s+(function\\s+${name}|const\\s+${name})`))) {
      fail(`"${name}" is a private sidebar helper and must not be exported from src/sidebar.jsx`);
    }
    // Sanity: they must still be defined in the file
    if (!sidebarSrc.includes(name)) {
      fail(`src/sidebar.jsx must still define "${name}"`);
    }
  }
}

// ── 9. React hooks destructuring at module top ────────────────────────────
{
  if (!sidebarSrc.includes("} = React;")) {
    fail('src/sidebar.jsx must destructure React hooks with "const { ... } = React;"');
  }
}

// ── 10. Non-advisory disclaimer copy is preserved ─────────────────────────
{
  if (!sidebarSrc.includes("Analytics only — not financial advice.")) {
    fail('src/sidebar.jsx must preserve the non-advisory disclaimer: "Analytics only — not financial advice."');
  }
  if (!sidebarSrc.includes("Yalnızca analitik araç — yatırım tavsiyesi değildir.")) {
    fail('src/sidebar.jsx must preserve the Turkish non-advisory disclaimer');
  }
}

// ── 11. public/legacy/sidebar.jsx is unchanged — all 3 window exports present
{
  const legacyPath = path.join(root, "public", "legacy", "sidebar.jsx");
  if (!fs.existsSync(legacyPath)) fail("public/legacy/sidebar.jsx must still exist (legacy shim)");
  const legacySrc = fs.readFileSync(legacyPath, "utf8");
  const assignBlock = legacySrc.slice(legacySrc.lastIndexOf("Object.assign(window"));
  if (!assignBlock) fail("public/legacy/sidebar.jsx must contain Object.assign(window, {...}) at the end");
  const expectedWindowExports = ["Sidebar", "Icon", "PROFILES"];
  for (const name of expectedWindowExports) {
    if (!assignBlock.includes(name)) {
      fail(`public/legacy/sidebar.jsx window export "${name}" missing from Object.assign block`);
    }
  }
}

// ── 12. Export count — exactly 3 named exports ────────────────────────────
{
  const fnExports   = [...sidebarSrc.matchAll(/^export function (\w+)/mg)].map(m => m[1]);
  const constExports = [...sidebarSrc.matchAll(/^export const (\w+)/mg)].map(m => m[1]);
  const allExports = [...fnExports, ...constExports];
  if (allExports.length !== 3) {
    fail(`src/sidebar.jsx should have exactly 3 named exports, found ${allExports.length}: ${allExports.join(", ")}`);
  }
  const expectedSet = new Set(["Sidebar", "Icon", "PROFILES"]);
  for (const name of allExports) {
    if (!expectedSet.has(name)) {
      fail(`Unexpected export found in src/sidebar.jsx: "${name}"`);
    }
  }
}

console.log("sidebar checks passed");
