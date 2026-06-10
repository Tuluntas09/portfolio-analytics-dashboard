# Productization Roadmap

**Project:** Quant Portfolio Analytics Dashboard  
**Date:** 2026-06-07  
**Goal:** Gradual, safe evolution from CV/GitHub prototype to real-world personal portfolio analytics tool.

---

## Product Positioning Statement

This dashboard is a **personal portfolio analytics and risk-monitoring tool**.

It is **not** an investment advisory product. It does not:

- Provide buy or sell recommendations
- Produce target prices
- Predict future returns
- Constitute financial advice of any kind

Every module answers an analytical question about the user's existing portfolio.
The correct framing for all metrics, charts, and scenarios is:
*"What does the data say about historical behavior and modeled risk?"* —
not *"What should I do?"*

This boundary must be preserved through every phase of productization.

---

## Phase Overview

| Phase | Theme | Effort | Code change? |
|---|---|---|---|
| 0 | Product positioning and non-advisory language | XS | Minimal |
| 1 | Architecture audit and migration map | XS | No |
| 2 | Data quality and source transparency | S | Yes |
| 3 | User-controlled assumptions | S | Yes |
| 4 | Financial metric validation and edge-case tests | M | Yes |
| 5 | Company news and company data hardening | S | Yes |
| 6 | Gradual legacy JSX → Vite ES module migration | L | Yes |
| 7 | Browser tests, CI, and deployment readiness | M | Yes |
| 8 | Real-world usability features | M | Yes |

---

## Phase 0 — Product Positioning and Non-Advisory Language

**Goal:** Make the non-advisory boundary explicit in the UI and codebase before any other change.

**Why first:** Every subsequent feature adds analytical depth. Without a clear positioning statement the project can accidentally drift toward appearing advisory.

### Tasks

- [x] Add a one-sentence disclaimer to the sidebar footer.  
  Added to `sidebar.jsx` as a compact 9.5 px faint-text line using existing `text-faint` color: "Analytics only — not financial advice." / "Yalnızca analitik araç — yatırım tavsiyesi değildir."
- [x] Review `MODULE_COPY` text in `views-analysis.jsx` for advisory language.  
  Changed `recommended` → `"model-suggested"`, `suggestedChanges` → `"Model output: allocation scenario"`, `suggestedSubSharpe/Risk` subtitles reframed as model-implied weight shifts.
- [x] Optimization tab allocation table framed as model output, not action directive.  
  Card title now reads "Model output: allocation scenario"; subtitles say "model-implied weight shifts".
- [x] Add `DISCLAIMER.md` at the project root for GitHub visitors.
- [x] Update the README positioning section.  
  Added a "Ürün Sınırı" section listing the non-advisory boundary with a link to `DISCLAIMER.md`.

**Acceptance:** No UI text reads as a buy/sell signal or investment recommendation. ✓ *Completed 2026-06-06.*

---

## Phase 1 — Architecture Audit and Migration Map

**Goal:** Document the current state (this file + `ARCHITECTURE_AUDIT.md`) before touching any code. Establish a clear picture of global window dependencies, test gaps, and proxy limitations.

### Deliverables (completed in this phase)

- [x] `docs/ARCHITECTURE_AUDIT.md` — full global dependency map, risk table, test gaps
- [x] `docs/DATA_QUALITY_MODEL.md` — data source hierarchy, state machine, known gaps
- [x] `docs/PRODUCTIZATION_ROADMAP.md` — this file

### Carry-forward decisions

The following architectural decisions are deliberately deferred:
- Legacy JSX migration → Phase 6
- Proxy caching → Phase 5
- Formula replacement → Phase 4
- New dependencies → Phase 6 minimum

**Acceptance:** All three docs exist. No runtime behavior changed.

---

## Phase 2 — Data Quality and Source Transparency Layer

**Goal:** Make data quality visible and trustworthy to the user without changing the analytics.

### Tasks

#### 2a — Per-symbol data source in Data tab ✓ *Completed 2026-06-06*

Added a "Symbol data sources" `Card` in the Data tab (non-empty portfolio path)
with a compact `Table` showing each holding's `t`, `name`, and `dataProvider` as a
color-coded pill (Finnhub → green, Yahoo Fallback → yellow, Deterministic Mock → grey).

#### 2b — Last-fetched timestamp

Show a "Last updated: HH:MM:SS" next to the data status badge in the sidebar.
Store `Date.now()` when `setHistoryBySymbol` and `setQuoteBySymbol` resolve.
*Deferred — carry-forward to Phase 3.*

#### 2c — Manual refresh button

Add a refresh icon button in the sidebar data status row.
*Deferred — carry-forward to Phase 3.*

#### 2d — Stale-data warning

Soft warning if session open > 60 minutes.
*Deferred — carry-forward to Phase 3.*

#### 2e — Per-symbol data quality in the asset table ✓ *Completed 2026-06-06*

Added a "Source" column to the Holdings detail table in the Overview tab, showing
the same color-coded provider pill per asset using `dataProviderLabel` / `dataProviderTone`
helpers (defined in `views-overview.jsx`, exported to `window`).

**Constraints:** No new npm packages. Used existing `Pill`, `Table`, and CSS variables.

**Acceptance:** User can see which symbols are real vs. mock. ✓  
*Remaining gap:* Last-fetched timestamp and manual refresh button deferred.

---

## Phase 3 — User-Controlled Assumptions

**Goal:** Make the model's key assumptions user-visible and consistent across all calculations.

### Current inconsistency map

| Assumption | UI control? | Actually used everywhere? |
|---|---|---|
| Risk-free rate (rf) | Yes (sidebar) | No — optimizer and drift use hardcoded 0.043 |
| Monte Carlo horizon | Yes (sidebar) | Yes |
| Monte Carlo paths | Yes (sidebar) | Yes |
| Benchmark | No | Hardcoded VTI with 0.85 haircut |
| VaR confidence level | No | Hardcoded 95% |
| Trading cost assumption | No | Hardcoded 0.1% label in Optimization tab |

### Tasks

#### 3a — Thread `assumptions.rf` through optimizer ✓ *Completed 2026-06-06*

`buildPortfolio` now reads `opts.rf` with a NaN/negative guard (fallback `0.043`).
`optimize()` accepts `rf` as a third parameter; both `optimize("sharpe", rf)` and
`optimize("risk", rf)` calls pass it through. `app.jsx` passes `assumptions.rf` into
`buildPortfolio` and adds it to the `useMemo` dependency array. Rolling Sharpe and
sortino are fixed automatically as they reference the same `rf` variable in scope.
Smoke test extended with rf propagation and NaN-fallback checks.

#### 3b — Thread `assumptions.rf` into Monte Carlo *(Resolved — no change needed)*

`monteCarlo()` drift formula `(annRet - 0.5 * annVol² * dt)` operates in the
real-world measure; rf is not subtracted from drift in this context. `annRet` already
encodes all return assumptions. No change required.

#### 3c — Benchmark selector *(Transparency pre-work done 2026-06-06)*

**Pre-work completed (Phase 3b task):**
- Magic constants `0.85` and `0.0001` named as `BENCH_EQUITY_SCALAR` / `BENCH_DAILY_INCOME` in `data.jsx`, with explanatory comments documenting the approximation rationale.
- Misleading code comment "60/40-ish via VTI/BND blend" replaced with accurate description (BND is not used).
- UI card subtitle updated to "simplified balanced reference (VTI-based, ≈60/40 scenario)".
- Chart legend updated to "Balanced ref. (≈60/40)" / "Dengeli ref. (≈60/40)".
- Beta metric tooltip updated to note synthetic (Sharpe-based) computation.

**Remaining full implementation:**
Add a benchmark dropdown to the sidebar: VTI (default), SPY, QQQ, BND.
Pass the selected benchmark ticker into `buildPortfolio`. Use the selected
benchmark's real or mock path for the comparison chart.
For a true 60/40 blend: fetch both VTI (equity leg) and BND (bond leg) history,
combine at 60/40 weights, and replace the current BENCH_EQUITY_SCALAR approximation.

#### 3d — Trading cost input

Replace the hardcoded `"0.10%"` label in the Optimization tab with a value
read from `assumptions.tradingCost` (default 0.10%). Add the input to the
Advanced Assumptions section in the sidebar.

#### 3e — VaR confidence level toggle

Add a 95% / 99% toggle for VaR. Pass it through to the VaR formula.

**Constraints:** Keep the existing sidebar `assumptions` state object; add new fields to it. Do not change the financial formula implementations yet (that is Phase 4).

**Acceptance:** Changing rf in the sidebar produces a visible difference in Sharpe and Sortino across all tabs. Benchmark change updates the cumulative growth chart.

---

## Phase 4 — Financial Metric Validation and Edge-Case Tests

**Goal:** Ensure the financial formulas are correct, documented, and tested at the unit level.

### Known formula issues resolved table

| Metric | Issue | Phase 4a status | Phase 4b target |
|---|---|---|---|
| Beta | Synthetic; not from data | ✓ Resolved Phase 4b — `cov(portRets, benchRets) / var(benchRets)` | — |
| CVaR | Never computed; README overclaimed | ✓ Resolved Phase 4b — empirical: mean worst-5% daily × sqrt(21) | — |
| VaR horizon | Correct formula; undocumented | Comment updated; formula in `FINANCIAL_METRICS.md` | Normality gap documented; test added |
| Sortino `0.72` | Magic constant; undocumented | Documented in code and metrics doc | True downside deviation |
| Optimizer constants | `0.6`, `0.45`, `0.22`, `1.4` undocumented | Inline comments added | True MVO (Phase 6+) |
| Sharpe/Sortino zero-vol | Division by zero for flat price paths | Guard added; zero-vol test added | — |

### Tasks

#### 4a — Formula documentation, zero-vol guards, and metrics test script ✓ *Completed 2026-06-06*

- Added `annVol > 0` guards for `sharpe` and `sortino` in `buildPortfolio`.
- Added inline comments documenting optimizer constants (`0.6`, `0.45`, `0.22`, `1.4`), Sortino `0.72` approximation, and VaR formula.
- Updated GLOSSARY Beta entry in `data.jsx` to state synthetic computation.
- Corrected README CVaR overclaim: "VaR, CVaR" → "parametrik VaR (95%, 1 aylık)".
- Created `docs/FINANCIAL_METRICS.md` — full formula reference table with limitations and test coverage.
- Created `scripts/metrics-check.mjs` and wired as `npm run test:metrics`.
  Covers: finite outputs, single-asset, negative-return, mdd bounds, VaR sign, Sortino/Sharpe relationship, zero-vol guard, optimizer constraints, rolling metric lengths, benchCum validity.

#### 4b — Data-derived beta and empirical CVaR ✓ *Completed 2026-06-06*

- `sampleCov(xs, ys)` helper (n−1 denominator) and `calcBeta(portRets, benchRets)` wrapper added to `data.jsx`.
- Beta now computed as `cov(portRets, benchRets) / var(benchRets)` using the VTI benchmark returns already available in `buildPortfolio`. Fallback 1.0 when n<20, benchmark variance<1e-12, or result non-finite.
- Empirical CVaR (`cvar95`) added: mean of worst 5% daily returns × sqrt(21). Guard returns 0 when portRets.length<20 or tail is empty/non-finite.
- `emptyPortfolio` extended with `cvar95: 0`.
- GLOSSARY Beta entry and Beta tooltip in `views-overview.jsx` updated to describe data-derived formula (EN + TR).
- `scripts/metrics-check.mjs` extended with tests 12–15: beta finite and not-synthetic, flat-benchmark fallback, CVaR sign and ≤VaR, zero-vol CVaR guard.
- All four test suites pass: `npm run test:smoke`, `npm run test:metrics`, `npm run test:api`, `npm run test:history`.

#### 4c — Function extraction *(Planned — Phase 6 prerequisite)*

Move `dailyReturns`, `pricePath`, `monteCarlo`, `optimize`, VaR/CVaR calculations into
a separate file for isolated unit testing. Currently blocked by global window architecture.

**Acceptance:** `npm run test:metrics` passes. All Phase 4a guards confirmed. No existing test regressions.

---

## Phase 5 — Proxy Hardening and Company Data

**Goal:** Harden the proxy against Finnhub API fragility and complete the Company Data tab.

### Tasks

#### 5a — In-memory cache and request de-duplication ✓ *Completed 2026-06-06*

Added `server/cache.mjs` — a small, standalone in-memory cache module used by `market-data-server.mjs`.

**What was added:**
- `createCache({ maxEntries, clock })` — returns `{ get, set, getOrFetch, stats, cacheKey }`.
- Per-route TTLs (conservative defaults): quote 60 s, history/candles 30 min, profile 12 h, news 10 min.
- Cache keys are deterministic: `route?param1=v1&param2=v2` with parameters sorted alphabetically.
- Errors (non-200 or `ok:false`) are never cached — failed calls always retry.
- In-flight de-duplication: concurrent requests for the same key share one outbound call.
- Bounded memory: `maxEntries=500` cap with oldest-first eviction after TTL sweep.
- Additive `cacheStatus: "hit"|"miss"|"deduped"` field in all cached-route HTTP responses.
- `cachedAt` (ISO) + `ttlSeconds` fields on cache-hit responses only.
- `/api/health` now includes a `cache` object: `cacheEntries`, `inFlightRequests`, `cacheHits`, `cacheMisses`, `dedupedRequests`.
- `npm run test:cache` (`scripts/cache-check.mjs`) with 14 tests covering all behaviors.
- Existing tests updated: `api-health-check.mjs` verifies cache stats presence.

**Design constraints preserved:**
- No new npm dependencies (native Node.js only).
- Cache is per-server-instance — test isolation unchanged.
- Finnhub → Yahoo fallback behavior unchanged.
- FINNHUB_API_KEY never exposed to the browser.
- All financial formulas, UI, and frontend code unchanged.

#### 5b — Wire `/api/company/news` to the frontend ✓ *Completed 2026-06-06*

The proxy already implements `GET /api/company/news?symbol=` (with caching from Phase 5a).

**What was added:**
- `useEffectVA` hook in `CompanyTab` (`views-analysis.jsx`) fetches live news from `/api/company/news` for the selected symbol on tab activation; re-fetches on symbol change.
- Fetch is gated on `apiStatus.ok`; if the proxy is offline, shows "unavailable" state (never breaks analytics).
- Cancellation pattern (`cancelled` flag) prevents state updates after symbol change or component unmount.
- `normalizeNewsItem(raw)`: validates and sanitizes Finnhub items — requires non-empty headline, defaults missing source to "—", validates URL scheme (http/https only; javascript: and ftp: rejected), converts `datetime * 1000` to Date, truncates headline at 120 chars with "…" suffix.
- `fmtNewsDate(dt, language)`: relative time formatter — seconds/minutes/hours/days ago with EN and TR output; falls back to ISO date for items older than 8 days.
- Four render states: `loading/idle` → spinner text; `unavailable` → proxy offline message; `error/empty` → no-news message; `loaded` → items list.
- Items capped at 6 per symbol to keep the card compact.
- All items framed as company context only — no advisory language, no buy/sell signals.
- `app.jsx` updated to pass `apiStatus={apiStatus}` to `CompanyTab`.
- Static `NEWS` mock data removed from the news card path entirely.
- `scripts/news-check.mjs` with 14 tests: URL construction, `normalizeNewsItem` valid/invalid/edge cases, `fmtNewsDate` EN+TR, slice limit, non-array safety.
- `npm run test:news` wired in `package.json`.

#### 5c — News card rendering ✓ *Completed 2026-06-06 (combined with 5b)*

Rendered in the existing `.news-item` / `.news-head` / `.news-meta` structure.
Links open in a new tab with `rel="noopener noreferrer"`.
Source initials shown in `.news-thumb` when no logo is available.
Context note footer: "News is provided for company context only — not as a market signal or recommendation."

#### 5d — Finnhub 429 rate-limit guard ✓ *Completed 2026-06-06*

**What was added:**

- `parseRetryAfter(header)` in `market-data-server.mjs`: parses the `Retry-After` header as a decimal-seconds string, HTTP-date string, or falls back to 60 s when the header is missing, zero, negative, or unparseable. Exported for test isolation.
- `fetchFinnhub()` detects `response.status === 429` before reading the body; returns `{ ok: false, error: "rate_limited", provider: "finnhub", retryAfter: <seconds> }` with `statusCode: 429`. `FINNHUB_API_KEY` is never included.
- 429 responses are never cached: `cache.getOrFetch()` already rejects `statusCode !== 200` — no cache change required.
- `fetchHistoricalPrices()` continues to Yahoo Finance fallback when Finnhub returns 429; the `warning` field is updated to describe the rate-limit event and retry-after value.
- `app.jsx`: `rateLimitWarning` boolean state detects `body.error === "rate_limited"` in history, quote, and profile fetch results. A `.rate-limit-banner` div renders between `<nav.tabnav>` and `<div.content>` when active; uses existing CSS variables and `--warn` color token. Bilingual copy via `t(language, "rateLimitWarn")`.
- `views-analysis.jsx`: news fetch detects `rate_limited` error → `newsState.status = "rate_limited"` → renders `copy.newsRateLimit` inside the news card without blocking or crashing the dashboard.
- Bilingual copy in both `I18N` (`ui.jsx`) and `MODULE_COPY` (`views-analysis.jsx`):
  - EN: "Rate limit reached — some data may be delayed."
  - TR: "Rate limit sınırına ulaşıldı — bazı veriler gecikebilir."
- `scripts/rate-limit-check.mjs` (14 tests), wired as `npm run test:ratelimit`.

**Constraints preserved:**
- No new npm dependencies.
- No API key in browser-visible payloads.
- Finnhub → Yahoo fallback behavior unchanged.
- Financial formulas, optimizer, Monte Carlo, CVaR, beta unchanged.
- Layout, fonts, colors, charts, cards unchanged.
- Missing API key behavior (503) unchanged.

**Acceptance:** Proxy returns structured rate-limit error on 429. 429 responses not cached. Frontend shows compact non-blocking warning. All 7 test suites pass. ✓

---

## Phase 6 — Gradual Legacy JSX → Vite-Native ES Module Migration

### 6a — Browser-level test foundation ✓ *Completed 2026-06-06*

**Goal:** Establish a minimal browser test layer before the ES module migration to catch regressions at the rendered-UI level — the one layer not covered by the existing Node.js scripts.

**What was added:**
- `@playwright/test` installed as a dev dependency; Chromium browser installed.
- `playwright.config.js` at the project root: Chromium-only, headless, 60 s test timeout (generous for Babel + CDN cold-start), auto-starts Vite dev server via `webServer` with `reuseExistingServer: true`.
- `tests/e2e/dashboard.spec.js` — 19 tests across 5 describe groups:
  1. **Page load integrity**: no uncaught JS errors on initial load (listener registered before `goto()`).
  2. **Dashboard shell**: `.app`, `.sidebar`, `.main`, `.topbar`, `.tabnav`, `.content` all visible; 3 topbar metric cards; 7 tab buttons; exactly one active tab.
  3. **Tab navigation**: all 7 tabs clickable and render `.tab-body` without crashing; rapid tab cycling (14 clicks) does not crash; tab-specific content verified (`kpi-strip`, `opt-cards`, `src-grid`).
  4. **Mock fallback**: portfolio analytics visible in mock mode; Company Data tab and Data tab do not crash when proxy is offline.
  5. **Theme toggle**: `data-theme` attribute on `<html>` toggles between `"dark"` and `"light"` on `.theme-btn` click; dashboard content remains visible after switch.
- `npm run test:e2e` — standard headless run.
- `npm run test:e2e:headed` — headed run for visual debugging.
- `npm run test:e2e:debug` — Playwright debug mode.
- `test-results/` and `playwright-report/` added to `.gitignore`.

**Design constraints:**
- No assertions on exact numeric values, SVG paths, or pixel positions.
- No dependency on a live Finnhub API key.
- Tests pass in mock/offline mode (proxy not required).
- `addInitScript()` sets `qpa-language=en` and `qpa-theme=dark` in localStorage before each test for stable initial state.
- No product features, financial formulas, proxy behavior, or UI layout changed.

**Acceptance:** 19/19 tests pass. All 7 existing test suites pass. ✓

### 6b — Data layer ES module extraction ✓ *Completed 2026-06-06*

**Goal:** Create `src/data.js` as a Vite-native ES module containing all pure data/financial logic. Keep `public/legacy/data.jsx` unchanged as the browser-Babel window-compatibility shim. Eliminate the `vm.runInContext` workaround from the Node.js test scripts.

**What was added / changed:**

- `src/data.js` (new): A full Vite-native ES module mirroring the complete logic of `data.jsx`. Uses named `export` for all public symbols (`UNIVERSE`, `DEFAULT_LOTS`, `DATA_SOURCES`, `ACTIVE_DATA_ADAPTER`, `lookup`, `corr`, `createMarketDataAdapter`, `buildPortfolio`, `emptyPortfolio`, `optimize`, `monteCarlo`, `STRESS`, `NEWS`, `COMPANY`, `GLOSSARY`). Internal helpers (`rng`, `gauss`, `CORR`, `pricePath`, `dailyReturns`, `historyPath`, `hasUsableHistory`, `quotePrice`, `sampleCov`, `calcBeta`, `BENCH_EQUITY_SCALAR`, `BENCH_DAILY_INCOME`) remain private with no `export`. No `Object.assign(window, {...})` — this file has no browser-context side effects.

- `scripts/smoke-check.mjs` (updated): Replaced `import vm from "node:vm"` + `vm.runInContext(data.jsx)` block with `import { createMarketDataAdapter, DATA_SOURCES } from "../src/data.js"`. File-content pattern checks against `public/legacy/data.jsx` are preserved unchanged.

- `scripts/metrics-check.mjs` (updated): Replaced `import fs`, `import vm`, `vm.runInContext(data.jsx)` boilerplate with `import { createMarketDataAdapter } from "../src/data.js"`. All 15 metric assertions are unchanged.

- `public/legacy/data.jsx`: Unchanged. Continues to define all logic inline and assign to `window.*` for the browser Babel scripts. Remains the single source of truth for the browser runtime until a future step replaces the Babel loading.

**Design constraints preserved:**
- No changes to financial formulas, optimizer, Monte Carlo, CVaR, beta, or any other calculation.
- No changes to `index.html`, `app.jsx`, or any other legacy JSX file.
- Babel Standalone not removed; React UMD CDN not changed.
- Browser app behavior is identical — the migration is a test-infrastructure change.
- All 19 Playwright tests and all 7 Node.js test suites pass.

**Acceptance:** `npm run test:smoke` passes (imports from `src/data.js`). `npm run test:metrics` passes (imports from `src/data.js`). `npm run test:e2e` 19/19 pass. ✓

### 6c — UI utilities ES module extraction ✓ *Completed 2026-06-06*

**Goal:** Create Vite-native ES modules for the shared UI utility layer. Preserve all existing `window.*` exports via the unchanged legacy shim.

**What was added / changed:**

- `src/ui.js` (new): Pure-JS Vite ES module. Named exports: `fmtPct`, `fmtPctSigned`, `fmtUSD`, `fmtUSDc`, `fmtNum`, `SERIES_COLORS`, `assetColor`, `I18N`, `t`. No JSX, no React, importable in Node.js. Exact same logic and copy as `public/legacy/ui.jsx` (including bilingual EN/TR I18N with all keys, and `rateLimitWarn` copy).

- `src/ui.jsx` (new): Vite ES module for React components. Imports and re-exports everything from `src/ui.js`, then adds: `Card`, `Metric`, `Pill`, `Table`, `Alert`, `ModuleIntro`, `InsightGrid`, `InsightCard`, `Segmented`, `Spark`. Uses JSX with `/* @jsx React.createElement */` pragma — references the UMD `window.React` global (no npm React package required in this phase). `var_` internal helper kept private. Cannot be imported in Node.js (JSX is not valid Node.js JS).

- `vite.config.js` (updated): Added `esbuild: { jsxFactory: "React.createElement", jsxFragment: "React.Fragment" }` so Vite's esbuild uses the classic JSX transform when processing `src/ui.jsx`. `public/legacy/*.jsx` files are static assets served as-is and are unaffected.

- `public/legacy/ui.jsx`: Unchanged. Continues to define all logic inline and assign to `window.*` via `Object.assign(window, { fmtPct, fmtPctSigned, fmtUSD, fmtUSDc, fmtNum, assetColor, SERIES_COLORS, I18N, t, Card, Metric, Pill, Table, Alert, ModuleIntro, InsightGrid, InsightCard, Segmented, Spark })`.

- `scripts/ui-check.mjs` (new): 14 tests importing from `src/ui.js`. Covers: formatters (fmtPct, fmtPctSigned, fmtUSD, fmtUSDc, fmtNum), SERIES_COLORS length and content, assetColor modulo wrap, I18N structure and required keys, t() translation and fallback, bilingual rateLimitWarn copy, src/ui.jsx file existence and component exports, legacy window export parity, I18N key parity between EN and TR.

- `package.json`: Added `"test:ui": "node scripts/ui-check.mjs"`.

**Design constraints preserved:**
- No changes to any financial formula, optimizer, Monte Carlo, CVaR, beta, or any calculation.
- No changes to `index.html`, `app.jsx`, or any other legacy JSX file.
- Babel Standalone not removed; React UMD CDN not changed.
- Browser app behavior is identical.
- All 19 Playwright tests and all 8 Node.js test suites pass (7 existing + new test:ui).

**Known limitation:** React components in `src/ui.jsx` require `window.React` from the UMD CDN to be present at call time. They cannot be used in Node.js without a DOM/React environment, and cannot be imported by other ES modules until React is added as an npm dependency (Phase 6 Step 10).

**Acceptance:** `npm run test:ui` 14/14 pass. All 8 existing Node.js tests pass. `npm run test:e2e` 19/19 pass. ✓

### 6d — Chart component ES module extraction ✓ *Completed 2026-06-06*

**Goal:** Create a Vite-native ES module for the SVG chart component layer. Preserve all existing `window.*` exports via the unchanged legacy shim.

**What was added / changed:**

- `src/charts.jsx` (new): Vite ES module for all 8 chart components. Uses `/* @jsx React.createElement */` pragma — same classic JSX approach as `src/ui.jsx`. References the UMD `window.React` global (no npm React package required in this phase). Named exports: `GrowthChart`, `Donut`, `HBars`, `VBars`, `MiniLine`, `Heatmap`, `FanChart`, `Histogram`. Private helpers `extent(arr)` and `pathFrom(pts)` remain unexported. No `Object.assign(window, {...})`. All colors use CSS custom properties (`var(--accent)`, `var(--grid)`, `var(--neg)`, etc.) for automatic dark/light theme tracking. Colors arrive as props or CSS vars — no import from `src/ui.js` required. Cannot be imported in Node.js (JSX syntax error before runtime).

- `public/legacy/charts.jsx`: Unchanged. Continues to define all chart components inline and assign them to `window.*` via `Object.assign(window, { GrowthChart, Donut, HBars, VBars, MiniLine, Heatmap, FanChart, Histogram })`.

- `scripts/charts-check.mjs` (new): 10 tests verifying `src/charts.jsx` via source-text analysis (cannot import JSX in Node.js). Covers: file existence, all 8 `export function` declarations, `@jsx` pragma, `extent`/`pathFrom` are defined but not exported, no `Object.assign(window,...)` in src file, legacy window export parity, no npm React import, CSS custom property usage, exactly 8 named component exports.

- `package.json`: Added `"test:charts": "node scripts/charts-check.mjs"`.

**Design constraints preserved:**
- No changes to any financial formula, optimizer, Monte Carlo, CVaR, beta, or any calculation.
- No changes to `index.html`, `app.jsx`, or any other legacy JSX file.
- Babel Standalone not removed; React UMD CDN not changed.
- Browser app behavior is identical.
- All 19 Playwright tests and all 9 Node.js test suites pass (8 existing + new test:charts).

**Known limitation:** `src/charts.jsx` requires `window.React` from the UMD CDN at call time. It cannot be used in a Node.js environment or imported by other ES modules until React is added as an npm dependency (Phase 6 Step 9).

**Acceptance:** `npm run test:charts` 10/10 pass. All 9 existing Node.js tests pass. `npm run test:e2e` 19/19 pass. ✓

### 6e — Sidebar ES module extraction ✓ *Completed 2026-06-06*

**Goal:** Create a Vite-native ES module for the sidebar control panel. Make the sidebar's global `window.*` dependencies explicit as named ES module imports. Preserve all existing window exports via the unchanged legacy shim.

**What was added / changed:**

- `src/sidebar.jsx` (new): Vite ES module for the full sidebar. Uses `/* @jsx React.createElement */` pragma — same classic JSX approach as `src/ui.jsx`, `src/charts.jsx`. References the UMD `window.React` global. Named exports: `Sidebar`, `Icon`, `PROFILES`. The module imports `t` and `fmtUSD` from `src/ui.js`, and `UNIVERSE` and `lookup` from `src/data.js`, replacing the implicit global-window lookups that the legacy file relied on. One parameter renamed to avoid shadowing the imported `t` function (`lookupInstrument = ticker => ...` instead of `t => ...`; `add(ticker)` instead of `add(t)`). Behaviorally identical to the legacy file. Private helpers `rangeStart`, `PROFILE_COPY`, `DATE_PRESETS` remain unexported.

- `public/legacy/sidebar.jsx`: Unchanged. Continues to define `Sidebar`, `Icon`, and `PROFILES` inline and assigns them to `window.*` via `Object.assign(window, { Sidebar, Icon, PROFILES })`.

- `scripts/sidebar-check.mjs` (new): 12 tests verifying `src/sidebar.jsx` via source-text analysis. Covers: file existence; all 3 exports present; `@jsx` pragma; imports from `./ui.js` (`t`, `fmtUSD`) and `./data.js` (`UNIVERSE`, `lookup`); no `Object.assign(window,...)`; no npm React import; private helpers not exported but still defined; React hooks destructuring; non-advisory disclaimer copy (EN + TR); legacy window export parity; exactly 3 named exports with no extras.

- `package.json`: Added `"test:sidebar": "node scripts/sidebar-check.mjs"`.

**Design constraints preserved:**
- Sidebar JSX structure, className values, inline styles, CSS hooks, and `<style>` block are byte-for-byte identical to the legacy file.
- No changes to search field behavior, holdings editing, lot entry, date range controls, analysis profile buttons, advanced assumptions sliders, rf propagation, or footer status display.
- Non-advisory disclaimer lines (EN + TR) preserved verbatim.
- No changes to any financial formula, optimizer, Monte Carlo, CVaR, or beta.
- No changes to proxy/server code or rate-limit behavior.
- Browser app behavior is identical — `app.jsx` still consumes `window.Sidebar` from the legacy shim.
- All 19 Playwright tests and all 10 Node.js test suites pass (9 existing + new test:sidebar).

**Known limitation:** `src/sidebar.jsx` requires `window.React` from the UMD CDN at call time. It cannot be used in a Node.js environment or imported by other ES modules until React is added as an npm dependency (Phase 6 Step 9). The browser app still loads `Sidebar` from `window.*` via the legacy shim — `src/sidebar.jsx` is not yet wired into `index.html` or `app.jsx`.

**Acceptance:** `npm run test:sidebar` 12/12 pass. All 10 existing Node.js tests pass. `npm run test:e2e` 19/19 pass. ✓

### 6h — app.jsx migration audit ✓ *Completed 2026-06-06*

**Goal:** Fully audit `public/legacy/app.jsx` and produce a safe migration plan for Phase 6i. No runtime code changed.

**What was created:**

- `docs/APP_MIGRATION_AUDIT.md`: Complete audit document covering all 18 `window.*` dependencies (with src/ module mapping table), all 14 root state variables, all 5 useEffect hooks (purpose, deps, API calls, cleanup, risk), both useMemo hooks, all 4 API/fetch paths, 2 localStorage keys, full child component prop map (22 Sidebar props + all tab props), 17-row migration risk table, step-by-step Phase 6i implementation plan, and 38 exact acceptance criteria.
- `docs/ARCHITECTURE_AUDIT.md` updated: Risk 2 extended with Phase 6h audit completion status.
- `docs/PRODUCTIZATION_ROADMAP.md` updated: Phase 6h section added.

**Design constraints preserved:**
- `public/legacy/app.jsx` unchanged.
- All 7 `public/legacy/*.jsx` files unchanged.
- `index.html` unchanged.
- Babel Standalone not removed. React npm dep not added.
- All 19 Playwright tests pass. All 4 Node.js test suites run pass.

**Acceptance:** `docs/APP_MIGRATION_AUDIT.md` created. No runtime behavior changed. Phase 6i can be planned from this audit. ✓

### 6i-prep — React npm dependency + src/ React import ✓ *Completed 2026-06-06*

**Goal:** Add `react` and `react-dom` as npm packages and update all 5 `src/*.jsx` files to import React explicitly rather than relying on the CDN `window.React` UMD global. This eliminates the dual-React instance risk before the `src/app.jsx` cutover. No browser runtime change.

**What was changed:**

- `npm install react react-dom` — `react` and `react-dom` added to `package.json` dependencies.
- `src/ui.jsx`, `src/charts.jsx`, `src/sidebar.jsx`, `src/views/overview.jsx`, `src/views/analysis.jsx` — `import React from "react"` added after pragma block in each file. Header comments updated to reflect Phase 6i-prep. The `/* @jsxRuntime classic */` / `/* @jsx React.createElement */` / `/* @jsxFrag React.Fragment */` pragmas are preserved unchanged.
- `scripts/charts-check.mjs`, `scripts/sidebar-check.mjs`, `scripts/overview-check.mjs`, `scripts/analysis-check.mjs` — Test assertions flipped from "must NOT import React from npm" to "must import React from npm".
- `vite.config.js` — esbuild comment updated; config unchanged.

**Why this approach was chosen before src/app.jsx:**
All 5 `src/*.jsx` files previously called `React.createElement` via the CDN `window.React` global. Creating `src/app.jsx` with `import React from "react"` while child files still used `window.React` would have created two separate React runtime instances — the npm-bundled one for `app.jsx` and the CDN UMD one for every child component. React explicitly prohibits two instances; hooks would throw "Invalid hook call" at runtime. The preparatory step resolves this before any `index.html` change.

**Design constraints preserved:**
- `public/legacy/app.jsx` unchanged.
- All 7 `public/legacy/*.jsx` files unchanged.
- `index.html` unchanged. CDN React UMD and Babel Standalone still active.
- The browser app still boots from `public/legacy/app.jsx` via Babel. No visual or behavioral change.
- All 13 Node.js test suites pass. All 19 Playwright tests pass.

**Acceptance:** All 13 Node.js test suites pass. All 19 Playwright E2E tests pass. No runtime behavior changed. ✓

### 6i — app.jsx cutover (Babel → Vite ES module runtime) ✓ *Completed 2026-06-06*

**Goal:** Create `src/app.jsx` as a mechanical port of `public/legacy/app.jsx` and cut over `index.html` from the legacy Babel+CDN chain to a single Vite ES module entry point. Remove Babel Standalone and React UMD CDN from the browser runtime. Preserve all legacy files unchanged.

**What was changed:**

- `src/app.jsx` (new): Mechanical port of `public/legacy/app.jsx` (414 lines → 418 lines). Changes from the legacy file are syntax-only:
  - Pragmas added: `/* @jsxRuntime classic */`, `/* @jsx React.createElement */`, `/* @jsxFrag React.Fragment */`
  - `import React, { useState, useMemo, useEffect } from "react"` replaces destructuring from `window.React`
  - `import { createRoot } from "react-dom/client"` added
  - Imports from 6 `src/` modules replace 18 `window.*` consumer references
  - Hook aliases renamed: `useStateApp`→`useState`, `useMemoApp`→`useMemo`, `useEffectApp`→`useEffect`
  - `ReactDOM.createRoot(...)` → `createRoot(...)`
  - All business logic, JSX, state shape, useMemo hooks (`p`, `pAdj`), useEffect hooks, inline 82-line `<style>` block, localStorage keys, and `window.__exportTab`/`window.__exportDone` copied verbatim

- `index.html`: 3 CDN `<script>` tags (React UMD, ReactDOM UMD, Babel Standalone) + 7 `<script type="text/babel" src="/legacy/*.jsx">` tags removed. Replaced with a single `<script type="module" src="/src/app.jsx">`.

- `scripts/app-check.mjs` (new): 25 source-text assertions covering all acceptance criteria: React npm import, createRoot from react-dom/client, all 6 module imports, standard hook names, TABS/PROFILE_LABELS/API_BASE_URL constants, historyWindow helper, all 14 state variables, localStorage keys, both useMemo hooks, rate_limited detection, rate-limit-banner class, inline style block, window.__exportTab/Done, createRoot mount, no Object.assign(window,...), no stale window.* consumers, legacy file preservation, index.html uses module entry.

- `scripts/smoke-check.mjs`: Legacy babel chain assertion replaced with: (1) positive check that `index.html` has `type="module"` + `src/app.jsx`; (2) negative checks for Babel/CDN scripts; (3) disk existence check for all 7 `public/legacy/*.jsx` files.

- `package.json`: Added `"test:app": "node scripts/app-check.mjs"`.

**Design constraints preserved:**
- All JSX structure, className values, inline styles, tab layout, bilingual copy, financial formulas, optimizer, Monte Carlo, CVaR, beta unchanged — the migration is purely syntactic.
- `daysFor` object kept inside `App()` body (not lifted to module scope) — preserves legacy pattern.
- `window.__exportTab` and `window.__exportDone` PPTX export hooks preserved verbatim.
- Variable shadowing of imported `t` (translate) by local `t` in map callbacks preserved as-is — harmless since translate is never called inside those callback bodies.
- `public/legacy/app.jsx` preserved unchanged on disk.
- All 7 `public/legacy/*.jsx` files preserved unchanged.

**Build result:** `npm run build` — 30 modules, 318 kB JS (97 kB gzip), 731 ms. Clean output; no legacy JSX in the bundle.

**Test result:** All 14 Node.js test suites pass. `npm run test:e2e` 19/19 pass in 23 s (vs ~30 s with Babel Standalone — in-browser transpilation eliminated).

**Acceptance:** `npm run test:app` 25/25 pass. All 14 Node.js test suites pass. `npm run test:e2e` 19/19 pass. `npm run build` succeeds with zero warnings. ✓

### 6g — Analysis views ES module extraction ✓ *Completed 2026-06-06*

**Goal:** Create a Vite-native ES module for the five Analysis-layer tabs (AnalysisTab, OptimizationTab, SimulationTab, CompanyTab, DataTab). Replace all implicit `window.*` dependencies with explicit ES module imports from the already-extracted layers. Preserve all existing window exports via the unchanged legacy shim.

**What was added / changed:**

- `src/views/analysis.jsx` (new): Vite ES module containing `AnalysisTab`, `OptimizationTab`, `SimulationTab`, `CompanyTab`, `DataTab` as named exports. Uses `/* @jsx React.createElement */` pragma — same classic JSX approach as all prior `src/` files. References `window.React` UMD global. All component logic and JSX structure is identical to `public/legacy/views-analysis.jsx`. Imports are explicit ES module dependencies:
  - `assetColor`, `fmtUSD`, `fmtPct`, `fmtPctSigned`, `fmtNum`, `fmtUSDc` from `../ui.js`
  - `ModuleIntro`, `Pill`, `InsightGrid`, `InsightCard`, `Card`, `Table`, `Alert`, `Metric`, `Segmented` from `../ui.jsx`
  - `VBars`, `MiniLine`, `FanChart`, `Histogram` from `../charts.jsx`
  - `STRESS`, `monteCarlo`, `COMPANY`, `lookup`, `DATA_SOURCES` from `../data.js`
  - `dataProviderLabel`, `dataProviderTone` from `./overview.jsx`
  - All 12 private helpers remain unexported: `MODULE_COPY`, `moduleCopy`, `classOf`, `OptStat`, `BigStat`, `fmtNewsDate`, `normalizeNewsItem`, `ProfRow`, `companyDisplay`, `SrcItem`, `proxyHealthDisplay`, `marketHistoryDisplay`, `referenceDataDisplay`.
  - The only functional code change: `window.DATA_SOURCES` in `CompanyTab`'s news-fetch `useEffect` replaced with the imported `DATA_SOURCES` constant.

- `public/legacy/views-analysis.jsx`: Unchanged. Continues to assign all 5 tab components to `window.*` via `Object.assign(window, { AnalysisTab, OptimizationTab, SimulationTab, CompanyTab, DataTab })`.

- `scripts/analysis-check.mjs` (new): 18 tests verifying `src/views/analysis.jsx` via source-text analysis. Covers: file existence; all 5 exports; `@jsx` pragma; React hook aliases; imports from each of the 5 upstream modules with per-symbol verification; `MODULE_COPY` private; all 12 private helpers not exported; no `Object.assign(window,...)`; no npm React import; no `window.DATA_SOURCES` reference; `newsRateLimit` copy key; `newsContextNote` non-advisory copy (no advisory words in the value); legacy window export parity; exactly 5 named exports.

- `package.json`: Added `"test:analysis": "node scripts/analysis-check.mjs"`.

**Design constraints preserved:**
- All 5 tab JSX structures, className values, inline styles, table columns, chart props, and bilingual copy (`MODULE_COPY` EN + TR, ~150 keys each) are identical to the legacy file.
- Company news fetch behavior (rate-limit detection, cancellation pattern, normalizer, date formatter) unchanged.
- `newsContextNote` copy is non-advisory: "Company context only · not financial advice" / "Yalnızca şirket bağlamı · yatırım tavsiyesi değildir."
- No advisory language added anywhere. No financial formulas modified.
- Browser app still consumes window exports from the legacy shim.
- All 12 Node.js test suites and all 19 Playwright tests pass.

**Known limitation:** `src/views/analysis.jsx` imports from `./overview.jsx`, `../ui.jsx`, and `../charts.jsx`, all of which require `window.React` from the UMD CDN. This file is also browser-only until React is added as an npm dependency. The browser app still loads view components from `window.*` via the legacy shim.

**Acceptance:** `npm run test:analysis` 18/18 pass. All 12 existing Node.js tests pass. `npm run test:e2e` 19/19 pass. ✓

### 6f — Overview view ES module extraction ✓ *Completed 2026-06-06*

**Goal:** Create a Vite-native ES module for the Overview and Risk tabs. Replace all implicit `window.*` dependencies with explicit ES module imports from the already-extracted layers. Preserve all existing window exports via the unchanged legacy shim.

**What was added / changed:**

- `src/views/overview.jsx` (new): Vite ES module containing `OverviewTab`, `RiskTab`, `dataProviderLabel`, `dataProviderTone` as named exports. Uses `/* @jsx React.createElement */` pragma — same classic JSX approach as all prior `src/` files. References `window.React` UMD global. All component logic and JSX structure is identical to `public/legacy/views-overview.jsx`. Imports are explicit ES module dependencies:
  - `assetColor`, `fmtUSD`, `fmtPct`, `fmtPctSigned`, `fmtNum`, `fmtUSDc` from `../ui.js`
  - `Metric`, `Card`, `Pill`, `Table`, `Alert`, `ModuleIntro`, `InsightGrid`, `InsightCard` from `../ui.jsx`
  - `GrowthChart`, `Donut`, `Heatmap`, `HBars`, `MiniLine` from `../charts.jsx`
  - `corr`, `GLOSSARY` from `../data.js`
  - `RISK_COPY` bilingual copy constant remains private (not exported).

- `public/legacy/views-overview.jsx`: Unchanged. Continues to assign `OverviewTab`, `RiskTab`, `dataProviderLabel`, `dataProviderTone` to `window.*` for the legacy `app.jsx` consumer.

- `scripts/overview-check.mjs` (new): 16 tests verifying `src/views/overview.jsx` via source-text analysis. Covers: file existence; all 4 exports; `@jsx` pragma; imports from each of the 4 upstream modules with per-symbol verification; `RISK_COPY` private but present; no `Object.assign(window,...)`; no npm React import; `dataProviderLabel` returns for known providers; `dataProviderTone` returns `pos`/`warn`/`neutral`; `sourceCol` key and bilingual values; benchmark wording preserved; legacy window export parity; exactly 4 named exports.

- `package.json`: Added `"test:overview": "node scripts/overview-check.mjs"`.

**Design constraints preserved:**
- `OverviewTab` and `RiskTab` JSX structure, className values, inline styles, table columns and ordering, chart props, KPI strip layout, and all bilingual copy (`RISK_COPY` EN + TR) are identical to the legacy file.
- Benchmark wording unchanged: "simplified balanced reference (VTI-based, ≈60/40 scenario)" / "Balanced ref. (≈60/40)" / "Dengeli ref. (≈60/40)".
- `dataProviderLabel` and `dataProviderTone` logic unchanged: Finnhub → `pos`, Yahoo → `warn`, mock → `neutral`.
- No advisory language added. No financial formulas modified.
- Browser app still consumes `window.OverviewTab`, `window.RiskTab` from the legacy shim.
- All 11 Node.js test suites and all 19 Playwright tests pass.

**Known limitation:** `src/views/overview.jsx` imports from `../ui.jsx` and `../charts.jsx`, which both require `window.React` from the UMD CDN. This chain means `src/views/overview.jsx` is also browser-only until React is added as an npm dependency. The browser app still loads view components from `window.*` via the legacy shim — `src/views/overview.jsx` is not yet wired into `index.html` or `app.jsx`.

**Acceptance:** `npm run test:overview` 16/16 pass. All 11 existing Node.js tests pass. `npm run test:e2e` 19/19 pass. ✓

---

**Goal:** Replace browser-side Babel transpilation and global window coupling with proper Vite ES modules, without breaking the app at any intermediate step.

**Principle:** Migrate one file at a time, from the bottom of the dependency tree up. The app must be functional after each file migration.

### Migration order (bottom-up)

```
Step 1: finance utilities (new file, no window deps)
Step 2: data.jsx → src/data.js (pure functions + UNIVERSE constant)  ✓ Phase 6b
Step 3: ui.jsx → src/ui.js + src/ui.jsx (utilities + React components) ✓ Phase 6c
Step 4: charts.jsx → src/charts.jsx                            ✓ Phase 6d
Step 5: sidebar.jsx → src/sidebar.jsx                          ✓ Phase 6e
Step 6: views-overview.jsx → src/views/overview.jsx            ✓ Phase 6f
Step 7: views-analysis.jsx → src/views/analysis.jsx            ✓ Phase 6g
Step 8: app.jsx → src/app.jsx                                  ✓ Phase 6i
Step 9: Add React as npm dependency; remove window.React UMD   ✓ Phase 6i-prep
Step 10: Remove Babel Standalone and React UMD CDN from index  ✓ Phase 6i
```

**All Phase 6 migration steps complete.** The browser runtime no longer loads Babel Standalone, React UMD CDN, or any `<script type="text/babel">` tags. The Vite ES module bundle is the sole entry point.

### Prerequisites before starting

- [x] All Phase 0–5 work complete
- [x] All tests passing
- [x] No hardcoded global references in views (all go through ES module imports)

**Acceptance per step:** App loads and all tabs render. All existing tests pass after each migration step. No new global window exports introduced.

---

## Phase 7 — Browser Tests, CI, and Deployment Readiness

**Goal:** Add integration test coverage and make the project reproducible in a CI environment.

### Tasks

#### 7a — Playwright browser tests ✓ *Completed (19 tests — established during Phase 6)*

19 Playwright Chromium tests covering: app load, all 7 tabs, holdings interaction, mock fallback, theme toggle, language toggle, empty state, rapid tab cycling, proxy-offline resilience. Tests were added before the Phase 6 runtime migration so they served as a regression guard during the Babel → Vite cutover.

`npm run test:e2e` | 19/19 pass. `npm run test:e2e:headed` and `npm run test:e2e:debug` also wired in `package.json`. ✓

#### 7b — GitHub Actions CI ✓ *Completed 2026-06-07*

`.github/workflows/ci.yml` added. Runs on every push and pull request.

**Workflow:** Ubuntu latest · Node.js 20 · `npm ci` · Playwright Chromium install → `npm run build` → 13 Node.js validation suites → `npm run test:e2e` → upload `test-results/` artifact on failure (7-day retention).

**Node.js validation suites run in CI:**
- `test:smoke` — index.html entry point, adapter exports, tab order
- `test:metrics` — financial formula correctness (Sharpe, CVaR, beta, rf propagation)
- `test:api` — proxy health endpoint, missing-symbol 400, no-key 503 behavior
- `test:history` — Finnhub + Yahoo Finance payload normalization
- `test:cache` — TTL cache, in-flight dedup, bounded eviction
- `test:news` — company news fetch, normalizer, rate-limit handling
- `test:ratelimit` — 429 detection, Retry-After parsing, Yahoo fallback on 429
- `test:ui` — formatter functions, i18n keys, color utilities
- `test:charts` — chart component exports, pragma, React npm import
- `test:sidebar` — Sidebar exports, PROFILES, i18n, prop surface
- `test:overview` — OverviewTab/RiskTab exports, data-provider logic
- `test:analysis` — 5 analysis tab exports, non-advisory copy, news handling
- `test:app` — 25 acceptance criteria for Phase 6i migration

**CI constraints:**
- No `FINNHUB_API_KEY` required. `test:api` branches on the missing key (expects 503 for live endpoints) and passes cleanly. All other tests use mock data or source-text analysis.
- No deployment step.
- No matrix build (single Node.js 20 / Ubuntu target is sufficient for a personal portfolio project).
- Playwright Chromium only — matches the local E2E configuration.

**README:** CI badge added pointing to `Tuluntas09/portfolio-analytics-dashboard` workflow. Badge activates once the repository is pushed to GitHub.

#### 7c — GitHub visual presentation (screenshots) ✓ *Completed 2026-06-07*

**Goal:** Add professional screenshot assets to the repository for GitHub presentation.

**What was added:**
- `scripts/capture-screenshots.mjs` — self-contained Playwright headless capture script. Starts the Vite dev server automatically if not already running on port 8502, sets `qpa-language=en` + `qpa-theme=dark` via `addInitScript` (mirrors E2E test setup), waits for `.kpi-strip` to render, pauses 1.5 s for SVG charts to complete, then captures two screenshots.
- `docs/assets/dashboard-overview.png` — Overview tab, dark theme, 1440 × 900, mock data, 175 kB.
- `docs/assets/dashboard-risk.png` — Risk Analytics tab, dark theme, 1440 × 900, mock data, 149 kB.
- `package.json`: `"capture:screenshots": "node scripts/capture-screenshots.mjs"` added.
- `README.md`: Preview section added (two-column table) between Overview and Features.

**Constraints preserved:**
- No FINNHUB_API_KEY visible. App runs in mock/offline mode in screenshots.
- No UI changes made for screenshot purposes.
- `capture:screenshots` is not part of CI.
- No new runtime dependencies.

**Acceptance:** Two screenshots exist in `docs/assets/`. README renders a side-by-side preview table. Build, smoke, and E2E tests unaffected. ✓

#### 7d — Build output validation ✓ *Completed 2026-06-07*

**Goal:** Validate that the Vite production build in `dist/` is structurally correct after every build.

**What was added:**
- `scripts/build-check.mjs` — 15-check validation script (Node.js built-ins only: `fs`, `path`, `zlib`). Checks: `dist/` and `dist/index.html` exist; compiled JS asset referenced under `/assets/`; no Babel Standalone, no React/ReactDOM UMD CDN, no `public/legacy/*.jsx` references, no `type="text/babel"` in `index.html`; `dist/assets/` contains at least one `.js` file; no `.jsx` source files in `dist/`; `dist/legacy/` does not exist; raw JS bundle ≤ 400 kB; gzip JS bundle ≤ 150 kB.
- `vite.config.js`: `build.copyPublicDir: false` added. Prevents `public/legacy/*.jsx` from being copied to `dist/` during build. Dev mode (`npm run dev`) is unaffected — Vite still serves `publicDir` files in development.
- `package.json`: `"test:build": "node scripts/build-check.mjs"` added.
- `.github/workflows/ci.yml`: `npm run test:build` step added immediately after the build step.
- `README.md`: Test Suite section updated — `test:build` documented, build validation row added to results table, build stats updated.

**Current build result:** 261 kB raw / 81 kB gzip (well within 400 / 150 kB ceilings).

**Acceptance:** `npm run test:build` 15/15 pass. All existing tests unaffected. Build, smoke, metrics, app, E2E all pass. ✓

#### 7e — Deployment documentation and Vercel static demo ✓ *Completed 2026-06-07*

**Goal:** Document all deployment modes and make the project deployable as a Vercel static demo.

**Live demo:** https://portfolio-analytics-dashboard-three.vercel.app/  
Deployment mode: Vercel static frontend (Option A) — mock/offline data, no API key required.

**What was added:**
- `vercel.json` — minimal Vercel static config (`buildCommand`, `outputDirectory`, `framework`). No serverless functions, no API routes.
- `docs/DEPLOYMENT.md` — three deployment modes documented:
  - **Option A — Vercel static portfolio demo:** frontend-only, mock/offline mode, no API key required. **Deployed and live.** Recommended for GitHub portfolio presentation.
  - **Option B — Full local live-data mode:** `npm run dev` + `npm run api` + `.env.local` with `FINNHUB_API_KEY`. Recommended for development.
  - **Option C — Future full production live-data mode:** Vercel frontend + separate proxy host (Render/Railway/Fly.io). `VITE_API_BASE_URL` is the only Vercel env var; `FINNHUB_API_KEY` stays on proxy host only.
- `README.md`: `## Deployment` section with three-mode summary table, live demo link, and Live Demo badge. Roadmap row updated to ✅ Done.

**Security constraints preserved:**
- `FINNHUB_API_KEY` not used as a Vercel environment variable.
- Key never prefixed `VITE_`, never included in the browser bundle.
- `VITE_API_BASE_URL` explicitly identified as the only safe Vercel env var (points at proxy host, not a secret).

**Acceptance:** `npm run build` clean. `npm run test:build` 15/15 pass. Smoke, E2E, app tests unaffected. `vercel.json` present. `docs/DEPLOYMENT.md` present with all three deployment options. Live demo URL confirmed accessible. ✓

---

## Phase 8 — Real-World Usability Features

**Goal:** Add features that make the dashboard genuinely useful for ongoing personal portfolio monitoring, without crossing into advisory territory.

### 8a — CSV import/export ✓ *Completed 2026-06-07*

**What was added:**

- `src/holdingsCsv.js` (new): Pure, dependency-free ES module. Exports `parseHoldingsCsv(csvText, supportedTickers)` and `serializeHoldingsCsv(holdings)`. Parser handles optional header row, CRLF/LF line endings, extra columns, ticker normalization (→ uppercase), decimal lots, duplicate aggregation, unsupported-ticker filtering, and invalid-lots rejection (zero, negative, NaN, Infinity, non-numeric). Only tickers present in `UNIVERSE` are accepted. Returns `{ holdings, importedCount, unsupportedTickers, invalidRows }`. `serializeHoldingsCsv` outputs only `ticker,lots` rows — no prices, metrics, or other state.

- `src/app.jsx` (updated): Added `handleImportCsv(csvText)` (calls `parseHoldingsCsv`, calls `setHoldings` only when `importedCount > 0`, returns result to sidebar) and `handleExportCsv()` (inline `Blob`/`URL.createObjectURL` download of `portfolio-holdings.csv`). Both passed as props to `Sidebar`. Added import of `parseHoldingsCsv`, `serializeHoldingsCsv` from `./holdingsCsv.js`.

- `src/sidebar.jsx` (updated): Added "CSV import / export" `sb-block` section between the Lot Entry and Saved Portfolios sections. Features: hidden `<input type="file">` triggered by "Import CSV" button; "Export CSV" button; `FileReader` reads the file, calls `onImportCsv`, shows compact one-line result summary (imported count, skipped rows, unsupported tickers). Summary clears on next import attempt. New CSS classes added to inline `<style>` block.

- `src/ui.js` (updated): Added 9 bilingual i18n keys (EN + TR): `csvImportExport`, `csvImport`, `csvExport`, `csvImportHelp`, `csvImportedRows`, `csvSkippedRows`, `csvNoValidRows`, `csvReadError`, `csvUnsupported`. Full EN/TR parity maintained.

- `scripts/csv-check.mjs` (new): 15 tests covering all required cases plus CRLF tolerance, extra columns, and `BRK.B` dot-ticker handling.

- `package.json`: `"test:csv"` added.
- `.github/workflows/ci.yml`: `npm run test:csv` added to the Node.js validation step.

**Acceptance:** `npm run test:csv` 15/15 pass. All 16 Node.js test suites pass. `npm run test:e2e` 19/19 pass. `npm run build` clean (278 kB raw / 86 kB gzip). ✓

### 8b-1 — Named saved portfolios (localStorage) ✓ *Completed 2026-06-07*

**What was added:**

- `src/portfolioStorage.js` (new): Pure, dependency-free ES module. Exports `loadSaves`, `savePortfolio`, `deletePortfolio`, `validateEntry`, `STORAGE_KEY`, `SCHEMA_VERSION`, `MAX_SAVES`. The optional `storage` parameter enables Node.js test injection. Schema stores only user-input state (`holdings`, `assumptions`, `schemaVersion`, `name`, `savedAt`). No fetched prices, history, analytics results, company data, or API state are serialized. HTML injection is stripped via `sanitizeName`. Unknown `schemaVersion` values are ignored silently. `QuotaExceededError` is caught and returned as `{ ok: false, error: "storage_error" }` without propagating.

- `src/app.jsx` (updated): Imports `loadSaves`, `savePortfolio`, `deletePortfolio`, `validateEntry` from `./portfolioStorage.js` and `UNIVERSE` from `./data.js`. Added `savedPortfolios` state (initialized from `loadSaves()`). Added four handlers: `handleSavePortfolio`, `handleLoadPortfolio`, `handleDeletePortfolio`, `handleResetPortfolio`. All five are passed as props to Sidebar. `handleLoadPortfolio` validates ticker membership against `UNIVERSE` via `validateEntry` before calling `setHoldings`/`setAssumptions`.

- `src/sidebar.jsx` (updated): Added "Saved Portfolios" `sb-block` section between the Lot Entry and Date Range blocks. Features: name input + Save/Overwrite button, error display, list of saved entries with Load + Delete controls per item, Reset to default button. Uses existing sidebar visual language (`sb-block`, `sb-label`, `hold-del`, `sb-count`). Two new local state hooks: `saveName`, `saveError`. Overwrite detection shown inline (button label changes to "Overwrite"). Max cap displayed as `n/10`. New CSS classes added to inline `<style>` block.

- `src/ui.js` (updated): Added 10 bilingual i18n keys (EN + TR) covering all new UI strings: `savedPortfolios`, `portfolioNamePlaceholder`, `savePortfolio`, `overwritePortfolio`, `loadPortfolio`, `deletePortfolio`, `resetToDefault`, `saveErrorEmpty`, `saveErrorMax`, `saveErrorStorage`. Full EN/TR parity maintained.

- `scripts/portfolio-storage-check.mjs` (new): 14 tests — empty storage, malformed JSON, valid save round-trip, forbidden computed-field check, max-10 enforcement, duplicate-name overwrite, targeted delete, unknown schemaVersion, `validateEntry` valid/invalid/NaN-lots/negative-lots/wrong-version, `QuotaExceededError` without throw.

- `package.json`: `"test:portfolios"` added.
- `.github/workflows/ci.yml`: `npm run test:portfolios` added to the Node.js validation step.

**Design constraints preserved:**
- No new npm dependencies.
- No changes to financial formulas, optimizer, Monte Carlo, CVaR, beta, or any calculation.
- No changes to proxy/server code or rate-limit behavior.
- No advisory language.
- All 7 `public/legacy/*.jsx` files unchanged.

**Build:** 274 kB raw / 85 kB gzip (well within 400/150 kB ceilings).

**Acceptance:** `npm run test:portfolios` 14/14 pass. All 15 Node.js test suites pass. `npm run test:e2e` 19/19 pass. `npm run build` clean. ✓

### 8b — Saved portfolios (localStorage)

Allow the user to save named portfolio snapshots to `localStorage`.
Load/switch between saved portfolios from the sidebar.
No server-side persistence; no authentication required.

### 8c — Report export ✓

Added a "Print Report" button to the topbar-right area. Clicking it enters `body.export-mode`,
registers an `afterprint` cleanup listener, and calls `window.print()`. `@media print` CSS hides
the sidebar, topbar, and tab nav so only the active tab content is printed. The existing
`window.__exportTab` / `window.__exportDone` PPTX hooks are preserved unchanged.
New i18n key `printReport` (EN + TR). New test suite `scripts/export-check.mjs` (10 tests).

**Acceptance:** `npm run test:export` 10/10 pass. All 16 Node.js test suites pass. `npm run build` clean. ✓

### 8d — Custom date range ✓

When the "Custom" preset is selected in the sidebar, two `<input type="date">` fields
replace the static display. Validation rejects missing dates, start ≥ end, future end
dates, and ranges shorter than 30 days — showing a compact inline error below the inputs.
Valid selections update `customFrom`/`customTo` state in `app.jsx`, which is forwarded
to `historyWindow()` (data fetch) and `calendarToTradingDays()` (analytics window).
All preset buttons (6M/1Y/2Y/5Y) retain their existing computed dates. The `rangeStart`
display helper was updated to compute dynamically instead of using hardcoded strings.

Pure helpers (`getDefaultCustomFrom`, `validateDateRange`, `calendarToTradingDays`) live
in `src/dateUtils.js` for testability. New i18n keys: `customDateRange`, `dateRangeMissing`,
`dateRangeStartAfterEnd`, `dateRangeFutureEnd`, `dateRangeTooShort` (EN + TR).

**Acceptance:** `npm run test:daterange` 19/19 pass. All 18 Node.js test suites pass. `npm run build` clean. ✓

### 8e — Instrument universe expansion ✓

The current `UNIVERSE` has 15 instruments. Users can now search for any valid ticker
(1–8 uppercase alphanumeric/dot characters) not in the canonical list. The proxy
already accepts arbitrary symbols; extended tickers receive synthetic GBM price paths
(`DEFAULT_GBM = { px:100, mu:0.10, sig:0.25 }`) and are labeled with an EXT badge
and `extendedUniverseNote` warning until real history loads.

**Changes:** `src/data.js` — `DEFAULT_GBM`, `isValidTicker`, extended `buildPortfolio` null-guard;
`src/app.jsx` — relaxed `addTicker` / `handleLoadPortfolio` / `handleImportCsv` validation;
`src/sidebar.jsx` — crash guards, extended dropdown row, EXT badges, ext-note;
`src/ui.js` — EN+TR i18n keys; `scripts/universe-check.mjs` (46 tests).

**Acceptance:** `npm run test:universe` 46/46 pass. All 19 Node.js test suites pass. `npm run build` clean. ✓

### 8f — Portfolio notes ✓

Users can write a plain-text annotation in a compact sidebar block placed between the
Saved Portfolios section and the Date Range section. The note is controlled by a
`<textarea maxLength={500}>` with a live character counter and is persisted with the
named saved portfolio — save/overwrite includes the note; load restores it; reset clears it.

Old saved entries without a `notes` field load cleanly with `notes: ""` (no schema bump).
The `notes` field is capped at 500 chars on both write (`savePortfolio`) and read (`validateEntry`).
Malformed non-string values are coerced safely via `String(value ?? "")`.

**Changes:** `src/portfolioStorage.js` — `savePortfolio` 4th param `notes`, `validateEntry` returns `notes`;
`src/app.jsx` — `portfolioNote` state, wired into all four portfolio handlers and passed to Sidebar;
`src/sidebar.jsx` — notes `sb-block` with controlled textarea, char counter, CSS;
`src/ui.js` — EN+TR i18n keys (`portfolioNotes`, `portfolioNotesPlaceholder`, `portfolioNotesChars`);
`scripts/notes-check.mjs` (35 tests); `scripts/portfolio-storage-check.mjs` — updated call sites for new signature.

**Acceptance:** `npm run test:notes` 35/35 pass. All 20 Node.js test suites pass. `npm run build` clean. ✓

### 8g — Documentation close-out ✓

Phase 8g is not a product feature phase. It is a documentation and git hygiene pass
performed after all Phase 8 sub-phases (8a–8f) were confirmed complete and all tests green.

**What was done:**
- README features table updated to include all six Phase 8 features
- README roadmap section updated: no stale "Planned" rows remain
- README test count updated from 14 → 20 Node.js suites
- README build stats updated to reflect current build output (286 kB / 88 kB gzip / 31 modules)
- README testing command list extended with six Phase 8 test scripts
- This roadmap document date updated to 2026-06-07
- Phase 8 closure note added (this section)
- All 4 pending local commits (Phase 8c–8f) pushed to `origin/main`
- Annotated release tag `v2.0.0` created and pushed

**Phase 8 is complete.** All usability features defined in the Phase 8 roadmap are
implemented, tested, and documented. The repository is tagged at `v2.0.0`.

---

## Phase 9 — Daily-Use Personal Analytics

**Goal:** Evolve the dashboard from a GitHub portfolio showcase into a tool the owner uses daily — personal performance tracking, cost basis monitoring, and eventually live data.

### 9a — Cost Basis & Unrealized P&L Foundation ✓ *Completed 2026-06-07*

**Motivation:** Without cost basis, the dashboard shows only market performance, not personal performance. Unrealized P&L is the most fundamental personal finance metric — the difference between what was paid and what it is worth now.

**Holdings model extended:** `{ t, lots, avgCost?, firstBought? }`. Both fields are optional, backward-compatible, and validated/stripped on storage write and load.

**What was added:**

- `src/data.js`: Per-asset `avgCost`, `firstBought`, `unrealizedPnl` (= `(px - avgCost) × lots`), `unrealizedPct` (= `(px - avgCost) / avgCost`) added to `buildPortfolio` asset objects. Portfolio-level `totalCostBasis`, `totalUnrealizedPnl`, `totalUnrealizedPct` aggregated over assets that have cost basis data. All three added as `null` to `emptyPortfolio()`. Assets without `avgCost` contribute nothing to the portfolio aggregate.

- `src/ui.js`: `fmtUSDSigned` formatter added. Six new bilingual i18n keys (EN + TR): `averageCost`, `firstBought`, `unrealizedPnl`, `unrealizedReturn`, `costBasis`, `missingCostBasis`. Full EN/TR parity maintained.

- `src/portfolioStorage.js`: `savePortfolio` conditionally serializes `avgCost` (positive finite number) and `firstBought` (YYYY-MM-DD string) per holding. `validateEntry` passes them through on load with the same validation guards. Old saves without these fields load cleanly (fields absent = no cost basis).

- `src/sidebar.jsx`: Lot entry section extended with a compact cost-basis row below each lot-input row. Inputs: `avgCost` (number, min 0, step 0.01) and `firstBought` (date, max today). Calls `onCostBasis(ticker, { avgCost })` or `onCostBasis(ticker, { firstBought })` on change. Clears the field (deletes the key) when the input is empty. New CSS classes: `.lot-item`, `.lot-cost-row`, `.lot-cost-lbl`, `.lot-cost-input`, `.lot-date-input`.

- `src/app.jsx`: `setCostBasis(ticker, fields)` handler merges partial updates into the relevant holding. Passed as `onCostBasis={setCostBasis}` to Sidebar. `handleLoadPortfolio` automatically restores cost basis from saved state via the updated `validateEntry`.

- `src/views/overview.jsx`: `fmtUSDSigned` imported. Four keys added to local `RISK_COPY` (EN + TR): `averageCost`, `unrealizedPnl`, `unrealizedReturn`, `costBasis`. Holdings detail table extended with three new columns: Avg. Cost, Unrealized P&L, Unrealized Return — all showing `—` when no cost basis is set. Conditional portfolio-level P&L strip (3 metrics: Cost Basis / Unrealized P&L / Unrealized Return) inserted between the kpi-strip and the cumulative-return chart, visible only when `p.totalUnrealizedPnl != null`.

- `scripts/cost-basis-check.mjs` (new): comprehensive test suite. `package.json`: `"test:costbasis"` added.

**Language constraints preserved:** All new copy labeled "Unrealized P&L", "Unrealized Return", "Cost Basis", "Avg. Cost". No advisory language. No buy/sell signals. No target prices.

**Security constraints preserved:** `FINNHUB_API_KEY` untouched. No new env vars. No new npm dependencies.

**Acceptance:** `npm run test:costbasis` passes. All 21 Node.js test suites pass. `npm run build` clean. ✓

### 9b — JSON Portfolio Backup / Restore ✓ *Completed 2026-06-07*

**Motivation:** Phase 9a stores cost basis only in `localStorage`, which is device-local and cleared on browser reset. A one-click JSON export captures the full portfolio state — holdings with cost basis, assumptions, notes, and saved portfolios — enabling restore on any device.

**What was added:**

- `src/portfolioBackup.js` (new, standalone): `exportBackup`, `importBackup`, `makeBackupFilename`, `BACKUP_VERSION = 1`. No external dependencies; importable in both browser and Node.js. `importBackup` validates structure, assumptions, and filters holdings through a duck-typed `validTickers.has(t)` set; unknown tickers are silently dropped. `savedPortfolios` entries are filtered through an inline `_isSavedPortfolioWellFormed` check (mirrored from portfolioStorage.js to keep the module standalone).

- `src/ui.js`: Eight new bilingual keys (EN + TR): `jsonBackup`, `jsonBackupHelp`, `jsonExport`, `jsonImport`, `jsonImportedOk`, `jsonErrorVersion`, `jsonErrorNoHoldings`, `jsonErrorInvalid`. Full EN/TR parity maintained.

- `src/app.jsx`: `STORAGE_KEY` added to portfolioStorage import. `handleExportBackup` (Blob download, same pattern as CSV export). `handleImportBackup(jsonText)` (JSON.parse + importBackup, on success sets all state + localStorage). Both passed as props to Sidebar.

- `src/sidebar.jsx`: Compact "JSON backup" block added immediately after the CSV import/export block. Reuses `.csv-row`, `.csv-btn`, `.csv-summary` CSS classes. Hidden `<input type="file" accept=".json">` triggered by the Import button. `backupSummary` state and `backupInputRef` ref added. No new exports (exactly 3 maintained: `Sidebar`, `Icon`, `PROFILES`).

- `scripts/backup-check.mjs` (new): 30+ tests covering all export/import/round-trip paths, source-text checks. `package.json`: `"test:backup"` added. `.github/workflows/ci.yml`: `npm run test:costbasis` (Phase 9a gap) and `npm run test:backup` both added.

**Language constraints preserved:** No advisory language. No buy/sell signals. No target prices.

**Security constraints preserved:** `FINNHUB_API_KEY` untouched. No new env vars. No new npm dependencies. No CSV format changes. No financial formula changes. No proxy changes.

**Acceptance:** `npm run test:backup` passes. All 22 Node.js test suites pass. `npm run build` clean. ✓

---

## Phase 10 — Advanced Personal Risk Dashboard

### 10a — Portfolio Daily Snapshots ✓ *Completed 2026-06-07*

**Motivation:** The dashboard previously showed only the current portfolio state. After a bull or bear week, there is no record of where the portfolio stood. Daily snapshots capture live-session portfolio values, making it possible to see value history over time and measure WoW, MoM, YTD, and inception-to-date performance.

**Recording policy:** Only records when `pAdj.source.id === "real"` (live Finnhub data) and market data is fully loaded (`marketDataStatus.status === "ready"`). Mock-data sessions are never recorded. Same calendar day is overwritten idempotently. Maximum 365 snapshots stored (oldest pruned first). Storage key: `qpa-snapshots` in localStorage.

**What was added:**

- `src/portfolioSnapshots.js` (new, standalone): exports `SNAPSHOT_VERSION`, `SNAPSHOT_KEY`, `MAX_SNAPSHOTS`, `todayIso`, `normalizeSnapshot`, `loadSnapshots`, `recordSnapshot`, `getLatestSnapshot`, `exportSnapshots`, `importSnapshots`, `calcDeltas`. No React imports; injectable storage parameter enables Node.js testing. `calcDeltas` computes WoW (±3d tolerance), MoM (±5d tolerance), YTD (closest to Jan 1), and inception (oldest past snapshot). All use live `pAdj.totalValue` — not latest stored snapshot — for the "today" side. Inception returns `null` on first day to avoid a meaningless 0%.

- `src/portfolioBackup.js`: `exportBackup` extended with optional `snapshots = []` parameter; payload now includes `snapshots` field. `importBackup` returns `snapshots: raw.snapshots ?? []` for backward compatibility with old backups that have no `snapshots` field.

- `src/ui.js`: Eight new bilingual keys (EN + TR): `snapshotHistory`, `snapshotHistoryHelp`, `snapshotWow`, `snapshotMom`, `snapshotYtd`, `snapshotInception`, `snapshotNoHistory`, `snapshotVs`. Full EN/TR parity maintained.

- `src/app.jsx`: Imports `loadSnapshots`, `recordSnapshot`, `calcDeltas`, `exportSnapshots`, `importSnapshots` from `./portfolioSnapshots.js`. `snapshots` state initialized from `loadSnapshots()`. Recording `useEffect` fires when source is `"real"` and `marketDataStatus.status === "ready"`. `snapshotDeltas` useMemo computed from `calcDeltas(snapshots, pAdj.totalValue)`. `handleExportBackup` passes `exportSnapshots()` as 5th arg. `handleImportBackup` calls `importSnapshots(result.snapshots)` and refreshes state when backup includes snapshots. `OverviewTab` receives `snapshots` and `snapshotDeltas` props.

- `src/views/overview.jsx`: `OverviewTab` accepts `snapshots = []` and `snapshotDeltas = null`. When `snapshots.length >= 2`, a "Portfolio value history" Card is rendered above the cumulative return chart containing: a delta KPI strip (WoW / Month / YTD / Since first session, shown only for non-null deltas) and a `MiniLine` history chart. All strings come from `t(language, key)` via `src/ui.js` I18N.

- `scripts/snapshot-check.mjs` (new): 48+ tests covering constants, `todayIso`, `normalizeSnapshot`, `loadSnapshots`, `recordSnapshot`, `getLatestSnapshot`, `exportSnapshots`, `importSnapshots`, `calcDeltas`, source-text checks, and backup integration. `package.json`: `"test:snapshots"` added. `.github/workflows/ci.yml`: `npm run test:snapshots` added (23rd Node.js test suite).

**Language constraints preserved:** No buy/sell signals. No target prices. No future return predictions. No advisory language. All strings are purely observational ("Portfolio value history", "Since first session").

**Security constraints preserved:** `FINNHUB_API_KEY` untouched. No new env vars. No new npm dependencies. No proxy changes. No CSV format changes. No formula changes.

**Acceptance:** `npm run test:snapshots` passes (48 tests). All 23 Node.js test suites pass. `npm run build` clean. ✓

### 10b — Explicit Active Portfolio Save ✓ *Completed 2026-06-07*

**Motivation:** All working state (holdings, lots, avgCost, firstBought, assumptions, notes) was initialized from hard-coded defaults on every app load. Refreshing the browser or opening a new tab lost all edits made in the session. Phase 10b adds explicit "Save Current State" persistence backed by localStorage, allowing users to resume where they left off without relying on Saved Portfolios for every change.

**What was added:**

- `src\activePortfolioState.js` (new): Standalone pure module (no React). Exports `ACTIVE_STATE_KEY = "qpa-active-state"`, `ACTIVE_STATE_VERSION = 1`, `saveActiveState(holdings, assumptions, notes, storage?)`, `loadActiveState(storage?)`, `clearActiveState(storage?)`. Injectable storage parameter for Node.js testability. `saveActiveState` validates and sanitizes holdings (ticker format, finite lots ≥ 0, optional avgCost/firstBought), caps notes at 500 chars, stores `schemaVersion: 1` + `savedAt` ISO timestamp. `loadActiveState` validates schemaVersion, filters invalid holdings silently, returns typed object or null. `clearActiveState` removes the key.

- `src\app.jsx`: Holdings, assumptions, and portfolioNote `useState` initializers now call `loadActiveState()` on first render — falls back to `DEFAULT_LOTS` defaults if no saved state exists. `lastActiveSavedAt` state tracks last save timestamp. `handleSaveActiveState()` calls `saveActiveState` and updates `lastActiveSavedAt` on success. `handleImportBackup` auto-calls `saveActiveState` after a successful JSON import, preventing the "import → refresh → lost" regression. Both `onSaveActiveState` and `lastActiveSavedAt` passed to Sidebar.

- `src\sidebar.jsx`: "Save Current State" block added between JSON Backup and Saved Portfolios sections. Full-width accent button (`.save-active-btn`). 2-second feedback flash (`activeStateSaved`) on success using `saveActiveFeedback` state + `useEffectSB` timeout (variable named `tid` to avoid shadowing imported `t` function). Status line (`.save-active-status`) shows last-saved timestamp or "Not saved yet".

- `src\ui.js`: Four new bilingual keys (EN + TR): `saveActiveState`, `activeStateSaved`, `activeStateLastSaved`, `activeStateNeverSaved`. Full EN/TR parity maintained.

- `scripts\active-state-check.mjs` (new): 56 tests covering constants, source-text safety (no FINNHUB, no advisory language), `saveActiveState` (serialization, filtering, sanitization), `loadActiveState` (null, malformed JSON, wrong schemaVersion, invalid assumptions, round-trip), `clearActiveState`, and integration checks across `app.jsx`, `sidebar.jsx`, and `ui.js`. `package.json`: `"test:activestate"` added. `.github/workflows/ci.yml`: `npm run test:activestate` added (24th Node.js test suite).

**Language constraints preserved:** No buy/sell signals. No target prices. No advisory language. All new strings are purely operational ("Save Current State", "Last saved:", "Not saved yet").

**Security constraints preserved:** `FINNHUB_API_KEY` untouched. No new env vars. No new npm dependencies. No proxy changes. No CSV format changes. No financial formula changes.

**Acceptance:** `npm run test:activestate` passes (56 tests). All 24 Node.js test suites pass. `npm run build` clean. ✓

---

## Phase 11 — Hardening and Analytics Accuracy

**Goal:** Close known accuracy gaps, infrastructure weaknesses, and schema fragility identified during Phases 8–10.

### 11a — Documentation accuracy pass ✓ *Completed 2026-06-10*

README, Playwright test comments, FINANCIAL_METRICS.md, and screenshot captions brought up-to-date with actual implemented behavior.

### 11b — E2E test expansion ✓ *Completed 2026-06-10*

`tests/e2e/sidebar-features.spec.js` added: 18 tests covering language toggle, CSV/JSON/Save/Print controls, date range presets, cost basis inputs, saved portfolios/notes, active state feedback, and snapshot history. Total Playwright count: 35 → 37 (after 11d).

### 11c — True Sortino ratio ✓ *Completed 2026-06-10*

Replaced `annVol * 0.72` approximation with `calcDownsideDev` (T=0, total-n denominator). `calcDownsideDev` exported from `src/data.js`. 5 new metrics-check assertions (tests 16–20). `pAdj` in `app.jsx` updated.

### 11d — Benchmark selector ✓ *Completed 2026-06-10*

User-selectable benchmark: VTI (default), SPY, QQQ, BND. SPY added to `UNIVERSE`. `BENCHMARK_TICKERS` exported from `src/data.js`. `BENCH_EQUITY_SCALAR` / `BENCH_DAILY_INCOME` approximation constants removed. Benchmark state in `app.jsx`; selector inside Advanced Assumptions section in sidebar. `p.benchmark` returned from `buildPortfolio`. Dynamic chart series label. metrics-check test 21 added. E2E Group H added (37/37 total).

### 11e — localStorage Schema Migration Framework ✓ *Completed 2026-06-10*

**Motivation:** All four storage modules were at schemaVersion 1 with no migration path. A future schema bump would silently discard all stored user data. Phase 11e installs forward-compatible migration plumbing without changing any current behavior.

**What was added:**

- `src/portfolioStorage.js`: `migratePortfolioEntry(entry)` private helper added. `loadSaves` maps entries through it before `isWellFormed` filtering. `isWellFormed` exported (was private) so `portfolioBackup.js` can import it.

- `src/activePortfolioState.js`: `migrateActiveState(parsed)` private helper added. `loadActiveState` calls it after JSON.parse, before the schemaVersion check.

- `src/portfolioSnapshots.js`: `migrateSnapshotEntry(entry)` private helper added. `recordSnapshot` now writes `schemaVersion: SNAPSHOT_VERSION` to each stored entry (was never embedded before). `loadSnapshots` and `importSnapshots` map through `migrateSnapshotEntry` before `normalizeSnapshot`. Entries without `schemaVersion` treated as legacy v1.

- `src/portfolioBackup.js`: `_STORAGE_SCHEMA_VERSION = 1` private mirror constant removed. `_isSavedPortfolioWellFormed` duplicate function removed. Replaced with imports `{ SCHEMA_VERSION, isWellFormed }` from `./portfolioStorage.js`. Eliminates the drift risk between the two modules.

- `src/app.jsx`: `qpa-theme` and `qpa-language` reads replaced with explicit allowlist coercion (`=== "dark" || === "light"`, `=== "en" || === "tr"`). Invalid stored values now fall back to the documented default instead of propagating to React state.

- `scripts/snapshot-check.mjs`: 4 new tests (T-SN1 through T-SN4): schemaVersion written to raw JSON; legacy entries load; versioned entry round-trips; importSnapshots accepts legacy entries.

- `scripts/portfolio-storage-check.mjs`: 3 new tests (T-S1 through T-S3): pass-through for v1; v0 rejected; mixed array returns only v1.

- `scripts/active-state-check.mjs`: 2 new tests (T-A1, T-A2): pass-through for v1; schemaVersion:99 returns null.

- `scripts/backup-check.mjs`: 3 existing source-text assertions replaced: no-import check → import check; _isSavedPortfolioWellFormed check → T-B2 absence check; _STORAGE_SCHEMA_VERSION check → T-B1 absence check. Net count preserved at 60.

- `scripts/app-check.mjs`: 2 new checks (check 26) verifying explicit allowlist coercion for qpa-theme and qpa-language.

- `scripts/notes-check.mjs`: 1 stale assertion fixed (`portfolioNote initialized` — was checking a pre-Phase-10b pattern; updated to also accept the `loadActiveState().notes` initialization).

- `docs/STORAGE_SCHEMA.md` (new): localStorage key map, version constants, migration framework contract, backward-compatibility policy, module ownership, primitive key coercion, test coverage table.

**Version invariants:** All version constants remain at 1. No localStorage key names changed. No user-facing behavior changed. No financial formulas changed. No proxy changes. No new npm dependencies.

**Test results:** 37/37 Playwright E2E pass. All 24+ Node.js check scripts pass. `npm run build` clean (305 kB / 92 kB gzip / 34 modules / 0 warnings).

**Open targets remaining:**
- Production proxy deployment (Render) — Phase 11g

### 11f — Report Export Polish ✓ *Completed 2026-06-10*

**Goal:** Improve browser-native print/PDF output with a print-only report header, professional page layout, and visible non-advisory disclaimer. No screen-visible UI change. No formula, storage, proxy, or dependency changes.

**Problem:** The previous `@media print` block hid the sidebar, topbar, and tab nav, leaving the printed page as raw tab content with zero context — no title, date range, benchmark, data source status, or disclaimer. The printed artifact was unusable as a CV/demo reference.

**What was added:**

- `src/ui.js`: 7 new bilingual i18n keys (EN + TR): `printHeaderTitle`, `printHeaderGenerated`, `printHeaderRange`, `printHeaderBenchmark`, `printHeaderSource`, `printHeaderNote`, `printHeaderDisclaimer`. Added after the existing `printReport` key in both locale blocks.

- `src/app.jsx`:
  - `printDate` useMemo: evaluates `new Date().toLocaleDateString(locale, {...})` once on mount with locale-aware formatting (tr-TR / en-US).
  - `printDataSourceLabel`: derived string using `pAdj.source?.id === "real"` — the same source signal already used by the snapshot recording effect.
  - `<div className="print-header">` inserted between topbar and tabnav. Hidden on screen (`display: none`). Contains: report title, generated date, holdings count + portfolio value, date range, selected benchmark, data source label, optional portfolio notes (shown only when non-empty), and non-advisory disclaimer. All strings via `t(language, key)` for bilingual support.
  - `@media print` block expanded: rate-limit banner hidden; `@page { margin: 18mm 14mm }` added; `.card { page-break-inside: avoid; break-inside: avoid }` added; `.tbl thead th { position: static }` for print; multi-column grids collapsed to single column; CSS custom properties overridden to light values (`--bg: #ffffff`, `--panel: #f9f9f9`, `--text: #111111`, etc.) so dark-theme sessions produce readable output.

- `scripts/export-check.mjs`: 13 new tests (checks 11–23):
  - print-header element present in JSX
  - print-header `display:none` in screen CSS
  - print-header shown in `@media print`
  - rate-limit-banner hidden in `@media print`
  - `@page` rule present
  - `page-break-inside: avoid` on `.card`
  - `--bg: #ffffff` CSS var override in print
  - `{benchmark}` reference in print-header
  - `printHeaderDisclaimer` key used in print-header
  - EN and TR locale contain `printHeaderDisclaimer`
  - EN and TR locale contain `printHeaderTitle`
  - Total: 10 → 23 tests.

**Design constraints preserved:**
- `handlePrintReport()` logic unchanged: `export-mode` class → `window.print()` → `afterprint` cleanup.
- `window.__exportTab` and `window.__exportDone` PPTX hooks preserved.
- No screen-visible UI change (`print-header` is `display:none` on screen).
- No financial formula changes.
- No localStorage key or schema changes.
- No proxy/server changes.
- No new npm dependencies.
- No advisory language.
- All public/legacy files unchanged.

**Version invariants:** SCHEMA_VERSION=1, ACTIVE_STATE_VERSION=1, SNAPSHOT_VERSION=1, BACKUP_VERSION=1. All localStorage key names unchanged.

**Test results:** 37/37 Playwright E2E pass. `npm run test:export` 23/23 pass. `npm run test:app` pass. `npm run test:notes` 35/35 pass. `npm run build` clean (308 kB / 93 kB gzip / 34 modules / 0 warnings).

---

## Dependency Budget

To remain suitable for GitHub portfolio display and easy setup, the project should
avoid heavy new dependencies. The following are acceptable additions by phase:

| Phase | Acceptable new dep | Purpose |
|---|---|---|
| 6 | `react`, `react-dom` (npm, not CDN) | Replace UMD CDN scripts |
| 7 | `playwright` (devDep) | Browser tests |
| 7 | `@playwright/test` (devDep) | Test runner |
| 8 | None required | CSV and localStorage are vanilla |

All financial math should remain vanilla JS. No `mathjs`, `numeric.js`, or financial
library dependencies unless a specific Phase 4 formula replacement proves necessary.

---

## What This Project Will Not Become

Regardless of phase, the following are out of scope:

- Buy / sell / hold signal generation
- Target price calculation
- Portfolio rebalancing execution (only analysis)
- Real-time streaming prices
- Multi-user accounts or authentication
- Paid subscription tiers
- Database persistence beyond localStorage
- Trading API integrations (brokerage, exchange)
- Tax calculation or compliance reporting
- Regulatory filing or disclosure generation
