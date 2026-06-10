import fs from "node:fs";
import { createMarketDataAdapter, DATA_SOURCES } from "../src/data.js";

const root = new URL("..", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const fail = message => {
  throw new Error(message);
};

const index = read("index.html");
const data = read("public/legacy/data.jsx");
const app = read("public/legacy/app.jsx");
const sidebar = read("public/legacy/sidebar.jsx");
const ui = read("public/legacy/ui.jsx");
const views = read("public/legacy/views-analysis.jsx");
const moduleData = read("src/data.js");

// Phase 6i: index.html now uses the Vite module entry; legacy scripts removed.
if (!index.includes('type="module"') || !index.includes("src/app.jsx")) {
  fail('index.html must load src/app.jsx as <script type="module"> (Phase 6i Vite entry)');
}
if (index.includes("babel.min.js") || index.includes("babel.js")) {
  fail("index.html must not load Babel Standalone after Phase 6i migration");
}
if (index.includes('type="text/babel"')) {
  fail('index.html must not have legacy <script type="text/babel"> tags after Phase 6i migration');
}
// Verify legacy files are still preserved on disk (never deleted)
const legacyFiles = [
  "public/legacy/data.jsx",
  "public/legacy/charts.jsx",
  "public/legacy/ui.jsx",
  "public/legacy/sidebar.jsx",
  "public/legacy/views-overview.jsx",
  "public/legacy/views-analysis.jsx",
  "public/legacy/app.jsx",
];
for (const f of legacyFiles) {
  if (!fs.existsSync(new URL(f, root))) fail(`Legacy file must be preserved on disk: ${f}`);
}

const uiSources = [data, app, sidebar, views].join("\n");
const forbiddenRuntimeLabels = [
  "Finnhub /stock/candle",
  "Finnhub /stock/profile2",
  "Finnhub /company-news",
  "Live · Finnhub",
];

for (const label of forbiddenRuntimeLabels) {
  if (uiSources.includes(label)) fail(`Forbidden stale data-source label found: ${label}`);
}

const adapter = createMarketDataAdapter("mock");
if (!adapter) fail("ACTIVE_DATA_ADAPTER is not exported");
if (adapter.source.id !== "mock") fail("Default adapter should be mock until real data is enabled");
if (!DATA_SOURCES.real) fail("Real data source metadata is not registered");
if (!DATA_SOURCES.real.baseUrl) fail("Real data source should define a proxy baseUrl");
if (!moduleData.includes("import.meta.env.VITE_API_BASE_URL")) {
  fail("src/data.js must read VITE_API_BASE_URL through direct Vite env access");
}
if (moduleData.includes("typeof import.meta.env")) {
  fail("src/data.js must not guard VITE_API_BASE_URL with typeof import.meta.env; Vite can minify that guard to the localhost fallback");
}
if (!app.includes("/api/market/history")) fail("App should fetch real price history from the proxy");
if (!app.includes("/api/market/quote")) fail("App should fetch real quote data from the proxy");
if (!app.includes("/api/company/profile")) fail("App should fetch real company profile data from the proxy");
if (!app.includes("historyBySymbol")) fail("App should pass historyBySymbol into buildPortfolio");
if (!app.includes("quoteBySymbol")) fail("App should pass quoteBySymbol into buildPortfolio");
if (!app.includes("profileBySymbol")) fail("App should pass profileBySymbol into buildPortfolio");
const tabOrder = [
  'id: "overview"',
  'id: "risk"',
  'id: "optimization"',
  'id: "simulation"',
  'id: "analysis"',
  'id: "company"',
  'id: "data"',
];
for (let i = 1; i < tabOrder.length; i++) {
  if (app.indexOf(tabOrder[i - 1]) > app.indexOf(tabOrder[i])) {
    fail(`Decision-flow tab order is invalid around ${tabOrder[i]}`);
  }
}
if (!ui.includes("ModuleIntro") || !ui.includes("Bu ekran neyi cevaplıyor?") || !views.includes("ModuleIntro")) {
  fail("Shared module intro components should be available and used");
}
if (!views.includes("Data audit")) fail("Data tab should be framed as an audit panel");
if (!adapter.lookup("AAPL")) fail("Adapter lookup failed for AAPL");

const empty = adapter.buildPortfolio([], { days: 252, profile: "balanced" });
if (empty.assets.length !== 0) fail("Empty portfolio should not contain assets");
if (empty.totalValue !== 0) fail("Empty portfolio totalValue should be 0");
if (!Number.isFinite(empty.sharpe) || !Number.isFinite(empty.sortino)) {
  fail("Empty portfolio risk metrics must stay finite");
}
if (empty.source.id !== "mock") fail("Empty portfolio should retain source metadata");

const mixed = adapter.buildPortfolio([
  { t: "AAPL", lots: 10 },
  { t: "bad ticker!", lots: 5 },
], { days: 252, profile: "balanced" });
if (mixed.assets.length !== 1 || mixed.assets[0].t !== "AAPL") {
  fail("Unknown ticker filtering is broken");
}
if (mixed.source.id !== "mock") fail("Non-empty portfolio should retain source metadata");
if (!Array.isArray(mixed.benchCum) || !Number.isFinite(mixed.benchCum[mixed.benchCum.length - 1])) {
  fail("benchCum must be a finite array in portfolio output");
}

const realHistory = {
  AAPL: {
    provider: "yahoo",
    candles: [
      { date: "2024-01-01", close: 100, adjClose: 100 },
      { date: "2024-01-02", close: 102, adjClose: 102 },
      { date: "2024-01-03", close: 101, adjClose: 101 },
      { date: "2024-01-04", close: 104, adjClose: 104 },
    ],
  },
};
const real = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], {
  days: 3,
  profile: "balanced",
  source: "real",
  historyBySymbol: realHistory,
  quoteBySymbol: { AAPL: { c: 105 } },
  profileBySymbol: { AAPL: { name: "Apple Inc", ticker: "AAPL" } },
});
if (real.source.id !== "real") fail("Real history portfolio should use real source metadata");
if (real.assets[0].px !== 105) fail("Real quote latest price should drive position value when available");
if (real.assets[0].dataProvider !== "finnhub quote") fail("Real quote provider should be retained on the asset");
if (real.assets[0].companyProfile?.ticker !== "AAPL") fail("Real company profile should be retained on the asset");
if (real.assets[0].path.length !== 4) fail("Real history path length is incorrect");
if (!Number.isFinite(real.annRet) || !Number.isFinite(real.annVol)) {
  fail("Real history portfolio metrics must stay finite");
}

const guardIndex = views.indexOf("if (!p.assets.length)");
const pathIndex = views.indexOf("p.assets[0].path");
if (guardIndex < 0 || pathIndex < 0 || guardIndex > pathIndex) {
  fail("DataTab must guard empty portfolios before reading p.assets[0].path");
}

// rf propagation: lower rf must yield higher Sharpe for the same portfolio
const rfLow = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252, profile: "balanced", rf: 0.01 });
const rfHigh = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252, profile: "balanced", rf: 0.10 });
if (!Number.isFinite(rfLow.sharpe) || !Number.isFinite(rfHigh.sharpe)) {
  fail("rf propagation: Sharpe must be finite for valid rf values");
}
if (rfLow.sharpe <= rfHigh.sharpe) {
  fail("rf propagation: lower rf should produce higher Sharpe ratio for the same portfolio");
}
const rfNaN = adapter.buildPortfolio([{ t: "AAPL", lots: 10 }], { days: 252, profile: "balanced", rf: NaN });
if (!Number.isFinite(rfNaN.sharpe)) {
  fail("rf propagation: NaN rf must fall back to default and produce finite Sharpe");
}
if (rfNaN.rf !== 0.043) {
  fail("rf propagation: NaN rf must fall back to 0.043");
}

console.log("Smoke checks passed");
