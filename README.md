<div align="center">

# Quant Portfolio Analytics Dashboard

**Personal portfolio analytics and risk-monitoring dashboard**  
Vite React · Finnhub/Yahoo Finance proxy · Monte Carlo simulation · portfolio optimization scenarios · company news · data-quality transparency

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://portfolio-analytics-dashboard-three.vercel.app/)
[![CI](https://github.com/Tuluntas09/portfolio-analytics-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Tuluntas09/portfolio-analytics-dashboard/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js Proxy](https://img.shields.io/badge/Node.js-Proxy-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)](.)

</div>

---

## Overview

An interactive portfolio analytics dashboard demonstrating financial analytics, frontend architecture, backend proxy design, data reliability engineering, and dashboard UX. Built as a CV/portfolio project targeting quantitative finance and frontend engineering roles.

The app covers the full decision-flow of a multi-asset portfolio review: value and return attribution, risk decomposition, rebalancing analysis, max-Sharpe and minimum-risk optimization scenarios, Monte Carlo simulation, rolling performance metrics, stress testing, company data, and data-quality transparency.

**Mock/offline mode:** when the Node.js proxy is unavailable or no API key is configured, the app falls back to a deterministic synthetic price model seeded with a fixed RNG. All tabs remain functional and the UI labels the data source clearly (`Mock Prices`, `Partial Prices`, or `Real Prices`).

---

## Preview

| Overview | Risk Analytics |
|---|---|
| ![Overview tab — portfolio summary, growth chart, allocation donut, holdings detail](docs/assets/dashboard-overview.png) | ![Risk Analytics tab — volatility metrics, correlation heatmap, risk contribution](docs/assets/dashboard-risk.png) |

*Dark theme · mock data · 1440 × 900*

---

## Features

| Feature | Description |
|---|---|
| **Portfolio Overview** | Position values, return attribution, allocation donut, growth chart vs. benchmark |
| **Risk Analytics** | Volatility, Sharpe, Sortino, max drawdown, parametric VaR (95%, 1-month), CVaR, beta, correlation heatmap, risk-contribution breakdown |
| **Optimization Scenarios** | Max-Sharpe and minimum-risk weight scenarios with constraint-aware heuristic optimizer |
| **Monte Carlo Simulation** | 1 000-path log-normal simulation with configurable horizon, fan-chart percentile bands, terminal distribution histogram |
| **Performance Analysis** | Rolling 90-day Sharpe and volatility, rebalancing comparison, stress-test scenarios (GFC, COVID, rate shock) |
| **Company Data** | Live Finnhub company profile, quote data, and recent news headlines per holding |
| **Data Quality Panel** | Per-symbol data source, provider tag, proxy health, history length audit, and fallback chain status |
| **Real + Fallback Data** | Finnhub primary → Yahoo Finance history fallback → deterministic mock engine |
| **Backend Reliability** | Per-route TTL cache, in-flight request deduplication, Finnhub 429 guard with `Retry-After` parsing |
| **Mobile / Responsive** | Responsive sidebar drawer, mobile topbar/tab navigation, table scroll wrappers, and viewport-aware SVG chart sizing; covered by 375×812 Playwright tests |
| **Playwright E2E Tests** | 49 browser tests across three spec files covering core flows, sidebar features, cost basis, date range, benchmark selector, print/export, and mobile responsive behavior |
| **Non-Advisory Language** | All optimization outputs are labeled as hypothetical model scenarios; no buy/sell signals are generated |
| **CSV Import / Export** | Import holdings from a CSV file (`ticker,lots`); export current portfolio to CSV |
| **Saved Portfolios** | Save up to 10 named portfolios to localStorage; load, overwrite, delete, reset |
| **Print Report** | One-click print/PDF export of the active tab — sidebar and navigation hidden via `@media print` |
| **Custom Date Range** | User-controlled analysis window with two date pickers and client-side validation |
| **Extended Tickers** | Add valid tickers beyond the canonical 15-instrument universe; synthetic GBM fallback until real data loads |
| **Portfolio Notes** | 500-character plain-text annotation saved with each named portfolio |
| **Cost Basis & Unrealized P&L** | Per-holding average cost and first-bought date; unrealized P&L and unrealized return per asset; portfolio-level cost basis and unrealized P&L summary strip |
| **JSON Backup / Restore** | Full-state JSON export covering holdings, assumptions, notes, saved portfolios, and snapshots; one-click restore on any device |
| **Portfolio Snapshots** | Daily portfolio value recorded in live-data sessions; WoW / MoM / YTD / inception-to-date delta KPI strip in the Overview tab |
| **Active State Persistence** | Explicit Save Current State action persists working holdings, assumptions, and notes across browser sessions |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (npm), Vite 7 — ES module bundle, no Babel Standalone |
| **Charts** | Custom SVG components — `GrowthChart`, `Donut`, `HBars`, `Heatmap`, `FanChart`, `Histogram`, `MiniLine` |
| **Styling** | CSS custom properties, dark/light theme via `[data-theme]`, `oklch` color tokens |
| **Internationalization** | Bilingual EN/TR with inline `I18N` map and `t(key)` helper |
| **Backend Proxy** | Native Node.js HTTP server — no Express dependency |
| **Market Data** | Finnhub REST API (quotes, candles, profile, news) |
| **History Fallback** | Yahoo Finance chart API (`/v8/finance/chart`) |
| **Mock Data** | Deterministic GBM price model with seeded Mulberry32 RNG |
| **Testing** | 24 Node.js test suites + Playwright Chromium E2E |
| **Build** | Vite production build — 314 kB JS / 94 kB gzip |
| **Security** | Finnhub API key stays server-side; never bundled by Vite or sent to the browser |

---

## Data Sources

| Source | Role | Used for |
|---|---|---|
| **Finnhub** | Primary | Live quotes, daily candles, company profile, news headlines |
| **Yahoo Finance** | History fallback | Daily adjusted-close price series when Finnhub candles are unavailable |
| **Synthetic mock** | Offline / demo | Deterministic GBM paths seeded per ticker — same output on every run |

The Node.js proxy sits between the browser and all external providers. The Finnhub API key is read from `FINNHUB_API_KEY` (environment variable or `.env.local`) by the proxy only — Vite never sees it and it is never included in the browser bundle.

---

## Architecture

```
Browser  ──  Vite React app  (http://127.0.0.1:8502)
│
├── src/app.jsx              root component · all state · API polling
│     ├── src/data.js        financial math · GBM mock engine · adapter pattern
│     ├── src/ui.js          formatters · i18n · color utilities
│     ├── src/ui.jsx         shared React components (Card, Metric, Pill, Table …)
│     ├── src/charts.jsx     custom SVG chart primitives
│     ├── src/sidebar.jsx    control panel · holdings · search · assumptions
│     └── src/views/
│           ├── overview.jsx   Overview tab · Risk tab
│           └── analysis.jsx   Optimization · Simulation · Analysis ·
│                              Company Data · Data tabs
│
│  HTTP (localhost)
▼
Node.js proxy  (http://127.0.0.1:8787)
server/market-data-server.mjs
│
├── GET /api/health                  proxy + cache stats
├── GET /api/market/history          normalized daily close series
│        ├── primary:  Finnhub /stock/candle
│        └── fallback: Yahoo Finance /v8/finance/chart
├── GET /api/market/quote            real-time last price · Finnhub /quote
├── GET /api/company/profile         company metadata  · Finnhub /stock/profile2
└── GET /api/company/news            recent headlines  · Finnhub /company-news
      │
      ├── server/cache.mjs   TTL cache (quote 60 s · history/candles 30 min ·
      │                      profile 12 h · news 10 min) · in-flight dedup ·
      │                      bounded to 500 entries with oldest-first eviction
      │
      └── 429 guard          Finnhub rate-limit detected before body read ·
                             Retry-After parsed (decimal-s, HTTP-date, fallback 60 s) ·
                             history route falls through to Yahoo fallback on 429 ·
                             frontend shows non-blocking rate-limit banner
```

> **Offline / mock mode:** start only `npm run dev` (no proxy needed).  
> The adapter detects the missing proxy and falls back to the deterministic mock engine automatically.

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/Tuluntas09/portfolio-analytics-dashboard.git
cd portfolio-analytics-dashboard

# 2. Install dependencies
npm install

# 3. Configure API key  (skip for mock/offline mode)
cp .env.example .env.local
# Edit .env.local and set: FINNHUB_API_KEY=your_key_here

# 4. Start the market-data proxy  (skip for mock/offline mode)
npm run api

# 5. Start the Vite dev server
npm run dev
```

| Service | URL |
|---|---|
| Dashboard | http://127.0.0.1:8502 |
| Proxy health | http://127.0.0.1:8787/api/health |

**Mock/offline mode** — skip steps 3 and 4. The dashboard runs fully on the deterministic mock engine with no external calls.

### Daily Local Use (Windows)

After first-time setup, double-click **`start-local-dashboard.bat`** in the project folder. It opens the proxy terminal, the frontend terminal, and the browser automatically. See [docs/LOCAL_DAILY_USE.md](./docs/LOCAL_DAILY_USE.md) for the full guide including status indicators, troubleshooting, and port configuration.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FINNHUB_API_KEY` | Optional | Finnhub REST API key. Required for live quotes, candles, profile, and news. Not required for mock/offline mode. |

The key is read by `server/market-data-server.mjs` only. The proxy checks `.env.local` → `.env` in that order if the variable is not already in the environment. Vite never reads this variable; it is not included in the browser bundle.

Get a free key at [finnhub.io](https://finnhub.io).

---

## Test Suite

```bash
# Build and build output validation (run together)
npm run build             # Vite production bundle → dist/
npm run test:build        # validate dist/ structure, forbidden refs, bundle size ceilings (17 checks)

# Node.js source-analysis and integration tests
npm run test:smoke        # index.html entry point, adapter exports, tab order
npm run test:metrics      # financial formula correctness (Sharpe, CVaR, beta, rf propagation)
npm run test:api          # proxy health endpoint, missing-symbol validation, 503 on missing key
npm run test:history      # Finnhub + Yahoo Finance payload normalization
npm run test:cache        # TTL cache, in-flight dedup, bounded eviction
npm run test:news         # company news fetch, normalizer, rate-limit handling
npm run test:ratelimit    # 429 detection, Retry-After parsing, Yahoo fallback on 429
npm run test:ui           # formatter functions, i18n keys, color utilities
npm run test:charts       # chart component exports, pragma, React npm import
npm run test:sidebar      # Sidebar exports, PROFILES, i18n, prop surface
npm run test:overview     # OverviewTab / RiskTab exports, data-provider logic
npm run test:analysis     # 5 analysis tab exports, non-advisory copy, news handling
npm run test:app          # src/app.jsx: 25 acceptance criteria for Phase 6i migration
npm run test:portfolios   # named saved portfolios (localStorage round-trip, schema, max-10)
npm run test:csv          # CSV import/export (parsing, normalization, round-trip)
npm run test:export       # Print Report button and @media print behavior
npm run test:daterange    # custom date range picker validation helpers
npm run test:universe     # extended ticker support (isValidTicker, DEFAULT_GBM, buildPortfolio)
npm run test:notes        # portfolio notes (save/load/reset, backward compat, 500-char cap)
npm run test:costbasis    # cost basis inputs (avgCost, firstBought), unrealized P&L, portfolio aggregates
npm run test:backup       # JSON backup/restore round-trip, version guard, snapshot integration
npm run test:snapshots    # portfolio daily snapshots (record, prune, calcDeltas, backup integration)
npm run test:activestate  # active state persistence (save/load/clear, schema validation, round-trip)

# Playwright E2E (Chromium)
npm run test:e2e          # 49 browser tests — core flows, sidebar features, cost basis, date range, benchmark selector, print/export, mobile responsive
npm run test:e2e:headed   # same tests with visible browser window
```

| Metric | Result |
|---|---|
| Build validation checks | 17 / 17 pass |
| Node.js test suites | 24 / 24 pass |
| Playwright E2E | 49 / 49 pass |
| Production build | 314 kB JS · 94 kB gzip · 34 modules · 0 warnings |

---

## Project Structure

```
portfolio-analytics-dashboard/
│
├── src/                          Vite-native ES modules (active runtime)
│   ├── app.jsx                   root component, state, API polling
│   ├── data.js                   financial math, mock engine, adapter pattern
│   ├── ui.js                     formatters, i18n, color utilities
│   ├── ui.jsx                    shared React components
│   ├── charts.jsx                custom SVG chart primitives
│   ├── sidebar.jsx               control panel, holdings input, search
│   ├── holdingsCsv.js            CSV import/export logic
│   ├── dateUtils.js              date range validation helpers
│   ├── portfolioStorage.js       named saved portfolios (localStorage)
│   ├── portfolioBackup.js        JSON full-state backup/restore
│   ├── portfolioSnapshots.js     daily portfolio value snapshots
│   ├── activePortfolioState.js   active working state persistence
│   └── views/
│       ├── overview.jsx          Overview tab, Risk tab
│       └── analysis.jsx          Optimization, Simulation, Analysis,
│                                 Company Data, Data tabs
│
├── server/
│   ├── market-data-server.mjs    Node.js HTTP proxy (port 8787)
│   └── cache.mjs                 TTL cache, in-flight dedup, bounded eviction
│
├── scripts/                      Node.js test suites (source-analysis + integration)
│   ├── smoke-check.mjs
│   ├── metrics-check.mjs
│   ├── api-health-check.mjs
│   ├── history-normalization-check.mjs
│   ├── cache-check.mjs
│   ├── news-check.mjs
│   ├── rate-limit-check.mjs
│   ├── ui-check.mjs
│   ├── charts-check.mjs
│   ├── sidebar-check.mjs
│   ├── overview-check.mjs
│   ├── analysis-check.mjs
│   ├── app-check.mjs
│   ├── build-check.mjs
│   ├── portfolio-storage-check.mjs
│   ├── csv-check.mjs
│   ├── export-check.mjs
│   ├── date-range-check.mjs
│   ├── universe-check.mjs
│   ├── notes-check.mjs
│   ├── cost-basis-check.mjs
│   ├── backup-check.mjs
│   ├── snapshot-check.mjs
│   ├── active-state-check.mjs
│   └── capture-screenshots.mjs
│
├── tests/e2e/
│   ├── dashboard.spec.js             Playwright Chromium E2E tests — core flows (19 tests)
│   ├── sidebar-features.spec.js      Playwright Chromium E2E tests — sidebar features (18 tests)
│   └── mobile-responsive.spec.js     Playwright Chromium E2E tests — mobile 375×812 viewport (12 tests)
│
├── docs/
│   ├── APP_MIGRATION_AUDIT.md    Phase 6 migration audit and acceptance criteria
│   ├── ARCHITECTURE_AUDIT.md     risk assessment, window-dependency map, resolutions
│   ├── PRODUCTIZATION_ROADMAP.md phase-by-phase development log
│   ├── DATA_QUALITY_MODEL.md     data source model and fallback chain
│   ├── FINANCIAL_METRICS.md      metric definitions and model assumptions
│   └── STORAGE_SCHEMA.md         localStorage key map, schema versions, migration contract
│
├── public/legacy/                preserved reference files (not active runtime)
│   ├── app.jsx                   former browser root (Babel + UMD era)
│   ├── data.jsx, ui.jsx,         window.* shim chain — historical reference only
│   ├── charts.jsx, sidebar.jsx,
│   ├── views-overview.jsx
│   └── views-analysis.jsx
│
├── index.html                    single entry — <script type="module" src="/src/app.jsx">
├── vite.config.js
├── playwright.config.js
├── package.json
├── .env.example                  API key template (key value empty)
├── DISCLAIMER.md
└── README.md
```

> **`public/legacy/`** — these files are the original browser-side Babel + React UMD runtime preserved as historical reference. They are not loaded by `index.html` and are not part of the active bundle.

---

## Key Technical Decisions

- **Vite-native React migration (Phase 6)** — all seven legacy JSX files were extracted bottom-up into proper ES modules (`src/`). The migration was staged over multiple phases to keep E2E tests green at every step. Babel Standalone and React UMD CDN scripts were removed in the final cutover.
- **Classic JSX transform via pragma** — `/* @jsxRuntime classic */` and `/* @jsx React.createElement */` pragmas are used instead of the automatic runtime, matching the legacy file structure and avoiding an extra Babel config surface.
- **API key stays server-side** — the Finnhub key is never passed to Vite or included in the browser bundle. The proxy is the only process that reads it.
- **Deterministic mock fallback** — the synthetic price model uses a seeded Mulberry32 RNG so every run produces the same paths. This makes the app useful for demos and offline development without live data.
- **Finnhub primary, Yahoo Finance history fallback** — history is attempted via Finnhub candles first; on failure or 429 the same endpoint retries against the Yahoo Finance chart API. The browser receives a uniform normalized response regardless of which provider served it.
- **TTL cache with per-route policies** — quote data expires in 60 s; history and candles in 30 min; company profile in 12 h; news in 10 min. This reduces upstream calls for repeated portfolio refreshes.
- **In-flight request deduplication** — concurrent identical requests share one outbound call. Useful when multiple tickers trigger simultaneous fetches on portfolio load.
- **Finnhub 429 guard** — rate-limit responses are detected before the response body is read. `Retry-After` is parsed as decimal seconds, HTTP-date, or falls back to 60 s for missing/invalid values. 429 responses are never cached.
- **Data-derived beta, empirical CVaR** — beta is computed from rolling returns against the benchmark series, not a static lookup. CVaR is the empirical expected shortfall of the historical return distribution.
- **Optimization outputs are model scenarios** — the weight-tilt optimizer produces two hypothetical alternatives (max-Sharpe weight vector, min-risk weight vector). They are labeled as model scenarios and presented alongside the user's current weights for comparison, not as recommendations.
- **Playwright tests before runtime migration** — E2E tests were established against the legacy Babel runtime first so they could serve as a regression guard during the Phase 6 cutover. The 19/19 pass result after migration confirms behavioral equivalence.

---

## Deployment

**Live demo:** [portfolio-analytics-dashboard-three.vercel.app](https://portfolio-analytics-dashboard-three.vercel.app/) — static frontend, mock/offline data, no API key required.

| Mode | Frontend | Proxy | API key |
|---|---|---|---|
| **A — Vercel static demo** | [Vercel (live)](https://portfolio-analytics-dashboard-three.vercel.app/) | Not deployed | Not required |
| **B — Local live-data** | `npm run dev` | `npm run api` | `.env.local` |
| **C — Future production** | Vercel | Render / Railway / Fly.io | Proxy host only |

`FINNHUB_API_KEY` stays on the proxy host in every mode. It is never a Vercel environment variable and is never included in the browser bundle.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for step-by-step instructions for each mode.

---

## Product Boundary

This dashboard is a **personal analytics tool** for exploring portfolio metrics and risk scenarios. It does not:

- Provide investment advice of any kind
- Generate buy, sell, or hold recommendations
- Produce target prices or return forecasts
- Constitute financial planning, wealth management, or brokerage services

All optimization outputs are **hypothetical model scenarios** computed from historical data. Model assumptions include: log-normal return distributions (Monte Carlo), heuristic weight-tilt optimizer (not mean-variance), simplified stress exposures, and data-derived beta approximation. Past performance does not predict future results.

See [DISCLAIMER.md](./DISCLAIMER.md) for the full statement.

---

## Roadmap

| Status | Item |
|---|---|
| ✅ Done | Vite-native React migration (Phase 6 complete) |
| ✅ Done | Data-derived beta and empirical CVaR |
| ✅ Done | User-configurable risk-free rate propagated through optimizer and Sharpe |
| ✅ Done | Backend TTL cache and in-flight request deduplication |
| ✅ Done | Company news integration with rate-limit handling |
| ✅ Done | Finnhub 429 guard with `Retry-After` parsing and Yahoo fallback |
| ✅ Done | Playwright E2E foundation (19 tests) |
| ✅ Done | Data-quality transparency panel |
| ✅ Done | GitHub Actions CI (build + all Node.js suites + E2E) |
| ✅ Done | Vercel static demo deployed — [live demo](https://portfolio-analytics-dashboard-three.vercel.app/) |
| ✅ Done | Screenshots (Overview + Risk Analytics tabs) |
| ✅ Done | CSV portfolio import/export |
| ✅ Done | Saved portfolios (localStorage, up to 10 named) |
| ✅ Done | Print report (browser print / PDF export) |
| ✅ Done | Custom date range picker |
| ✅ Done | Extended ticker support (beyond canonical 15-instrument universe) |
| ✅ Done | Portfolio notes (plain-text annotation per saved portfolio) |
| ✅ Done | Cost basis & unrealized P&L (avg. cost, first-bought date, per-asset unrealized P&L and return) |
| ✅ Done | JSON portfolio backup / restore (full-state export covering holdings, assumptions, notes, saved portfolios, snapshots) |
| ✅ Done | Portfolio daily snapshots (WoW / MoM / YTD / inception-to-date KPI strip; MiniLine history chart) |
| ✅ Done | Active state persistence (explicit Save Current State across browser sessions) |
| ✅ Done | True Sortino ratio (downside deviation replacing 0.72 approximation) |
| ✅ Done | Selectable benchmark (VTI / SPY / QQQ / BND) |
| ✅ Done | localStorage schema migration framework (forward-compatible versioning for all four storage modules) |
| ✅ Done | Print report polish (print-only header, light-theme override, page layout, non-advisory disclaimer) |
| ✅ Done | Mobile / responsive polish (drawer sidebar, mobile nav, table scroll, responsive charts, 49 E2E tests) |

---

<div align="center">

*Built as a financial engineering and frontend architecture portfolio project · Not financial advice*

**[Tuluntas09](https://github.com/Tuluntas09)**

</div>
