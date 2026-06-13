/**
 * scripts/cost-basis-check.mjs — Phase 9a: cost basis & unrealized P&L tests
 * Node.js source-text + import-based checks. No DOM, no JSX parsing.
 * Run: node scripts/cost-basis-check.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..");

let passed = 0;
let failed = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}`); failed++; }
}

const storageSrc = readFileSync(join(root, "src/portfolioStorage.js"), "utf8");
const appSrc     = readFileSync(join(root, "src/app.jsx"),             "utf8");
const sidebarSrc = readFileSync(join(root, "src/sidebar.jsx"),         "utf8");
const uiSrc      = readFileSync(join(root, "src/ui.js"),               "utf8");
const overviewSrc = readFileSync(join(root, "src/views/overview.jsx"), "utf8");
const dataSrc    = readFileSync(join(root, "src/data.js"),             "utf8");

import {
  loadSaves, savePortfolio, validateEntry,
  SCHEMA_VERSION,
} from "../src/portfolioStorage.js";

import { createMarketDataAdapter } from "../src/data.js";
import { fmtUSDSigned, I18N } from "../src/ui.js";

function makeStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    getItem:    key      => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem:    (key, v) => { data[key] = v; },
    removeItem: key      => { delete data[key]; },
    _data:      data,
  };
}

const BASE_HOLDINGS = [{ t: "AAPL", lots: 10 }, { t: "MSFT", lots: 5 }];
const ASSUMPS       = { rf: 0.043, horizon: 5, paths: 2000 };
const VALID_SET     = { has: t => ["AAPL", "MSFT", "VTI", "GOOGL"].includes(t) };

// ═══════════════════════════════════════════════════════════════════════════
// 1. fmtUSDSigned formatter
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nfmtUSDSigned formatter");

ok("fmtUSDSigned positive value starts with +$",  fmtUSDSigned(1000).startsWith("+$"));
ok("fmtUSDSigned negative value starts with −$",  fmtUSDSigned(-500).startsWith("−$"));
ok("fmtUSDSigned zero is +$0",                    fmtUSDSigned(0) === "+$0");
ok("fmtUSDSigned rounds to integer",               fmtUSDSigned(1234.78) === "+$1,235");
ok("fmtUSDSigned large negative",                  fmtUSDSigned(-10000).includes("10,000"));

// ═══════════════════════════════════════════════════════════════════════════
// 2. I18N keys — EN and TR parity for Phase 9a keys
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nI18N — Phase 9a key presence and parity");

const PHASE9_KEYS = ["averageCost", "firstBought", "unrealizedPnl", "unrealizedReturn", "costBasis", "missingCostBasis"];
for (const key of PHASE9_KEYS) {
  ok(`EN i18n key "${key}" present`, typeof I18N.en[key] === "string" && I18N.en[key].length > 0);
  ok(`TR i18n key "${key}" present`, typeof I18N.tr[key] === "string" && I18N.tr[key].length > 0);
}
ok("EN and TR have identical key sets", JSON.stringify(Object.keys(I18N.en).sort()) === JSON.stringify(Object.keys(I18N.tr).sort()));

// ═══════════════════════════════════════════════════════════════════════════
// 3. portfolioStorage — save and restore avgCost + firstBought
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nportfolioStorage — cost basis round-trip");

{
  const s = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, avgCost: 150.25, firstBought: "2022-03-15" }];
  const r = savePortfolio("CostTest", holdings, ASSUMPS, "", s);
  ok("savePortfolio with avgCost returns ok:true", r.ok === true);
  const saves = loadSaves(s);
  ok("saved entry has avgCost", saves[0]?.holdings[0]?.avgCost === 150.25);
  ok("saved entry has firstBought", saves[0]?.holdings[0]?.firstBought === "2022-03-15");
}

{
  const s = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10 }];
  savePortfolio("NoCostTest", holdings, ASSUMPS, "", s);
  const saves = loadSaves(s);
  ok("saved entry without avgCost has no avgCost key", !("avgCost" in saves[0].holdings[0]));
  ok("saved entry without firstBought has no firstBought key", !("firstBought" in saves[0].holdings[0]));
}

{
  const s = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, avgCost: -50 }];
  savePortfolio("NegCostTest", holdings, ASSUMPS, "", s);
  const saves = loadSaves(s);
  ok("negative avgCost is not saved", !("avgCost" in saves[0].holdings[0]));
}

{
  const s = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, avgCost: 0 }];
  savePortfolio("ZeroCostTest", holdings, ASSUMPS, "", s);
  const saves = loadSaves(s);
  ok("zero avgCost is not saved", !("avgCost" in saves[0].holdings[0]));
}

{
  const s = makeStorage();
  const holdings = [{ t: "AAPL", lots: 10, firstBought: "not-a-date" }];
  savePortfolio("BadDateTest", holdings, ASSUMPS, "", s);
  const saves = loadSaves(s);
  ok("invalid firstBought format is not saved", !("firstBought" in saves[0].holdings[0]));
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. validateEntry — passes through avgCost + firstBought
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nvalidateEntry — cost basis passthrough");

{
  const entry = {
    schemaVersion: SCHEMA_VERSION,
    holdings: [{ t: "AAPL", lots: 10, avgCost: 150.25, firstBought: "2022-03-15" }],
    assumptions: ASSUMPS,
    notes: "",
  };
  const result = validateEntry(entry, VALID_SET);
  ok("validateEntry returns non-null for valid cost basis entry", result !== null);
  ok("validateEntry preserves avgCost", result?.holdings[0]?.avgCost === 150.25);
  ok("validateEntry preserves firstBought", result?.holdings[0]?.firstBought === "2022-03-15");
}

{
  const entry = {
    schemaVersion: SCHEMA_VERSION,
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: ASSUMPS,
    notes: "",
  };
  const result = validateEntry(entry, VALID_SET);
  ok("validateEntry works for entries without cost basis", result !== null);
  ok("validateEntry does not inject avgCost when absent", !("avgCost" in result.holdings[0]));
  ok("validateEntry does not inject firstBought when absent", !("firstBought" in result.holdings[0]));
}

{
  const entry = {
    schemaVersion: SCHEMA_VERSION,
    holdings: [{ t: "AAPL", lots: 10, avgCost: -99, firstBought: "bad-date" }],
    assumptions: ASSUMPS,
    notes: "",
  };
  const result = validateEntry(entry, VALID_SET);
  ok("validateEntry strips invalid avgCost (negative)", result !== null && !("avgCost" in result.holdings[0]));
  ok("validateEntry strips invalid firstBought (bad format)", !("firstBought" in result.holdings[0]));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. buildPortfolio — per-asset P&L computation
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nbuildPortfolio — per-asset cost basis and P&L");

const adapter = createMarketDataAdapter({ source: "mock" });

{
  const holdings = [{ t: "AAPL", lots: 10, avgCost: 1 }];
  const p = adapter.buildPortfolio(holdings, { days: 252 });
  const aapl = p.assets.find(a => a.t === "AAPL");
  ok("asset has avgCost when provided", aapl?.avgCost === 1);
  ok("unrealizedPnl is finite number", typeof aapl?.unrealizedPnl === "number" && Number.isFinite(aapl.unrealizedPnl));
  ok("unrealizedPct is finite number", typeof aapl?.unrealizedPct === "number" && Number.isFinite(aapl.unrealizedPct));
  ok("unrealizedPnl = (px - avgCost) * lots", Math.abs(aapl.unrealizedPnl - (aapl.px - 1) * 10) < 0.001);
  ok("unrealizedPct = (px - avgCost) / avgCost", Math.abs(aapl.unrealizedPct - (aapl.px - 1) / 1) < 0.001);
}

{
  const holdings = [{ t: "AAPL", lots: 10 }];
  const p = adapter.buildPortfolio(holdings, { days: 252 });
  const aapl = p.assets.find(a => a.t === "AAPL");
  ok("avgCost is null when not provided", aapl?.avgCost === null);
  ok("unrealizedPnl is null when avgCost absent", aapl?.unrealizedPnl === null);
  ok("unrealizedPct is null when avgCost absent", aapl?.unrealizedPct === null);
}

{
  const holdings = [{ t: "AAPL", lots: 10, avgCost: 1 }, { t: "MSFT", lots: 5 }];
  const p = adapter.buildPortfolio(holdings, { days: 252 });
  ok("totalUnrealizedPnl is non-null when at least one asset has cost basis", p.totalUnrealizedPnl !== null);
  ok("totalCostBasis reflects only assets with avgCost", p.totalCostBasis !== null && p.totalCostBasis > 0);
  const aapl = p.assets.find(a => a.t === "AAPL");
  ok("totalCostBasis equals avgCost * lots for the one covered asset", Math.abs(p.totalCostBasis - 1 * 10) < 0.001);
}

{
  const holdings = [{ t: "AAPL", lots: 10 }, { t: "MSFT", lots: 5 }];
  const p = adapter.buildPortfolio(holdings, { days: 252 });
  ok("totalUnrealizedPnl is null when no assets have cost basis", p.totalUnrealizedPnl === null);
  ok("totalCostBasis is null when no assets have cost basis", p.totalCostBasis === null);
  ok("totalUnrealizedPct is null when no assets have cost basis", p.totalUnrealizedPct === null);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. emptyPortfolio — has null cost-basis fields
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nemptyPortfolio — cost basis nulls");

{
  const empty = adapter.buildPortfolio([], { days: 252 });
  ok("emptyPortfolio totalCostBasis is null",    empty.totalCostBasis === null);
  ok("emptyPortfolio totalUnrealizedPnl is null", empty.totalUnrealizedPnl === null);
  ok("emptyPortfolio totalUnrealizedPct is null", empty.totalUnrealizedPct === null);
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Source text — data.js
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsrc/data.js — source-text checks");

ok("data.js computes unrealizedPnl per asset",    dataSrc.includes("unrealizedPnl"));
ok("data.js computes unrealizedPct per asset",    dataSrc.includes("unrealizedPct"));
ok("data.js computes totalCostBasis",             dataSrc.includes("totalCostBasis"));
ok("data.js computes totalUnrealizedPnl",         dataSrc.includes("totalUnrealizedPnl"));
ok("data.js computes totalUnrealizedPct",         dataSrc.includes("totalUnrealizedPct"));
ok("data.js guards avgCost > 0",                  dataSrc.includes("avgCost > 0"));
ok("data.js adds cost-basis nulls to emptyPortfolio", dataSrc.includes("totalCostBasis: null"));

// ═══════════════════════════════════════════════════════════════════════════
// 8. Source text — portfolioStorage.js
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsrc/portfolioStorage.js — source-text checks");

ok("storage saves avgCost conditionally",     storageSrc.includes("saved.avgCost") || storageSrc.includes("avgCost = h.avgCost"));
ok("storage saves firstBought conditionally", storageSrc.includes("saved.firstBought") || storageSrc.includes("firstBought = h.firstBought"));
ok("storage restores avgCost in validateEntry", storageSrc.match(/restored\.avgCost|entry\.avgCost = h\.avgCost/) || storageSrc.includes("restored.avgCost"));
ok("storage uses YYYY-MM-DD regex for firstBought", storageSrc.includes("\\d{4}-\\d{2}-\\d{2}"));

// ═══════════════════════════════════════════════════════════════════════════
// 9. Source text — sidebar.jsx
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsrc/sidebar.jsx — source-text checks");

ok("sidebar destructures onCostBasis prop",       sidebarSrc.includes("onCostBasis"));
ok("sidebar has lot-card-cost CSS class",          sidebarSrc.includes("lot-card-cost"));
ok("sidebar has lot-cost-input CSS class",         sidebarSrc.includes("lot-cost-input"));
ok("sidebar has lot-date-input CSS class",         sidebarSrc.includes("lot-date-input"));
ok("sidebar has lot-card wrapper CSS class",       sidebarSrc.includes("lot-card"));
ok("sidebar calls onCostBasis on avgCost change",  sidebarSrc.includes("onCostBasis(h.t, { avgCost"));
ok("sidebar calls onCostBasis on firstBought change", sidebarSrc.includes("firstBought"));
ok("sidebar uses averageCost i18n key",            sidebarSrc.includes('"averageCost"'));
ok("sidebar uses firstBought i18n key",            sidebarSrc.includes('"firstBought"'));
ok("sidebar still exports exactly 3 names",        (sidebarSrc.match(/^export /gm) || []).length === 3);

// ═══════════════════════════════════════════════════════════════════════════
// 10. Source text — app.jsx
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsrc/app.jsx — source-text checks");

ok("app.jsx defines setCostBasis handler",         appSrc.includes("setCostBasis"));
ok("app.jsx passes onCostBasis to Sidebar",        appSrc.includes("onCostBasis={setCostBasis}"));

// ═══════════════════════════════════════════════════════════════════════════
// 11. Source text — overview.jsx
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsrc/views/overview.jsx — source-text checks");

ok("overview imports fmtUSDSigned",               overviewSrc.includes("fmtUSDSigned"));
ok("overview RISK_COPY has averageCost key (EN)",  overviewSrc.includes('"Avg. Cost"'));
ok("overview RISK_COPY has unrealizedPnl key (EN)", overviewSrc.includes('"Unrealized P&L"'));
ok("overview RISK_COPY has unrealizedReturn key (EN)", overviewSrc.includes('"Unrealized Return"'));
ok("overview RISK_COPY has costBasis key (EN)",   overviewSrc.includes('"Cost Basis"'));
ok("overview has conditional P&L KPI strip",      overviewSrc.includes("totalUnrealizedPnl != null"));
ok("overview renders totalCostBasis KPI",         overviewSrc.includes("totalCostBasis"));
ok("overview renders totalUnrealizedPct KPI",     overviewSrc.includes("totalUnrealizedPct"));
ok("overview table column for avgCost",           overviewSrc.includes('"avgCost"'));
ok("overview table column for unrealizedPnl",     overviewSrc.includes('"unrealizedPnl"'));
ok("overview table column for unrealizedPct",     overviewSrc.includes('"unrealizedPct"'));

// ═══════════════════════════════════════════════════════════════════════════
// 12. No advisory language in new copy
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsafety — no advisory language in Phase 9a copy");

const advisoryWords = ["recommend", "buy", "sell", "target price", "should invest", "signal"];
const newCopyKeys = ["averageCost", "firstBought", "unrealizedPnl", "unrealizedReturn", "costBasis", "missingCostBasis"];
for (const key of newCopyKeys) {
  const enVal = (I18N.en[key] || "").toLowerCase();
  const trVal = (I18N.tr[key] || "").toLowerCase();
  const hasAdvisory = advisoryWords.some(w => enVal.includes(w) || trVal.includes(w));
  ok(`"${key}" copy contains no advisory language`, !hasAdvisory);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\ncost-basis checks FAILED");
  process.exit(1);
}
console.log("\ncost-basis checks passed");
