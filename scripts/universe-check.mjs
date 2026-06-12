/**
 * scripts/universe-check.mjs — Phase 8e: instrument universe expansion tests
 * Node.js source-text + import-based checks. No DOM, no JSX parsing.
 * Run: node scripts/universe-check.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

// ── helpers ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}`); failed++; }
}

const dataSrc    = readFileSync(join(root, "src/data.js"),    "utf8");
const sidebarSrc = readFileSync(join(root, "src/sidebar.jsx"), "utf8");
const appSrc     = readFileSync(join(root, "src/app.jsx"),    "utf8");
const uiSrc      = readFileSync(join(root, "src/ui.js"),      "utf8");

// ── import data.js exports ───────────────────────────────────────────────────
import { UNIVERSE, lookup, DEFAULT_GBM, isValidTicker, buildPortfolio } from "../src/data.js";

// ═══════════════════════════════════════════════════════════════════════════
// 1. DEFAULT_GBM
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nDEFAULT_GBM");
ok("exported from data.js",                 dataSrc.includes("export const DEFAULT_GBM"));
ok("px is 100",                             DEFAULT_GBM.px  === 100);
ok("mu is 0.10",                            DEFAULT_GBM.mu  === 0.10);
ok("sig is 0.25",                           DEFAULT_GBM.sig === 0.25);
ok("canonical UNIVERSE entries unchanged",  UNIVERSE.length === 16);

// ═══════════════════════════════════════════════════════════════════════════
// 2. isValidTicker
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nisValidTicker");
ok("exported from data.js",                 dataSrc.includes("export function isValidTicker"));
ok("accepts standard uppercase ticker",     isValidTicker("TSLA"));
ok("accepts 1-char ticker",                 isValidTicker("A"));
ok("accepts ticker with dot (BRK.B)",       isValidTicker("BRK.B"));
ok("accepts 8-char ticker",                 isValidTicker("ABCDEFGH"));
ok("accepts numeric chars",                 isValidTicker("BTC.USD"));
ok("rejects lowercase",                     !isValidTicker("tsla"));
ok("rejects ticker > 8 chars",             !isValidTicker("TOOLONGXX"));
ok("rejects empty string",                  !isValidTicker(""));
ok("rejects non-string (null)",             !isValidTicker(null));
ok("rejects non-string (number)",           !isValidTicker(42));
ok("rejects special chars",                 !isValidTicker("SPY!"));

// ═══════════════════════════════════════════════════════════════════════════
// 3. buildPortfolio — extended tickers
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nbuildPortfolio — extended tickers");

const pExt = buildPortfolio([{ t: "TSLA", lots: 10 }]);
ok("extended ticker produces non-null asset", pExt !== null && pExt.assets.length > 0);
ok("extended asset has extended:true flag",   pExt.assets[0]?.extended === true);
ok("extended asset cls is Equity",            pExt.assets[0]?.cls === "Equity");
ok("extended asset sector is Extended",       pExt.assets[0]?.sector === "Extended");
ok("extended asset px is DEFAULT_GBM.px",     pExt.assets[0]?.px === DEFAULT_GBM.px);

const pBad = buildPortfolio([{ t: "bad ticker!", lots: 5 }]);
ok("invalid ticker is excluded from assets",  pBad.assets.filter(Boolean).length === 0);

const pMix = buildPortfolio([{ t: "AAPL", lots: 10 }, { t: "TSLA", lots: 5 }]);
ok("mixed portfolio: canonical asset present", pMix.assets.some(a => a?.t === "AAPL"));
ok("mixed portfolio: extended asset present",  pMix.assets.some(a => a?.t === "TSLA" && a.extended));
ok("lookup() unchanged for canonical tickers", lookup("AAPL")?.name === "Apple Inc.");

// ═══════════════════════════════════════════════════════════════════════════
// 4. app.jsx — relaxed validation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\napp.jsx — relaxed validation");
ok("imports isValidTicker from data.js",    appSrc.includes("isValidTicker") && appSrc.includes("./data.js"));
ok("addTicker guarded by isValidTicker",    appSrc.includes("isValidTicker(t)"));
ok("handleLoadPortfolio uses duck-typed has", appSrc.includes("has: t => isValidTicker(t)"));
ok("handleImportCsv uses duck-typed has",   appSrc.match(/parseHoldingsCsv\(.*isValidTicker/s) !== null);

// ═══════════════════════════════════════════════════════════════════════════
// 5. sidebar.jsx — extended UI
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsidebar.jsx — extended UI");
ok("imports isValidTicker from data.js",    sidebarSrc.includes("isValidTicker") && sidebarSrc.includes("./data.js"));
ok("crash guard: u?.name ?? extendedUniverse fallback",
   sidebarSrc.includes('u?.name ?? t(language, "extendedUniverse")'));
ok("crash guard: optional chaining on px",  sidebarSrc.includes("u?.px ?? 100"));
ok("showExtended computed var present",     sidebarSrc.includes("showExtended"));
ok("extended-row CSS class defined",        sidebarSrc.includes(".extended-row"));
ok("ext-badge CSS class defined",           sidebarSrc.includes(".ext-badge"));
ok("ext-note CSS class defined",            sidebarSrc.includes(".ext-note"));
ok("ext-note rendered when extended holdings exist",
   sidebarSrc.includes("extendedUniverseNote"));

// ═══════════════════════════════════════════════════════════════════════════
// 6. i18n — ui.js parity
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nui.js — i18n parity");
ok("EN extendedUniverse key present",       uiSrc.includes("extendedUniverse:"));
ok("EN extendedUniverseNote key present",   uiSrc.includes("extendedUniverseNote:"));
ok("EN addExtended key present",            uiSrc.includes("addExtended:"));
ok("TR extendedUniverse key present",       uiSrc.match(/tr:[\s\S]*?extendedUniverse:/) !== null);
ok("TR extendedUniverseNote key present",   uiSrc.match(/tr:[\s\S]*?extendedUniverseNote:/) !== null);
ok("TR addExtended key present",            uiSrc.match(/tr:[\s\S]*?addExtended:/) !== null);

// ═══════════════════════════════════════════════════════════════════════════
// 7. scope boundaries — no advisory content
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nscope boundaries");
ok("data.js has no buy/sell signal text",
   !dataSrc.match(/\b(buy|sell|recommend|target price|price target)\b/i));
ok("DEFAULT_GBM comment says 'not calibrated'",
   dataSrc.includes("not calibrated"));

// ═══════════════════════════════════════════════════════════════════════════
// result
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
