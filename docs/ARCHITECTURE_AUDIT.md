# Architecture Audit

**Project:** Quant Portfolio Analytics Dashboard  
**Audit date:** 2026-06-06  
**Status:** Prototype → Production-readiness gap analysis

---

## 1. Current Architecture Overview

```
Browser
  index.html
    ├── React 18 UMD            (CDN, unpkg.com)
    ├── Babel Standalone 7.29   (CDN, transpiles JSX in-browser)
    └── public/legacy/*.jsx     (loaded as <script type="text/babel">)
          data.jsx              → financial math + mock market engine
          charts.jsx            → SVG chart primitives
          ui.jsx                → formatters, i18n, shared UI components
          sidebar.jsx           → control panel, search, position input
          views-overview.jsx    → Overview tab
          views-analysis.jsx    → Risk, Optimization, Simulation, Analysis,
                                   Company Data, Data tabs
          app.jsx               → root state, theme, tab nav, API polling

Node.js (npm run api)
  server/market-data-server.mjs → HTTP proxy on port 8787
    GET /api/health
    GET /api/market/quote?symbol=
    GET /api/market/candles?symbol=
    GET /api/market/history?symbol=
    GET /api/company/profile?symbol=
    GET /api/company/news?symbol=
```

---

## 2. Global window Dependency Map

All legacy JSX files share state through the browser `window` object because they
are loaded as separate `<script>` tags evaluated by Babel Standalone.

### Exports written to window (by file, in load order)

| Symbol | Written in | Consumed in |
|---|---|---|
| `rng`, `gauss`, `pricePath` | data.jsx | data.jsx (internal) |
| `UNIVERSE`, `DEFAULT_LOTS` | data.jsx | sidebar.jsx, app.jsx |
| `DATA_SOURCES` | data.jsx | app.jsx, smoke-check.mjs |
| `ACTIVE_DATA_ADAPTER` | data.jsx | app.jsx, smoke-check.mjs |
| `createMarketDataAdapter` | data.jsx | (available globally) |
| `buildPortfolio` | data.jsx | (called via adapter) |
| `monteCarlo` | data.jsx | views-analysis.jsx |
| `CORR`, `corr` | data.jsx | data.jsx (optimize) |
| `fmtPct`, `fmtPctSigned`, `fmtUSD`, `fmtUSDc`, `fmtNum` | ui.jsx → also in **src/ui.js** | all view files |
| `SERIES_COLORS`, `assetColor` | ui.jsx → also in **src/ui.js** | charts.jsx, all view files |
| `I18N`, `t` (translate helper) | ui.jsx → also in **src/ui.js** | all view files |
| `Card`, `Metric`, `Pill`, `Table`, `Alert`, `ModuleIntro`, `InsightGrid`, `InsightCard`, `Segmented`, `Spark` | ui.jsx → also in **src/ui.jsx** | all view files |
| `Icon` | sidebar.jsx → also in **src/sidebar.jsx** | sidebar.jsx (internal) |
| `Sidebar` | sidebar.jsx → also in **src/sidebar.jsx** | app.jsx |
| `PROFILES` | sidebar.jsx → also in **src/sidebar.jsx** | (available globally) |
| `GrowthChart`, `Donut`, `HBars`, `VBars`, `MiniLine`, `Heatmap`, `FanChart`, `Histogram` | charts.jsx → also in **src/charts.jsx** | all view files |
| `OverviewTab`, `RiskTab` | views-overview.jsx → also in **src/views/overview.jsx** | app.jsx |
| `dataProviderLabel`, `dataProviderTone` | views-overview.jsx → also in **src/views/overview.jsx** | views-overview.jsx (internal), views-analysis.jsx |
| `AnalysisTab`, `OptimizationTab`, `SimulationTab`, `CompanyTab`, `DataTab` | views-analysis.jsx → also in **src/views/analysis.jsx** | app.jsx |

### Load-order constraint

The smoke test (`npm run test:smoke`) enforces this exact script order:

```
data.jsx → charts.jsx → ui.jsx → sidebar.jsx →
views-overview.jsx → views-analysis.jsx → app.jsx
```

Breaking this order crashes the app silently at runtime.

---

## 3. Architecture Risk Assessment

### Risk 1 — Browser-side Babel transpilation ✓ *Resolved — Phase 6i (2026-06-06)*

**What it was:** `@babel/standalone` (3 MB compressed) transpiled all JSX at page load time in the user's browser.  
**Consequence:** 200–600 ms parse+transpile cost on every cold load; no caching benefit between files; error messages pointed to generated output, not source lines.  
**Resolution (Phase 6i):** Babel Standalone and React UMD CDN scripts removed from `index.html`. `src/app.jsx` is now the module entry; Vite compiles all JSX at build time. Production build: 261 kB JS / 81 kB gzip, 28 modules, ~450–700 ms build time (React 18.3.1).

### Risk 6 — No CI or reproducible build environment ✓ *Resolved — Phase 7b (2026-06-07)*

**What it was:** All tests ran locally only. No guarantee the build or tests would pass in a clean environment or on a fresh clone. No validation that the production build output was structurally correct.  
**Resolution (Phase 7b):** `.github/workflows/ci.yml` added. Runs on every push and pull request: `npm ci` → Playwright Chromium install → `npm run build` → `npm run test:build` → 14 Node.js validation suites → `npm run test:e2e` (19 Playwright tests). Ubuntu latest, Node.js 20. No `FINNHUB_API_KEY` required. Playwright test-results artifact uploaded on failure (7-day retention).  
**Resolution (Phase 7d):** `scripts/build-check.mjs` added (15 checks, Node.js built-ins only). Verifies `dist/` structure, confirms absence of Babel/UMD/legacy references in `dist/index.html`, asserts no `.jsx` files or `dist/legacy/` directory in build output, enforces raw ≤ 400 kB and gzip ≤ 150 kB bundle ceilings. `vite.config.js` sets `build.copyPublicDir: false` to prevent `public/legacy/*.jsx` from appearing in `dist/`. `npm run test:build` runs in CI immediately after `npm run build`.

### Risk 2 — Global window coupling *(Partially resolved — Phase 6b/6c — 2026-06-06)*

**What it was:** All seven JSX files communicate through `window.*` global symbols. No module system, no explicit imports, no encapsulation.  
**Consequence:** Any rename, removal, or load-order change silently breaks dependent files. Impossible to tree-shake or code-split. Hard to unit-test in isolation.

**Phase 6b change:** Pure data/financial logic extracted to `src/data.js` (ES module). Test scripts now import directly from `src/data.js` instead of using `vm.runInContext` on `data.jsx`. `public/legacy/data.jsx` unchanged as the browser shim.

**Phase 6c change:** Shared UI utilities extracted to `src/ui.js` (pure-JS ES module: formatters, colors, I18N, t) and `src/ui.jsx` (React components: Card, Metric, Pill, Table, Alert, ModuleIntro, InsightGrid, InsightCard, Segmented, Spark). `public/legacy/ui.jsx` unchanged as the browser shim assigning all symbols to `window.*`. `scripts/ui-check.mjs` tests the pure-JS exports from `src/ui.js` in Node.js.

**Phase 6d change:** All 8 SVG chart components extracted to `src/charts.jsx` (`GrowthChart`, `Donut`, `HBars`, `VBars`, `MiniLine`, `Heatmap`, `FanChart`, `Histogram`). Uses `/* @jsx React.createElement */` pragma and the UMD `window.React` global — same approach as `src/ui.jsx`. Private helpers `extent` and `pathFrom` remain unexported. `public/legacy/charts.jsx` unchanged as the browser shim. `scripts/charts-check.mjs` (10 tests) verifies exports, pragma, helper privacy, and window export parity via text analysis (Node.js cannot parse JSX). `npm run test:charts` added to `package.json`.

**Phase 6e change:** Sidebar component layer extracted to `src/sidebar.jsx`. Exports: `Sidebar`, `Icon`, `PROFILES`. Imports `t` and `fmtUSD` from `src/ui.js`; imports `UNIVERSE` and `lookup` from `src/data.js` — replacing the implicit `window.*` dependency on those symbols. Private helpers `rangeStart`, `PROFILE_COPY`, `DATE_PRESETS` remain unexported. `public/legacy/sidebar.jsx` unchanged as the browser shim. `scripts/sidebar-check.mjs` (12 tests). `npm run test:sidebar` added to `package.json`.

**Phase 6f change:** Overview view extracted to `src/views/overview.jsx`. Exports: `OverviewTab`, `RiskTab`, `dataProviderLabel`, `dataProviderTone`. Imports all UI primitives from `src/ui.js` and `src/ui.jsx`, all charts from `src/charts.jsx`, and `corr` + `GLOSSARY` from `src/data.js` — the most import-heavy migration step so far. `RISK_COPY` bilingual constant remains private. `public/legacy/views-overview.jsx` unchanged. `scripts/overview-check.mjs` (16 tests). `npm run test:overview` added to `package.json`.

**Phase 6g change:** Analysis view extracted to `src/views/analysis.jsx`. Exports: `AnalysisTab`, `OptimizationTab`, `SimulationTab`, `CompanyTab`, `DataTab`. Imports from all 4 upstream modules (`../ui.js`, `../ui.jsx`, `../charts.jsx`, `../data.js`) and from `./overview.jsx` (`dataProviderLabel`, `dataProviderTone`). All 12 private helpers remain unexported: `MODULE_COPY`, `moduleCopy`, `classOf`, `OptStat`, `BigStat`, `fmtNewsDate`, `normalizeNewsItem`, `ProfRow`, `companyDisplay`, `SrcItem`, `proxyHealthDisplay`, `marketHistoryDisplay`, `referenceDataDisplay`. The only functional code change from the legacy file: the legacy `window.DATA_SOURCES` global inside `CompanyTab`'s news-fetch effect is replaced with the imported `DATA_SOURCES` constant. `public/legacy/views-analysis.jsx` unchanged. `scripts/analysis-check.mjs` (18 tests). `npm run test:analysis` added to `package.json`.

**Phase 6h change (audit only — 2026-06-06):** Full audit of `public/legacy/app.jsx` completed. All 18 `window.*` dependencies inventoried and mapped to their `src/` module equivalents. All 14 root state variables, 5 useEffect hooks, 2 useMemo hooks, 4 API/fetch paths, 2 localStorage keys, and the full child component prop map documented in `docs/APP_MIGRATION_AUDIT.md`. Migration risks identified and Phase 6i implementation plan written. No runtime code changed.

**Phase 6i-prep change (React npm dep — 2026-06-06):** `react` and `react-dom` added as npm dependencies. `import React from "react"` added to all 5 `src/*.jsx` files (`src/ui.jsx`, `src/charts.jsx`, `src/sidebar.jsx`, `src/views/overview.jsx`, `src/views/analysis.jsx`). These files no longer depend on the CDN `window.React` UMD global — React is now sourced from `node_modules`. Four test scripts updated to enforce the npm React import requirement. `index.html`, `public/legacy/*.jsx`, Babel Standalone CDN scripts, and the browser runtime are all unchanged. This eliminates the dual-React risk for the upcoming `src/app.jsx` creation and index.html cutover.

**Phase 6i change (app.jsx cutover — 2026-06-06):** `src/app.jsx` created as a mechanical port of `public/legacy/app.jsx`. All 18 `window.*` consumer references replaced with explicit ES module imports from the 6 already-extracted `src/` modules. Hook aliases renamed to standard names (`useStateApp`→`useState`, etc.). `ReactDOM.createRoot` replaced with `createRoot` from `react-dom/client`. The inline 82-line `<style>` block, both useMemo hooks (`p` and `pAdj`), all 5 useEffect hooks, all 14 state variables, localStorage keys, `window.__exportTab`, and `window.__exportDone` are copied verbatim. `index.html` atomically swapped: 3 CDN scripts + 7 `<script type="text/babel">` tags removed; replaced with a single `<script type="module" src="/src/app.jsx">`. Babel Standalone and React UMD CDN fully eliminated from the browser runtime. `scripts/app-check.mjs` added (25 source-text assertions). `npm run test:app` wired in `package.json`. Production build (`npm run build`) produces 30 modules, 318 kB JS (97 kB gzip), in 731 ms. All 14 Node.js test suites and 19/19 Playwright E2E tests pass. `public/legacy/app.jsx` preserved unchanged on disk.

**Remaining gap:** None — all Phase 6 migration steps complete. The window.* coupling map in Section 2 is now historical; the browser runtime no longer reads any `window.*` globals (only the legacy shim files still write to them, unused). Phase 7 CI/CD is the next pending work.

**Migration path:** Phase 6 complete. Phase 7 — CI, build validation, deployment docs.

### Risk 3 — Single-file analytics monolith *(Partially resolved in Phase 6b — 2026-06-06)*

**What it was:** `data.jsx` contained the full financial math engine (~350 lines), mock data engine, correlation matrix, optimizer, Monte Carlo, and the adapter pattern in one file. The smoke and metrics test scripts worked around the browser-only `window` context by executing the file through Node's `vm.runInContext`.

**Phase 6b change:** All pure data and financial logic extracted into `src/data.js` — a genuine Vite-native ES module with named exports (`UNIVERSE`, `DATA_SOURCES`, `buildPortfolio`, `monteCarlo`, `optimize`, etc.). `public/legacy/data.jsx` remains unchanged as the browser-Babel compatibility shim that assigns the same logic to `window.*` for the legacy script consumers. `scripts/smoke-check.mjs` and `scripts/metrics-check.mjs` now `import` directly from `src/data.js`, eliminating the `vm.runInContext` workaround.

**Remaining gap:** `public/legacy/data.jsx` still duplicates all logic from `src/data.js`. A future migration step (Phase 6, Step 2) will make `data.jsx` a thin adapter that imports from `src/data.js` and re-exports to `window` — once the browser-Babel context is replaced by Vite ES module bundling.

**Migration path:** Phase 6, Step 3–10 — migrate remaining JSX files; Phase 9 — remove Babel Standalone and React UMD CDN.

### Risk 4 — Hardcoded risk-free rate ✓ *Resolved in Phase 3a (2026-06-06)*

**What it was:** `rf = 0.043` was hardcoded in `buildPortfolio`, `optimize()`, and the rolling Sharpe loop in `data.jsx`. The sidebar's user-editable rf input was only applied via a post-build `pAdj` override in `app.jsx`, leaving the optimizer and rolling Sharpe using the constant.  
**Resolution:** `buildPortfolio` now reads `opts.rf` with a `Number.isFinite` + non-negative guard (fallback: `0.043`). The `rf` value is passed to both `optimize("sharpe", rf)` and `optimize("risk", rf)` calls. `optimize()` accepts `rf` as a third parameter (default `0.043`). `app.jsx` passes `assumptions.rf` into `buildPortfolio` opts and includes it in the `useMemo` dependency array. Rolling Sharpe and sortino use the same `rf` variable in `buildPortfolio` scope and are fixed automatically.  
**Remaining gap:** Monte Carlo drift (`annRet - 0.5 * annVol² * dt`) does not subtract rf; this is intentional — the formula operates in the real-world measure and `annRet` already encodes all return assumptions.

### Risk 5 — Proxy: no rate-limiting, no request deduplication *(Partially resolved in Phase 5a — 2026-06-06)*

**What it was:** `market-data-server.mjs` was a thin HTTP pass-through with no cache, no deduplication, and no rate-limit handling.

**Phase 5a changes (`server/cache.mjs` + updated `market-data-server.mjs`):**
- In-memory response cache with per-route TTLs:
  - `quote`: 60 s — live price, expires quickly
  - `history`: 30 min — daily candles are stable within a session
  - `candles`: 30 min
  - `profile`: 12 h — company metadata rarely changes
  - `news`: 10 min — headline feed updates periodically
- Cache keys are stable and deterministic: `route?param1=v1&param2=v2` (params sorted alphabetically).
- Errors (non-200 status or `ok: false`) are never cached — every failed call retries on the next request.
- In-flight request de-duplication: concurrent identical requests share one outbound call.
- Bounded memory: `maxEntries = 500` with oldest-first eviction after TTL sweep.
- Additive `cacheStatus: "hit" | "miss" | "deduped"` field in all cached-route responses (non-breaking).
- `cachedAt` (ISO timestamp) and `ttlSeconds` fields added on cache hits only.
- `/api/health` response now includes a `cache` stats object: `cacheEntries`, `inFlightRequests`, `cacheHits`, `cacheMisses`, `dedupedRequests`.
- Cache is per-server-instance (created inside `createMarketDataServer()`), so test isolation is preserved.

**Phase 5b changes (Company News frontend):**
- `CompanyTab` in `views-analysis.jsx` now fetches live news from `/api/company/news` via `useEffectVA` on symbol change.
- Fetch gated on `apiStatus.ok`; cancellation pattern prevents stale state on symbol change or unmount.
- `normalizeNewsItem` / `fmtNewsDate` helpers sanitize and format Finnhub news items client-side.
- News is displayed as company context only; failure never affects analytics.
- `app.jsx` passes `apiStatus` prop to `CompanyTab`.
- Static `NEWS` mock placeholder removed from the news card path.

**Phase 5d changes (Finnhub 429 rate-limit guard — 2026-06-06):**
- `parseRetryAfter(header)` added to `market-data-server.mjs`: parses `Retry-After` as decimal-seconds string, HTTP-date string, or falls back to 60 s for missing/invalid values.
- `fetchFinnhub()` detects HTTP 429 before reading the response body and returns `{ ok: false, error: "rate_limited", provider: "finnhub", retryAfter: <seconds> }` with `statusCode: 429`.
- 429 responses are **never cached**: `cache.getOrFetch()` already skips caching for non-200 or `ok:false` results — no cache change required.
- `fetchHistoricalPrices()` falls through to Yahoo Finance fallback on Finnhub 429; the `warning` field describes the rate-limit event and retry-after seconds.
- `FINNHUB_API_KEY` is not included in any 429 response payload.
- Frontend (`app.jsx`): `rateLimitWarning` state detects `error === "rate_limited"` in history, quote, and profile fetch results; a compact `rate-limit-banner` strip appears between tabnav and content (only visible when triggered, does not change layout structure).
- Frontend (`views-analysis.jsx`): news fetch detects `error === "rate_limited"` → `newsState.status = "rate_limited"` → renders a non-blocking warning in the news card using `copy.newsRateLimit`; bilingual copy in EN and TR.
- Rate-limit warnings never crash the dashboard and do not affect portfolio analytics or mock fallback.
- `scripts/rate-limit-check.mjs` with 14 tests: parseRetryAfter (seconds, decimal, HTTP-date future/past, missing, invalid, zero/negative), 429 not cached, payload shape, no-key behavior unchanged, EN/TR copy presence, views-analysis.jsx handling, API key not in payload, cache success path preserved.
- `npm run test:ratelimit` wired in `package.json`.

**Remaining gaps:** No request debounce on the frontend, no HTTPS, no graceful SIGTERM/SIGINT shutdown.

### Risk 6 — Benchmark hardcoded to VTI with magic haircut *(Transparency addressed in Phase 3b — 2026-06-06)*

**What it is:** The benchmark comparison chart uses VTI price history (real when the proxy is running, mock GBM otherwise), with daily returns scaled by `BENCH_EQUITY_SCALAR = 0.85` and a `BENCH_DAILY_INCOME = 0.0001` per-day drift to approximate 60/40 equity/bond behavior.  
**Phase 3b changes:**
- Magic literals extracted into named constants `BENCH_EQUITY_SCALAR` and `BENCH_DAILY_INCOME` with explanatory comments in `data.jsx`.
- Misleading code comment "60/40-ish via VTI/BND blend" corrected — BND is never fetched for the benchmark path.
- UI subtitle updated from "benchmark path" to "simplified balanced reference (VTI-based, ≈60/40 scenario)".
- Chart legend updated from "Benchmark" to "Balanced ref. (≈60/40)".
- Beta metric tooltip updated to clarify it is a Sharpe-based approximation, not regression-derived.

**Remaining gap:** The reference scenario is always VTI-based. There is no user-selectable benchmark or a true 60/40 blend using BND history.  
**Migration path:** Phase 3c — add benchmark dropdown; implement a real 60/40 blend.

### Risk 7 — VaR formula uses parametric normal approximation *(Documented in Phase 4a — 2026-06-06)*

**What it is:** `var95 = -1.65 * annVol * sqrt(21/252)` — parametric 95% VaR over 21 trading days, assuming normality and zero mean drift. CVaR is not computed; it was incorrectly claimed in the README (corrected in Phase 4a).  
**Consequence:** VaR understates tail risk when returns have excess kurtosis or negative skew. The normality assumption is the main limitation.  
**Phase 4a change:** Formula comment updated. README CVaR overclaim corrected. VaR formula documented in `docs/FINANCIAL_METRICS.md`.  
**Phase 4b change:** Empirical CVaR (`cvar95`) added — mean of worst 5% daily returns scaled to 1-month via sqrt(21). Guards for short history (< 20 observations) and non-finite tail mean return 0. Tests 14–15 in `scripts/metrics-check.mjs` verify sign, magnitude (CVaR ≤ VaR), and zero guard.

### Risk 8 — Beta approximation ✓ *Resolved in Phase 4b (2026-06-06)*

**What it was:** `beta = 0.94 + (sharpe - 1) * 0.02` was a synthetic approximation, not regression-derived.  
**Resolution:** Beta is now computed as `cov(portRets, benchRets) / var(benchRets)` using the VTI benchmark daily returns already available in `buildPortfolio`. A `sampleCov` helper (n−1 denominator) and `calcBeta` wrapper (with fallback 1.0 for n<20, near-zero benchmark variance, or non-finite result) were added to `data.jsx`. The Beta tooltip in `views-overview.jsx` and the GLOSSARY entry in `data.jsx` are updated to describe the data-derived formula. Tests 12–13 in `scripts/metrics-check.mjs` verify the new computation and fallback behavior.  
**Remaining gap:** VTI is the fixed benchmark — no user-selectable benchmark (Phase 3c).

### Risk 9 — Optimizer is a deterministic tilt heuristic, not a true optimizer *(Documented in Phase 4a)*

**What it is:** `optimize()` adjusts weights by a linear tilt formula based on individual asset Sharpe scores. Constants `0.6` / `0.45` (maxSharpe) and `0.22` / `1.4` (minRisk) are calibrated heuristics. It does not solve the mean-variance optimization problem.  
**Phase 4a change:** Constants documented with inline comments in `data.jsx`. Optimizer outputs validated in `scripts/metrics-check.mjs` (weight sum = 1.0, floor ≥ 0.02).  
**Consequence:** The "Max Sharpe" output is a directional tilt suggestion, not the true efficient frontier portfolio.  
**Migration path:** Phase 4b — add a UI disclaimer note; Phase 6+ — replace with quadratic programming if needed.

---

## 4. Backend Proxy: Production-Readiness Gaps

| Gap | Severity | Notes |
|---|---|---|
| No rate-limit handling | Medium | Finnhub free tier: 60 req/min. Cache reduces calls but no 429 backoff handler. |
| Response cache | ✓ Resolved Phase 5a | Per-route TTL cache in `server/cache.mjs`. Errors not cached. |
| Request deduplication | ✓ Resolved Phase 5a | Concurrent identical in-flight requests share one outbound call. |
| CORS wildcard `*` | Low | Acceptable for local-only proxy; must be locked if ever deployed remotely. |
| No HTTPS | Low | Local-only; acceptable for personal use. Not acceptable for network deployment. |
| Port hardcoded to 8787 | Low | `MARKET_DATA_PORT` env var override exists; document it clearly. |
| No graceful shutdown | Low | SIGTERM/SIGINT not handled. Fine locally; needed for containerized deployment. |
| Yahoo Finance URL is unofficial | Medium | `query1.finance.yahoo.com` is an undocumented endpoint. It may break without notice. Should be treated as best-effort fallback only. |
| No error logging | Low | `console.log` statements are absent. Production proxy needs structured logging. |

---

## 5. Test Coverage Assessment

| Test | What it covers | What it misses |
|---|---|---|
| `npm run test:smoke` | Load order, export presence, empty portfolio safety, unknown ticker filtering, tab order, data tab guard | Per-formula accuracy, edge values (single asset, negative weights, zero vol), i18n completeness |
| `npm run test:api` | Health endpoint (incl. cache stats), symbol validation (400), no-key 503 | Rate limit behavior, Yahoo fallback trigger, concurrent request handling, malformed upstream responses |
| `npm run test:history` | Finnhub and Yahoo candle normalization, empty payload | Partial data (nulls in OHLCV), timezone edge cases, adjClose vs close priority logic |
| `npm run test:cache` *(Phase 5a)* | Cache key stability, TTL expiry, error non-caching, success caching, in-flight deduplication, max-entries cap, stats accuracy, health cache object, backward compat, no-key behavior | Cache behavior under real network conditions, memory pressure at scale |
| `npm run test:news` *(Phase 5b)* | `normalizeNewsItem` valid/invalid/edge cases, URL scheme validation, headline truncation, `fmtNewsDate` EN+TR relative times and ISO fallback, non-array data safety, slice limit, URL construction correctness | Live Finnhub endpoint reachability, proxy integration |
| `npm run test:ratelimit` *(Phase 5d)* | `parseRetryAfter` (seconds, decimal, HTTP-date, missing, invalid, zero/negative), 429 not cached, payload shape, no-key behavior unchanged, EN+TR copy presence, views-analysis rate_limited handling, API key not in payload, cache success path preserved | Real Finnhub 429 response in production, Retry-After header values from real server |
| `npm run test:e2e` *(Phase 6a)* | App loads without JS errors; shell structure (sidebar, topbar, tabnav, content); 7 tab buttons; active tab; all 7 tabs navigable and render without crash; rapid tab cycling; mock/offline fallback; Company Data offline; Data tab offline; theme toggle (dark↔light); content visible after theme change | Per-tab data quality assertions, exact metric values, chart content, adding/removing tickers interactively, language toggle text changes, accessibility, CI headless behavior |
| `npm run test:ui` *(Phase 6c)* | All formatter functions, `SERIES_COLORS`/`assetColor`, `I18N` structure and required keys, `t()` translation+fallback, bilingual `rateLimitWarn`, `src/ui.jsx` existence and component exports, legacy window export parity, I18N key parity | React component runtime behavior (JSX not importable in Node.js), visual rendering |
| `npm run test:charts` *(Phase 6d)* | `src/charts.jsx` existence; all 8 `export function` declarations; `@jsx React.createElement` pragma; `extent`+`pathFrom` private; no `Object.assign(window,...)` in src; legacy window export parity; no npm React import; CSS custom property usage; exactly 8 exports | Chart rendering, SVG output, hover interactions, browser visual regression |
| `npm run test:sidebar` *(Phase 6e)* | `src/sidebar.jsx` existence; all 3 exports (`Sidebar`, `Icon`, `PROFILES`); `@jsx` pragma; imports `t`+`fmtUSD` from `./ui.js` and `UNIVERSE`+`lookup` from `./data.js`; private helpers not exported; no `Object.assign(window,...)`; non-advisory disclaimer preserved; legacy window export parity; exactly 3 named exports | Sidebar rendering, search field, holdings editing, rf slider, theme toggle — covered by Playwright |
| `npm run test:overview` *(Phase 6f)* | `src/views/overview.jsx` existence; all 4 exports (`OverviewTab`, `RiskTab`, `dataProviderLabel`, `dataProviderTone`); `@jsx` pragma; imports from `../ui.js`, `../ui.jsx`, `../charts.jsx`, `../data.js`; `RISK_COPY` private; no `Object.assign(window,...)`; `dataProviderLabel`/`Tone` return values; sourceCol key in RISK_COPY; benchmark wording preserved; legacy window export parity; exactly 4 named exports | Tab rendering, chart output, data-provider pills — covered by Playwright |
| `npm run test:analysis` *(Phase 6g)* | `src/views/analysis.jsx` existence; all 5 exports (`AnalysisTab`, `OptimizationTab`, `SimulationTab`, `CompanyTab`, `DataTab`); `@jsx` pragma; React hook aliases (`useMemoVA`, `useStateVA`, `useEffectVA`); imports from `../ui.js`, `../ui.jsx`, `../charts.jsx`, `../data.js`, `./overview.jsx`; `MODULE_COPY` private; all 12 private helpers not exported; no `Object.assign(window,...)`; no npm React import; no `window.DATA_SOURCES` reference; `newsRateLimit` copy key present; `newsContextNote` non-advisory copy; legacy window export parity; exactly 5 named exports | Tab rendering, news fetch, rate-limit UI state — covered by Playwright |

**Missing test categories:**
- Financial formula unit tests (VaR, CVaR, beta, Sortino, rolling metrics)
- Monte Carlo output distribution validation (mean/std within expected range)
- Optimizer output constraint validation (weights sum to 1, no weight below floor)
- i18n completeness (all I18N keys present in both `en` and `tr`)
- Interactive user flows (ticker search → add → portfolio update → tab reflects new asset)

---

## 6. Summary Table

| Area | Current state | Production-ready? |
|---|---|---|
| Frontend module system | Global window, browser Babel | No |
| Build pipeline | Vite static serving only | Partial |
| Financial formulas | Functional for prototyping | Partial (rf inconsistency, beta approx, VaR scaling) |
| Optimizer | Heuristic tilt | No (not MVO) |
| Backend proxy | Thin pass-through, no cache | No |
| Data fallback chain | Well-designed (real → partial → mock) | Yes |
| Test coverage | Smoke + API + normalization + cache + news + rate-limit + browser (19 Playwright) | Partial |
| i18n | TR + EN, consistent | Yes |
| Accessibility | Not evaluated | Unknown |
| Error/loading states | Present in UI | Partial |
