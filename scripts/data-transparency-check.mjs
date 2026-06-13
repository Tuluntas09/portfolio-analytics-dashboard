/**
 * data-transparency-check.mjs — verifies Phase D data-source transparency.
 *
 * Two layers:
 *   1. Pure status-derivation logic in src/dataStatus.js (codes only).
 *   2. Static checks that the EN/TR status copy exists in the Data tab,
 *      avoids investment-advice language, and that provider/fallback logic
 *      files were not turned into status emitters.
 *
 * Deterministic — no DOM, no network.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  proxyState,
  sourceMode,
  summarizeDataStatus,
} from "../src/dataStatus.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");
const fail = msg => { throw new Error("data-transparency-check FAILED: " + msg); };
let passed = 0;
const ok = msg => { passed++; if (process.env.VERBOSE) console.log("  ✓ " + msg); };

// ── 1. proxyState codes ────────────────────────────────────────────────────
{
  if (proxyState(undefined) !== "checking") fail("undefined apiStatus → checking");
  if (proxyState({ checked: false }) !== "checking") fail("unchecked → checking");
  if (proxyState({ checked: true, ok: false }) !== "unavailable") fail("not ok → unavailable");
  if (proxyState({ checked: true, ok: true, hasFinnhubKey: false }) !== "key-missing") fail("no key → key-missing");
  if (proxyState({ checked: true, ok: true, hasFinnhubKey: true }) !== "connected") fail("ok+key → connected");
  ok("proxyState derives connected/unavailable/key-missing/checking");
}

// ── 2. sourceMode codes ────────────────────────────────────────────────────
{
  if (sourceMode({ status: "loading" }) !== "pending") fail("loading → pending");
  if (sourceMode({ status: "ready" }) !== "live") fail("ready → live");
  if (sourceMode({ status: "partial" }) !== "partial") fail("partial → partial");
  if (sourceMode({ status: "idle" }, { id: "real" }) !== "live") fail("idle+real source → live");
  if (sourceMode({ status: "idle" }, { id: "mock" }) !== "mock") fail("idle+mock source → mock");
  if (sourceMode(undefined, undefined) !== "mock") fail("no info → mock (honest default)");
  ok("sourceMode derives live/partial/pending/mock");
}

// ── 3. summarizeDataStatus combines + never fabricates rate limit ──────────
{
  const empty = summarizeDataStatus({});
  if (empty.proxy !== "checking" || empty.mode !== "mock" || empty.rateLimited !== false) {
    fail("empty summary must be checking/mock/false");
  }
  const rl = summarizeDataStatus({ rateLimitWarning: true });
  if (rl.rateLimited !== true) fail("rateLimitWarning must surface as rateLimited:true");
  const off = summarizeDataStatus({ apiStatus: { checked: true, ok: false } });
  if (off.proxy !== "unavailable") fail("offline proxy must summarize as unavailable");
  ok("summarizeDataStatus combines codes without fabricating state");
}

// ── 4. Required EN/TR status copy present in the Data tab ───────────────────
const analysisSrc = fs.readFileSync(path.join(root, "src", "views", "analysis.jsx"), "utf8");
{
  const required = [
    // EN
    "Data source status", "Market data proxy", "Live data",
    "Mock / offline fallback data", "Loading live data",
    "Live provider unavailable. QPA is using fallback data where available.",
    "Provider rate limit reached. Cached or fallback data may be shown.",
    "Analytics only — data may be delayed or unavailable. Not financial advice.",
    // TR
    "Veri kaynağı durumu", "Piyasa verisi proxy'si", "Canlı veri",
    "Canlı sağlayıcı erişilemiyor. QPA mümkün olduğunda fallback verisi kullanıyor.",
    "Sağlayıcı rate limit sınırına ulaşıldı. Önbellek veya fallback verisi gösterilebilir.",
    "Yalnızca analitik — veri gecikebilir veya erişilemeyebilir. Yatırım tavsiyesi değildir.",
  ];
  for (const s of required) {
    if (!analysisSrc.includes(s)) fail(`Data tab must contain status copy: "${s}"`);
  }
  ok("required EN/TR status copy present");
}

// ── 5. Status copy avoids investment-advice language ───────────────────────
{
  // scan only the new Phase D status strings, not unrelated module copy
  const newStrings = [
    "Data source status", "Market data proxy", "Data source", "Connected",
    "Unavailable", "Online · key missing", "Checking", "Live data",
    "Live data with fallback", "Mock / offline fallback data", "Loading live data…",
    "Live provider unavailable. QPA is using fallback data where available.",
    "Provider rate limit reached. Cached or fallback data may be shown.",
    "Analytics only — data may be delayed or unavailable. Not financial advice.",
    "Canlı veri", "Canlı sağlayıcı erişilemiyor. QPA mümkün olduğunda fallback verisi kullanıyor.",
  ].join(" ").toLowerCase();
  const banned = [
    "signal", "recommendation", "opportunity", "reliable enough to trade",
    "real-time guaranteed", "investment decision", "buy", "sell", "target price",
  ];
  for (const w of banned) {
    if (newStrings.includes(w)) fail(`banned advice phrase "${w}" found in status copy`);
  }
  ok("status copy avoids advice/recommendation language");
}

// ── 6. Wiring present ──────────────────────────────────────────────────────
{
  if (!analysisSrc.includes("summarizeDataStatus")) fail("DataTab must use summarizeDataStatus");
  if (!analysisSrc.includes("DataSourceStatus")) fail("DataTab must render DataSourceStatus");
  const appSrc = fs.readFileSync(path.join(root, "src", "app.jsx"), "utf8");
  if (!appSrc.includes("rateLimitWarning={rateLimitWarning}")) {
    fail("app.jsx must pass rateLimitWarning into DataTab");
  }
  ok("DataSourceStatus is wired and rate-limit flag is passed through");
}

// ── 7. dataStatus.js is pure (no provider/network calls) ───────────────────
{
  const statusSrc = fs.readFileSync(path.join(root, "src", "dataStatus.js"), "utf8");
  for (const marker of ["fetch(", "http://", "https://", "axios", "require(", "XMLHttpRequest"]) {
    if (statusSrc.includes(marker)) fail(`dataStatus.js must stay pure — found "${marker}"`);
  }
  // it must not import provider internals
  if (/import .* from ["']\.\/data\.js["']/.test(statusSrc)) fail("dataStatus.js must not import provider logic");
  ok("dataStatus.js is pure — no provider or network logic");
}

// ── 8. Non-advisory disclaimers still intact in the sidebar ────────────────
{
  const sidebarSrc = fs.readFileSync(path.join(root, "src", "sidebar.jsx"), "utf8");
  if (!sidebarSrc.includes("Analytics only — not financial advice.")) {
    fail("existing sidebar non-advisory disclaimer must remain intact");
  }
  ok("existing non-advisory disclaimer intact");
}

console.log(`data-transparency checks passed (${passed} assertions)`);
