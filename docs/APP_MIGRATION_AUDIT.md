# app.jsx Migration Audit

**Project:** Quant Portfolio Analytics Dashboard  
**Audit date:** 2026-06-06  
**Phase:** 6h → 6i-prep → 6i — audit, React npm prep, full Vite cutover  
**Status:** Phase 6i complete — Vite ES module runtime active, Babel Standalone eliminated

---

## 1. Current app.jsx Role

> **Phase 6i complete:** `src/app.jsx` is now the browser root. `index.html` loads it as `<script type="module" src="/src/app.jsx">`. Babel Standalone and React UMD CDN scripts have been removed. `public/legacy/app.jsx` is preserved on disk but is no longer loaded by the browser.

`public/legacy/app.jsx` **was** the root of the browser application before Phase 6i. It was the last file loaded by `index.html` via `<script type="text/babel">` and had the highest privilege in the global window coupling chain. The inventory below describes the legacy file and was used to plan the `src/app.jsx` port.

Responsibilities:

- Destructures `React.useState`, `React.useMemo`, `React.useEffect` into local aliases.
- Defines the `TABS` constant (7 tab descriptors, bilingual EN/TR).
- Defines the `PROFILE_LABELS` constant (bilingual display labels for the three risk profiles).
- Derives `API_BASE_URL` from the global `DATA_SOURCES` constant.
- Defines `historyWindow(range)` — a pure date-range helper.
- Defines `App()` — the single root React component.
- Mounts the app with `ReactDOM.createRoot(document.getElementById("root")).render(<App />)`.
- Registers two `window.__exportTab` / `window.__exportDone` helpers used by the PPTX export flow.

`App()` owns **all application state** and **all API/data-fetching**. It composes
every tab component (OverviewTab, RiskTab, OptimizationTab, SimulationTab,
AnalysisTab, CompanyTab, DataTab) and the Sidebar, passing all required props
downward. No state is managed in any child component outside of CompanyTab's
internal news-fetch effect and SimulationTab's internal run state.

---

## 2. window.* Dependency Inventory

The following global symbols are consumed by `app.jsx`. They must be available
on `window` before `app.jsx` executes.

| Symbol | Type | Provided by (legacy file) | Notes |
|---|---|---|---|
| `React` | UMD global | CDN `<script>` (React 18) | Destructured on line 4 |
| `ReactDOM` | UMD global | CDN `<script>` (React 18) | Used at line 404 for `createRoot` |
| `DATA_SOURCES` | Object | `data.jsx` → `window` | Used to derive `API_BASE_URL` on line 19 |
| `ACTIVE_DATA_ADAPTER` | Object | `data.jsx` → `window` | Assigned to `dataAdapter` on line 30 |
| `DEFAULT_LOTS` | Object | `data.jsx` → `window` | Used in holdings state initializer on line 33–34 |
| `Sidebar` | React component | `sidebar.jsx` → `window` | Rendered in App JSX on line 232 |
| `OverviewTab` | React component | `views-overview.jsx` → `window` | Rendered in content area line 305 |
| `RiskTab` | React component | `views-overview.jsx` → `window` | Rendered in content area line 306 |
| `AnalysisTab` | React component | `views-analysis.jsx` → `window` | Rendered in content area line 307 |
| `OptimizationTab` | React component | `views-analysis.jsx` → `window` | Rendered in content area line 308 |
| `SimulationTab` | React component | `views-analysis.jsx` → `window` | Rendered in content area line 309 |
| `CompanyTab` | React component | `views-analysis.jsx` → `window` | Rendered in content area line 310 |
| `DataTab` | React component | `views-analysis.jsx` → `window` | Rendered in content area line 311 |
| `Pill` | React component | `ui.jsx` → `window` | Used in topbar on lines 258–261 |
| `fmtUSD` | Function | `ui.jsx` → `window` | Used in topbar on line 255 |
| `fmtPctSigned` | Function | `ui.jsx` → `window` | Used in topbar on line 267 |
| `fmtNum` | Function | `ui.jsx` → `window` | Used in topbar on lines 271, 275 |
| `fmtPct` | Function | `ui.jsx` → `window` | Used in topbar on line 275 |
| `t` | Function | `ui.jsx` → `window` | I18N translate helper; used 15+ times in App JSX |

**Total: 18 distinct global symbols** (2 UMD CDN, 3 from data.jsx, 1 from sidebar.jsx, 7 from views-analysis.jsx and views-overview.jsx, 5 from ui.jsx).

---

## 3. src/ Module Mapping Table

Every `window.*` symbol consumed by `app.jsx` has a direct ES module equivalent
in the already-extracted `src/` layer. No new extraction work is needed.

| window symbol | src/ module | Export name | Status |
|---|---|---|---|
| `React` | npm `react` | default import | ✓ Phase 6i-prep (all src/*.jsx) |
| `ReactDOM` | npm `react-dom/client` | `createRoot` | ✓ Phase 6i (src/app.jsx) |
| `DATA_SOURCES` | `src/data.js` | `DATA_SOURCES` | ✓ Available |
| `ACTIVE_DATA_ADAPTER` | `src/data.js` | `ACTIVE_DATA_ADAPTER` | ✓ Available |
| `DEFAULT_LOTS` | `src/data.js` | `DEFAULT_LOTS` | ✓ Available |
| `Sidebar` | `src/sidebar.jsx` | `Sidebar` | ✓ Available |
| `OverviewTab` | `src/views/overview.jsx` | `OverviewTab` | ✓ Available |
| `RiskTab` | `src/views/overview.jsx` | `RiskTab` | ✓ Available |
| `AnalysisTab` | `src/views/analysis.jsx` | `AnalysisTab` | ✓ Available |
| `OptimizationTab` | `src/views/analysis.jsx` | `OptimizationTab` | ✓ Available |
| `SimulationTab` | `src/views/analysis.jsx` | `SimulationTab` | ✓ Available |
| `CompanyTab` | `src/views/analysis.jsx` | `CompanyTab` | ✓ Available |
| `DataTab` | `src/views/analysis.jsx` | `DataTab` | ✓ Available |
| `Pill` | `src/ui.jsx` | `Pill` | ✓ Available |
| `fmtUSD` | `src/ui.js` | `fmtUSD` | ✓ Available |
| `fmtPctSigned` | `src/ui.js` | `fmtPctSigned` | ✓ Available |
| `fmtNum` | `src/ui.js` | `fmtNum` | ✓ Available |
| `fmtPct` | `src/ui.js` | `fmtPct` | ✓ Available |
| `t` | `src/ui.js` | `t` | ✓ Available |

All 16 non-UMD symbols have exact 1:1 counterparts. The only new dependency
required is `react` and `react-dom` as npm packages (already budgeted in Phase 6 Step 9).

---

## 4. Root State Inventory

All state is declared in the `App()` function body. No state is lifted further up.

| State variable | Type | Initial value | Persisted |
|---|---|---|---|
| `theme` | `string` | `localStorage.getItem("qpa-theme") \|\| "dark"` | localStorage |
| `language` | `string` | `localStorage.getItem("qpa-language") \|\| "tr"` | localStorage |
| `holdings` | `Array<{t: string, lots: number}>` | Entries from `DEFAULT_LOTS` object | Not persisted |
| `dateRange` | `string` | `"2Y"` | Not persisted |
| `profile` | `string` | `"balanced"` | Not persisted |
| `assumptions` | `{rf: number, horizon: number, paths: number}` | `{rf: 0.043, horizon: 5, paths: 2000}` | Not persisted |
| `tab` | `string` | `"overview"` | Not persisted |
| `apiStatus` | `{checked, ok, hasFinnhubKey, message}` | `{checked:false, ok:false, hasFinnhubKey:false, message:"Checking proxy"}` | Not persisted |
| `rateLimitWarning` | `boolean` | `false` | Not persisted |
| `historyBySymbol` | `Object<symbol, body>` | `{}` | Not persisted |
| `quoteBySymbol` | `Object<symbol, data>` | `{}` | Not persisted |
| `profileBySymbol` | `Object<symbol, data>` | `{}` | Not persisted |
| `marketDataStatus` | `{status, message, loaded, requested}` | `{status:"idle", message:"Mock price model", loaded:0, requested:0}` | Not persisted |
| `referenceDataStatus` | `{status, quoteLoaded, profileLoaded, requested}` | `{status:"idle", quoteLoaded:0, profileLoaded:0, requested:0}` | Not persisted |

**Total: 14 state variables.** No additional hidden state was found. The `selectedCompany`
or `selectedSymbol` state for CompanyTab is managed internally inside `CompanyTab`
(not in App) — App only passes `p={pAdj}` for the asset list.

---

## 5. useEffect Inventory

### Effect 1 — Theme sync (lines 62–65)

| Attribute | Value |
|---|---|
| Purpose | Sync `theme` state to `document.documentElement.data-theme` attribute and `localStorage` |
| Dependencies | `[theme]` |
| API calls | None |
| Cleanup | None |
| Risk level | Low — pure DOM side-effect |

### Effect 2 — Language sync (lines 67–70)

| Attribute | Value |
|---|---|
| Purpose | Sync `language` state to `document.documentElement.lang` attribute and `localStorage` |
| Dependencies | `[language]` |
| API calls | None |
| Cleanup | None |
| Risk level | Low — pure DOM side-effect |

### Effect 3 — Proxy health check (lines 72–95)

| Attribute | Value |
|---|---|
| Purpose | One-time fetch of `/api/health` to determine if the proxy is online and whether a Finnhub key is configured |
| Dependencies | `[]` — runs once on mount |
| API calls | `fetch(API_HEALTH_URL)` → `GET /api/health` |
| Cleanup | `active = false` flag prevents stale `setApiStatus` if component unmounts before response |
| Risk level | Medium — no AbortController; uses stale-closure guard only |

**Note:** The health check uses an `active` boolean flag rather than `AbortController`.
The in-flight fetch will complete regardless; only the state setter is suppressed.
This is functionally safe but differs from the AbortController pattern used in
Effects 4 and 5. Phase 6i should normalize to AbortController for consistency.

### Effect 4 — Market history fetch (lines 99–146)

| Attribute | Value |
|---|---|
| Purpose | Fetch daily price history for all holdings + VTI benchmark from `/api/market/history` |
| Dependencies | `[holdings, dateRange, apiStatus.ok]` |
| API calls | `Promise.all(uniqueSymbols.map(sym => fetch(...history?symbol=sym)))` — parallel per-symbol |
| Cleanup | `AbortController` — aborts all in-flight fetches on dependency change or unmount |
| Rate-limit | Detects `body.error === "rate_limited"` → sets `rateLimitWarning(true)` |
| Mock fallback | When `!apiStatus.ok`, clears `historyBySymbol` and sets status to `"mock"` |
| Risk level | High — most complex effect; drives `marketDataStatus` state machine |

**Key behaviors:**
- Adds VTI to every fetch batch (needed for benchmark comparison and beta calculation).
- Deduplicated symbol list via `new Set([...symbols, "VTI"])`.
- Partial-success handling: `"partial"` status when some but not all symbols load.
- Sets `rateLimitWarning` as a side effect inside the `.then()` chain.

### Effect 5 — Quote + profile fetch (lines 148–197)

| Attribute | Value |
|---|---|
| Purpose | Fetch current quote and company profile for each holding from `/api/market/quote` and `/api/company/profile` |
| Dependencies | `[holdings, apiStatus.ok]` — note: `dateRange` is NOT a dependency (quotes are always current) |
| API calls | `Promise.all(symbols.flatMap(sym => [fetch(...quote), fetch(...profile)]))` — 2 parallel calls per symbol |
| Cleanup | `AbortController` — aborts all in-flight fetches |
| Rate-limit | Detects `body.error === "rate_limited"` → sets `rateLimitWarning(true)` |
| Mock fallback | When `!apiStatus.ok`, clears both maps and sets status to `"mock"` |
| Risk level | High — double-fan-out pattern (2N calls); clears all quote/profile state on proxy-offline |

**Key behaviors:**
- Uses `flatMap` to create 2 fetches per symbol, flattened into a single Promise.all.
- Validates response: skips entries where `!body?.data || !Object.keys(body.data).length`.
- `referenceDataStatus` tracks quote and profile counts independently.

---

## 6. useMemo Inventory

### Memo 1 — Portfolio build (lines 199–207)

| Attribute | Value |
|---|---|
| Purpose | Calls `dataAdapter.buildPortfolio(holdings, opts)` to compute the full portfolio object `p` |
| Dependencies | `[holdings, dateRange, profile, dataAdapter, historyBySymbol, quoteBySymbol, profileBySymbol, assumptions.rf]` |
| Data/financial | Computes annRet, annVol, mdd, var95, cvar95, beta, assets[], benchCum, portCum, rollingMetrics, optimized weights |
| Risk level | High — the most expensive computation; re-runs on any holding, range, profile, or live-data change |

**Key detail:** `assumptions.rf` is an explicit dependency, ensuring the optimizer
and Sharpe calculation use the sidebar-controlled rate. The `seed` is derived as
`20260604 + (dateRange.length * 13)`, which makes Monte Carlo deterministic per
date range but stable across re-renders.

### Memo 2 — Adjusted portfolio pAdj (lines 210–214)

| Attribute | Value |
|---|---|
| Purpose | Re-computes Sharpe and Sortino from `p` using `assumptions.rf`; spreads `rf` onto the returned object |
| Dependencies | `[p, assumptions.rf]` |
| Data/financial | `sharpe = (annRet - rf) / annVol`; `sortino = (annRet - rf) / (annVol * 0.72)` |
| Risk level | Low — pure arithmetic over already-computed `p` |

**Note:** This memo exists to apply the user-controlled `rf` to the display metrics
without re-running the full `buildPortfolio`. The split between `p` and `pAdj` is
intentional: `p` is expensive, `pAdj` adjustment is cheap. Phase 6i must preserve
this two-memo pattern exactly.

---

## 7. API/Fetch Inventory

All API calls originate from `app.jsx`. No other file makes direct fetch calls
except `CompanyTab` (inside `views-analysis.jsx`) for the news endpoint.

| Endpoint | Method | Called in | Trigger | Rate-limit handled |
|---|---|---|---|---|
| `GET /api/health` | fetch | Effect 3 | Mount (once) | No (health endpoint does not return rate_limited) |
| `GET /api/market/history?symbol=&from=&to=` | fetch (parallel) | Effect 4 | `[holdings, dateRange, apiStatus.ok]` | Yes — `error === "rate_limited"` → `rateLimitWarning(true)` |
| `GET /api/market/quote?symbol=` | fetch (parallel) | Effect 5 | `[holdings, apiStatus.ok]` | Yes — same detection |
| `GET /api/company/profile?symbol=` | fetch (parallel) | Effect 5 | `[holdings, apiStatus.ok]` | Yes — same detection |
| `GET /api/company/news?symbol=` | fetch | `CompanyTab` (views-analysis.jsx) | Symbol change + CompanyTab active | Yes (in views-analysis.jsx) |

**URL construction:** All fetch URLs use template literals with `encodeURIComponent(symbol)`
for query parameters. No interpolation of user-controlled date strings without
`historyWindow()` normalization.

**AbortController scope:** Effects 4 and 5 each create their own `AbortController`.
The signal is passed to every fetch in the batch. On dependency change or unmount,
`controller.abort()` cancels all in-flight requests. Effect 3 uses an `active` flag
instead (deviation from the AbortController pattern — low risk but inconsistent).

---

## 8. localStorage Inventory

| Key | Value type | Read on | Written on | Default |
|---|---|---|---|---|
| `"qpa-theme"` | `"dark" \| "light"` | State initializer (lazy) | Effect 1 on theme change | `"dark"` |
| `"qpa-language"` | `"tr" \| "en"` | State initializer (lazy) | Effect 2 on language change | `"tr"` |

No other localStorage keys are written or read by `app.jsx`.

**Holdings, dateRange, profile, assumptions** are **not** persisted to localStorage.
They reset to defaults on every page load.

**Playwright test dependency:** The E2E test suite uses `addInitScript` to seed
`localStorage.setItem("qpa-language", "en")` and `localStorage.setItem("qpa-theme", "dark")`
before each test. `src/app.jsx` must continue reading the same two keys with the
same defaults for the tests to remain stable.

---

## 9. Child Component Prop Map

### Sidebar (line 232–244)

| Prop | Value passed | Source |
|---|---|---|
| `holdings` | `holdings` | state |
| `assets` | `pAdj.assets` | useMemo |
| `totalValue` | `pAdj.totalValue` | useMemo |
| `instruments` | `dataAdapter.listInstruments()` | dataAdapter method |
| `dataSource` | `pAdj.source` | useMemo |
| `onAdd` | `addTicker` | inline handler |
| `onRemove` | `removeTicker` | inline handler |
| `onLots` | `setLots` | inline handler |
| `dateRange` | `dateRange` | state |
| `setDateRange` | `setDateRange` | state setter |
| `profile` | `profile` | state |
| `setProfile` | `setProfile` | state setter |
| `assumptions` | `assumptions` | state |
| `setAssumptions` | `setAssumptions` | state setter |
| `theme` | `theme` | state |
| `toggleTheme` | `() => setTheme(t => ...)` | inline arrow |
| `language` | `language` | state |
| `toggleLanguage` | `() => setLanguage(l => ...)` | inline arrow |
| `apiStatus` | `apiStatus` | state |
| `marketDataStatus` | `marketDataStatus` | state |
| `referenceDataStatus` | `referenceDataStatus` | state |
| `lastUpdated` | `pAdj.source.lastUpdated` | useMemo — note: likely `undefined` today |

### OverviewTab (line 305)

| Prop | Value |
|---|---|
| `p` | `pAdj` |
| `language` | `language` |

### RiskTab (line 306)

| Prop | Value |
|---|---|
| `p` | `pAdj` |
| `language` | `language` |

### AnalysisTab (line 307)

| Prop | Value |
|---|---|
| `p` | `pAdj` |
| `language` | `language` |

### OptimizationTab (line 308)

| Prop | Value |
|---|---|
| `p` | `pAdj` |
| `language` | `language` |

### SimulationTab (line 309)

| Prop | Value |
|---|---|
| `p` | `pAdj` |
| `assumptions` | `assumptions` |
| `language` | `language` |

### CompanyTab (line 310)

| Prop | Value |
|---|---|
| `p` | `pAdj` |
| `referenceDataStatus` | `referenceDataStatus` |
| `apiStatus` | `apiStatus` |
| `language` | `language` |

### DataTab (line 311)

| Prop | Value |
|---|---|
| `p` | `pAdj` |
| `dateRange` | `dateRange` |
| `apiStatus` | `apiStatus` |
| `marketDataStatus` | `marketDataStatus` |
| `referenceDataStatus` | `referenceDataStatus` |
| `language` | `language` |

---

## 10. Migration Risk Table

| Risk | Severity | Description | Mitigation |
|---|---|---|---|
| React import scope | High | All `src/` files currently use `window.React`. `src/app.jsx` must use `import React from "react"` and `import { createRoot } from "react-dom/client"`. This only works after `react` and `react-dom` are added as npm deps and all child `src/` files are updated to import React rather than use the global. | Add React npm dep (Phase 6 Step 9) before wiring `src/app.jsx` into the browser. |
| useState/useMemo/useEffect aliases | Medium | Legacy file aliases hooks as `useStateApp`, `useMemoApp`, `useEffectApp` to avoid name collisions with window globals. In `src/app.jsx` these aliases are unnecessary and should become standard destructured names. Verify no accidental shadowing with child components. | Use standard `const { useState, useMemo, useEffect } = React` or top-level imports. |
| `historyWindow` helper must be co-located | Low | `historyWindow(range)` is defined at module scope in `app.jsx`. It is not exported to window and not referenced outside the file. It can remain a private module-scope function in `src/app.jsx`. | No change required — keep as private helper. |
| `daysFor` constant defined inline | Low | `const daysFor = {...}` is declared inside `App()` (line 97), not at module scope. This causes a new object allocation on every render. Phase 6i should lift it to module scope. | Lift to module scope in `src/app.jsx`. |
| `window.__exportTab` / `window.__exportDone` | Medium | These PPTX export helpers are registered on `window` at the bottom of `app.jsx` after the `ReactDOM.createRoot` call. In `src/app.jsx` the same pattern works — module-scope `window.` assignments execute once on load. No behavior change needed. | Preserve the `window.__export*` assignments verbatim at module scope. |
| `TABS` and `PROFILE_LABELS` must move to module scope | Low | Currently declared at global script scope. In an ES module they become private module-scope constants. No window assignment required (they are not consumed by other files). | Move to module scope in `src/app.jsx` — no change to the constants themselves. |
| API_BASE_URL derivation | Low | `const API_BASE_URL = DATA_SOURCES.real && DATA_SOURCES.real.baseUrl ? DATA_SOURCES.real.baseUrl : "http://127.0.0.1:8787"` uses the imported `DATA_SOURCES` from `src/data.js`. The import replaces the window global. | Replace with ES import; fallback logic is unchanged. |
| `dataAdapter` assigned from `ACTIVE_DATA_ADAPTER` | Medium | `const dataAdapter = ACTIVE_DATA_ADAPTER` on the first line of `App()`. This is a window global in the legacy file, but an ES module import in `src/data.js`. The assignment pattern is identical; only the source changes. | Replace with `import { ACTIVE_DATA_ADAPTER } from "./data.js"`. |
| Inline `<style>` block | Low | 82-line `<style>` JSX string at lines 317–399. All CSS classes and custom properties must be preserved byte-for-byte. No visual change. | Copy verbatim into `src/app.jsx`. |
| `ReactDOM.createRoot` mount location | Medium | Legacy file calls `ReactDOM.createRoot(document.getElementById("root")).render(<App />)` at script scope (line 404). In `src/app.jsx` this must still execute at module load time. The `id="root"` in `index.html` must be present before the module script runs (guaranteed by `<script type="module">` deferred loading). | Preserve call at module scope after `App` definition. |
| localStorage key stability | Low | Keys `"qpa-theme"` and `"qpa-language"` are literal strings. They must not be renamed. E2E tests seed these keys explicitly. | Copy key literals verbatim. |
| Playwright E2E test coupling | Low | Tests assert on `.app`, `.sidebar`, `.main`, `.topbar`, `.tabnav`, `.content`, `.tab-btn`, `.tab-btn.on`, `.kpi-strip`, `.opt-cards`, `.src-grid`, `.head-metric`, and `data-theme` attribute. All of these originate from `app.jsx` JSX or its `<style>` block. | Preserve all className values. Do not rename any class. |
| Rate-limit banner placement | Low | `.rate-limit-banner` is rendered between `<nav.tabnav>` and `<div.content>` when `rateLimitWarning` is true. Its CSS uses `color-mix(in oklch, ...)`. Must remain in exactly this position. | Copy JSX and style verbatim. |
| `empty` conditional rendering | Low | `const empty = holdings.length === 0` drives the empty-state vs. tab-content branch. Must be preserved. | Trivial — preserve the branch. |
| `tabLabel` helper | Low | Inline function `tabLabel(id)` translates a tab id to the current language string. Not exported. | Keep as private helper inside `App()`. |
| `profileLabel` derived value | Low | Derived from `PROFILE_LABELS[language][profile]` with EN fallback. Not a memo — recalculates on every render. Acceptable for a string lookup. | Preserve inline. |
| `addTicker` / `removeTicker` / `setLots` stability | Low | These three handlers close over `setHoldings` and are passed as props to `Sidebar`. In React 18, they should be wrapped in `useCallback` in a future optimization pass, but the current pattern (re-created on every render) is functionally correct. | Preserve as-is in Phase 6i; do not add `useCallback` unless requested. |
| Mock fallback path for historyBySymbol | Medium | When proxy is offline (`!apiStatus.ok`), Effects 4 and 5 clear their state maps and set status to `"mock"`. The `buildPortfolio` memo checks `Object.keys(historyBySymbol).length || ...` to determine the `source` field. This chain must remain intact. | No logic change required. |

---

## 11. Recommended Phase 6i Implementation Plan

### Objective

Create `src/app.jsx` as a Vite-native ES module that replaces `public/legacy/app.jsx`
as the browser application root. Wire it into `index.html` **replacing** the seven
legacy `<script type="text/babel">` tags. Require `react` and `react-dom` as npm
dependencies.

**This is Phase 6 Step 8 + Step 9 combined**, as the npm React dependency is a
prerequisite for wiring `src/app.jsx` into the browser.

### Pre-condition

All 12 Node.js test suites pass and all 19 Playwright tests pass before starting.

### Step-by-step plan

#### Step 1 — Add React as npm dependency

```bash
npm install react react-dom
```

Update `vite.config.js` to use the classic JSX transform factory already configured
(`React.createElement`) — confirm it applies to all `src/**/*.jsx` files.

Do NOT remove the CDN `<script>` tags yet (still needed by legacy files).

#### Step 2 — Update all src/ React files to import React

Update `src/ui.jsx`, `src/charts.jsx`, `src/sidebar.jsx`, `src/views/overview.jsx`,
and `src/views/analysis.jsx` to add:

```js
import React from "react";
```

Remove the `/* @jsx React.createElement */` pragma from each file (React 17+ automatic
transform handles this, or keep the pragma if staying on classic transform — choose
one approach and apply consistently).

Verify: all existing `scripts/*-check.mjs` tests still pass (they test source text,
not runtime, so the import addition does not break them).

#### Step 3 — Create src/app.jsx

Create `src/app.jsx` with:

- `import React, { useState, useMemo, useEffect } from "react";`
- `import { createRoot } from "react-dom/client";`
- `import { DATA_SOURCES, ACTIVE_DATA_ADAPTER, DEFAULT_LOTS } from "./data.js";`
- `import { fmtUSD, fmtPctSigned, fmtNum, fmtPct, t } from "./ui.js";`
- `import { Pill } from "./ui.jsx";`
- `import { Sidebar } from "./sidebar.jsx";`
- `import { OverviewTab, RiskTab } from "./views/overview.jsx";`
- `import { AnalysisTab, OptimizationTab, SimulationTab, CompanyTab, DataTab } from "./views/analysis.jsx";`

Then copy `TABS`, `PROFILE_LABELS`, `API_BASE_URL`, `API_HEALTH_URL`, `historyWindow`
from the legacy file to module scope — no changes to their values.

Copy the `App()` function body verbatim with these mechanical changes only:
- `useStateApp` → `useState`
- `useMemoApp` → `useMemo`
- `useEffectApp` → `useEffect`
- `const dataAdapter = ACTIVE_DATA_ADAPTER` remains (now from import, not window)
- Lift `const daysFor = {...}` from inside `App()` to module scope (optional cleanup)

Copy the `<style>` block verbatim.

Add `window.__exportTab` and `window.__exportDone` assignments at module scope
after the `App` definition.

Replace `ReactDOM.createRoot(...).render(...)` with `createRoot(document.getElementById("root")).render(<App />)`.

#### Step 4 — Update index.html

Remove the seven `<script type="text/babel">` tags for the legacy files:
```html
<!-- REMOVE these seven lines -->
<script type="text/babel" src="/legacy/data.jsx"></script>
...
<script type="text/babel" src="/legacy/app.jsx"></script>
```

Remove the Babel Standalone CDN `<script>` tag.

Keep the React 18 UMD CDN scripts until Step 5 below (the child `src/` files
transitionally import from npm but the UMD globals may still be in scope —
confirm no double-React conflict before removing the CDN tags).

Add:
```html
<script type="module" src="/src/app.jsx"></script>
```

**Alternative (safer):** Use Vite's entry point mechanism — add `src/app.jsx` as
the entry in `vite.config.js` or rely on `index.html` being the Vite entry and
having `<script type="module" src="/src/app.jsx">`.

#### Step 5 — Remove React UMD CDN scripts from index.html

Once Step 4 is confirmed working (all 19 E2E tests pass), remove the two React 18
UMD CDN `<script>` tags and the Babel Standalone tag if not already removed.
Vite will bundle React from node_modules.

This is Phase 6 Step 10.

#### Step 6 — Write scripts/app-check.mjs

Node.js source-text analysis test covering:
- `src/app.jsx` exists
- Named imports from all 6 upstream modules
- `React` import from `react`
- `createRoot` import from `react-dom/client`
- `TABS` and `PROFILE_LABELS` defined at module scope
- `App` function exported or used as the createRoot argument
- `useState`, `useMemo`, `useEffect` used (not `useStateApp` etc.)
- `window.__exportTab` and `window.__exportDone` preserved
- `.rate-limit-banner` CSS class present
- `localStorage.getItem("qpa-theme")` and `localStorage.getItem("qpa-language")` present
- `createRoot(document.getElementById("root"))` present
- No `Object.assign(window, ...)` (app.jsx does not export to window — only the two export helpers)
- `window.__exportTab` and `window.__exportDone` assignments present

Add `"test:app": "node scripts/app-check.mjs"` to `package.json`.

### Acceptance criteria for Phase 6i (see section 12)

---

## 12. Exact Acceptance Criteria for Phase 6i

1. `src/app.jsx` file exists.
2. `src/app.jsx` imports `React` from `"react"` (not window global).
3. `src/app.jsx` imports `createRoot` from `"react-dom/client"`.
4. `src/app.jsx` imports `DATA_SOURCES`, `ACTIVE_DATA_ADAPTER`, `DEFAULT_LOTS` from `"./data.js"`.
5. `src/app.jsx` imports `fmtUSD`, `fmtPctSigned`, `fmtNum`, `fmtPct`, `t` from `"./ui.js"`.
6. `src/app.jsx` imports `Pill` from `"./ui.jsx"`.
7. `src/app.jsx` imports `Sidebar` from `"./sidebar.jsx"`.
8. `src/app.jsx` imports `OverviewTab`, `RiskTab` from `"./views/overview.jsx"`.
9. `src/app.jsx` imports `AnalysisTab`, `OptimizationTab`, `SimulationTab`, `CompanyTab`, `DataTab` from `"./views/analysis.jsx"`.
10. `useState`, `useMemo`, `useEffect` are used (not the `App`-suffixed aliases).
11. `TABS` constant is present with all 7 tab descriptors.
12. `PROFILE_LABELS` constant is present with EN and TR keys.
13. `API_BASE_URL` is derived from `DATA_SOURCES.real.baseUrl` with fallback.
14. `historyWindow(range)` helper is present and unchanged.
15. All 14 state variables are present (theme, language, holdings, dateRange, profile, assumptions, tab, apiStatus, rateLimitWarning, historyBySymbol, quoteBySymbol, profileBySymbol, marketDataStatus, referenceDataStatus).
16. Both `useMemo` hooks (`p` and `pAdj`) are present with correct dependency arrays.
17. All 5 `useEffect` hooks (theme, language, health, history, reference data) are present.
18. `rateLimitWarning` detection present in Effects 4 and 5 (`body.error === "rate_limited"`).
19. `addTicker`, `removeTicker`, `setLots` handlers present.
20. All 7 child components rendered with the correct prop sets (see Section 9).
21. `empty` branch renders empty-state div when `holdings.length === 0`.
22. `.rate-limit-banner` renders when `rateLimitWarning === true`, positioned between `<nav.tabnav>` and `<div.content>`.
23. `<style>` block is present and contains all CSS classes from the legacy file.
24. `window.__exportTab` and `window.__exportDone` are assigned at module scope.
25. `createRoot(document.getElementById("root")).render(<App />)` is present.
26. `localStorage.getItem("qpa-theme")` and `localStorage.getItem("qpa-language")` read the correct keys.
27. `localStorage.setItem("qpa-theme", theme)` and `localStorage.setItem("qpa-language", language)` write the correct keys.
28. `public/legacy/app.jsx` is **unchanged**.
29. `public/legacy/*.jsx` files (all seven) are **unchanged**.
30. `index.html` does **not** load the seven legacy `<script type="text/babel">` tags after migration.
31. `npm run test:smoke` passes.
32. `npm run test:e2e` passes (19/19).
33. `npm run test:analysis` passes.
34. `npm run test:overview` passes.
35. `npm run test:app` passes (new test script from Section 11 Step 6).
36. No financial formula, optimizer output, Monte Carlo, CVaR, or beta value changes.
37. No visual layout changes (dashboard, sidebar, topbar, tabs, charts all render identically).
38. No new advisory language introduced.

---

## 13. What NOT To Do in Phase 6i

- Do not add `useCallback` to `addTicker`, `removeTicker`, or `setLots` unless specifically requested.
- Do not split `App()` into sub-components.
- Do not change the two-memo pattern (`p` + `pAdj`).
- Do not convert the inline `<style>` block to a CSS file.
- Do not rename any CSS class.
- Do not change the AbortController pattern in Effects 4 and 5.
- Do not "fix" Effect 3's `active` flag to use AbortController (functional, out of scope).
- Do not lift `assumptions` state into a context provider.
- Do not add error boundaries.
- Do not add React.StrictMode wrapping.
- Do not change tab IDs or their order.
- Do not change the `rateLimitWarning` detection logic.
- Do not change the `historyWindow` date math.
- Do not add persistence for holdings, dateRange, profile, or assumptions.
- Do not change the PPTX export helpers.
- Do not add or remove props from any child component call site.
- Do not change the `pAdj.source.lastUpdated` prop passed to Sidebar (even if currently undefined).

---

## 14. Test Results

### Phase 6h (audit only — 2026-06-06)

| Test | Result | Notes |
|---|---|---|
| `npm run test:smoke` | ✓ PASS | "Smoke checks passed" |
| `npm run test:e2e` | ✓ PASS (19/19) | All 19 Playwright tests passed in 34.1 s |
| `npm run test:analysis` | ✓ PASS | "analysis checks passed" |
| `npm run test:overview` | ✓ PASS | "overview checks passed" |

### Phase 6i-prep (React npm dep + src/ React import — 2026-06-06)

| Test | Result | Notes |
|---|---|---|
| `npm run test:smoke` | ✓ PASS | |
| `npm run test:metrics` | ✓ PASS | |
| `npm run test:api` | ✓ PASS | |
| `npm run test:history` | ✓ PASS | |
| `npm run test:cache` | ✓ PASS | |
| `npm run test:news` | ✓ PASS | |
| `npm run test:ratelimit` | ✓ PASS | |
| `npm run test:ui` | ✓ PASS | |
| `npm run test:charts` | ✓ PASS | Assertion flipped to require npm React import |
| `npm run test:sidebar` | ✓ PASS | Assertion flipped to require npm React import |
| `npm run test:overview` | ✓ PASS | Assertion flipped to require npm React import |
| `npm run test:analysis` | ✓ PASS | Assertion flipped to require npm React import |
| `npm run test:e2e` | ✓ PASS (19/19) | All 19 Playwright tests passed in 30.9 s |

### Phase 6i (app.jsx cutover — 2026-06-06)

| Test | Result | Notes |
|---|---|---|
| `npm run test:smoke` | ✓ PASS | Legacy Babel chain absence verified; module entry verified; all 7 legacy files on disk |
| `npm run test:metrics` | ✓ PASS | |
| `npm run test:api` | ✓ PASS | |
| `npm run test:history` | ✓ PASS | |
| `npm run test:cache` | ✓ PASS | |
| `npm run test:news` | ✓ PASS | |
| `npm run test:ratelimit` | ✓ PASS | |
| `npm run test:ui` | ✓ PASS | |
| `npm run test:charts` | ✓ PASS | |
| `npm run test:sidebar` | ✓ PASS | |
| `npm run test:overview` | ✓ PASS | |
| `npm run test:analysis` | ✓ PASS | |
| `npm run test:app` | ✓ PASS (25/25) | New: all Phase 6i acceptance criteria verified |
| `npm run test:e2e` | ✓ PASS (19/19) | 23.0 s — faster than legacy Babel runtime (~30 s) |
| `npm run build` | ✓ PASS | 30 modules, 318 kB JS (97 kB gzip), 731 ms, zero warnings |

---

## 15. Behavior Change Statement

**Phase 6h (audit only):** No runtime behavior was changed. This document was created
by reading `public/legacy/app.jsx` and cross-referencing the existing `src/` modules
and `docs/`. No file other than `docs/APP_MIGRATION_AUDIT.md` was created or modified.
No legacy JSX file was touched. No `index.html` change was made. Babel Standalone
was not removed. React was not added as an npm dependency.

**Phase 6i-prep (React npm dep + src/ React import):** No browser runtime behavior
was changed. `index.html` is unchanged. `public/legacy/*.jsx` files are unchanged.
The legacy CDN scripts (React 18 UMD, Babel Standalone) are still active. The browser
app continues to boot from `public/legacy/app.jsx` via Babel. The only changes are:
- `react` and `react-dom` added to `node_modules` (not yet bundled into the browser app)
- `import React from "react"` added to each of the 5 `src/*.jsx` files
- 4 test scripts updated to enforce the npm React import requirement
- `vite.config.js` comment updated

**Phase 6i (app.jsx cutover):** The browser runtime has fundamentally changed — Babel Standalone and React UMD CDN scripts are gone. All application code is now bundled by Vite from `src/`. Observable user-facing behavior is identical (all 19 Playwright E2E tests confirm this). The only changes a user would notice are performance improvements: the 200–600 ms in-browser Babel parse+transpile cost is eliminated, and load time is shorter because CDN scripts are no longer fetched. `public/legacy/*.jsx` files are preserved on disk and untouched.

---

## 16. Diff Summary

### Phase 6h

| File | Action | Description |
|---|---|---|
| `docs/APP_MIGRATION_AUDIT.md` | Created | This document |
| All other files | Unchanged | No modifications |

### Phase 6i-prep

| File | Action | Description |
|---|---|---|
| `package.json` | Updated | `react@^18.x` and `react-dom@^18.x` added as dependencies |
| `src/ui.jsx` | Updated | `import React from "react"` added; header comment updated to Phase 6i-prep |
| `src/charts.jsx` | Updated | `import React from "react"` added; header comment updated |
| `src/sidebar.jsx` | Updated | `import React from "react"` added; header comment updated |
| `src/views/overview.jsx` | Updated | `import React from "react"` added; header comment updated |
| `src/views/analysis.jsx` | Updated | `import React from "react"` added; header comment updated |
| `scripts/charts-check.mjs` | Updated | Test 8 assertion flipped: "must NOT import React" → "must import React" |
| `scripts/sidebar-check.mjs` | Updated | Test 7 assertion flipped: same |
| `scripts/overview-check.mjs` | Updated | Test 10 assertion flipped: same |
| `scripts/analysis-check.mjs` | Updated | Test 13 assertion flipped: same |
| `vite.config.js` | Updated | esbuild comment updated to reflect npm React source |
| `public/legacy/app.jsx` | Unchanged | |
| `public/legacy/*.jsx` (all 7) | Unchanged | |
| `index.html` | Unchanged | |
