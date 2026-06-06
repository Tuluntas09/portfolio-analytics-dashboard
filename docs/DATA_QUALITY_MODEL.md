# Data Quality Model

**Project:** Quant Portfolio Analytics Dashboard  
**Date:** 2026-06-06

---

## 1. Data Source Hierarchy

The dashboard operates with a three-tier data quality model. The tier in use
is visible at all times in the top bar badge and the Data tab.

```
Tier 1 — Real (all symbols loaded from proxy)
  Badge: "Real Prices" (green)
  Source: Finnhub stock candles via local Node proxy (port 8787)

Tier 2 — Partial (some symbols loaded, some fell back to mock)
  Badge: "Partial Prices" (yellow/warn)
  Source: Mix of Finnhub/Yahoo for available symbols + GBM mock for missing

Tier 3 — Mock (proxy offline or no API key)
  Badge: "Mock Prices" (neutral/grey)
  Source: Deterministic GBM simulation (seeded, reproducible)
```

---

## 2. Real Data Path

### Price history (`/api/market/history`)

1. Proxy calls Finnhub `/stock/candle` (daily resolution).
2. If Finnhub returns `s: "ok"` with at least one candle, normalizes to `{date, open, high, low, close, volume, adjClose}` format and returns.
3. If Finnhub fails (no key, rate limit, no data for symbol), proxy falls back to Yahoo Finance `v8/finance/chart`.
4. Yahoo candles are normalized to the same schema; `adjClose` comes from the `indicators.adjclose` array, falling back to `close`.
5. If both fail, proxy returns `ok: false` with empty `candles: []`.

**Frontend behavior on failure:** Symbol is omitted from `historyBySymbol`. `buildPortfolio` detects the missing history and falls back to the mock GBM path for that symbol only. The `marketDataStatus.status` becomes `"partial"` if at least one symbol loaded.

### Live quote (`/api/market/quote`)

- Calls Finnhub `/quote`. Returns `c` (current price), `pc` (previous close), `d` (change), `dp` (pct change).
- Frontend uses `quote.c` as `latestPrice` for position value calculation when available.
- Fallback: last value in the real price history path, or mock `u.px`.

### Company profile (`/api/company/profile`)

- Calls Finnhub `/stock/profile2`. Returns name, ticker, logo, country, exchange, ipo, marketCap, sector, weburl.
- Displayed in the Company Data tab.
- Fallback: empty profile card with ticker shown only.

### Company news (`/api/company/news`)

- Calls Finnhub `/company-news` for the selected symbol over a 30-day rolling window.
- Response is wrapped in the standard proxy envelope: `{ ok, provider, endpoint, data: [...], cacheStatus }`.
- Cached at the proxy layer with a 10-minute TTL (Phase 5a).
- **Framing constraint:** News is displayed as company context only. It is not used for scoring, analytics, or any financial metric. Failure to load news has zero effect on portfolio analytics.
- **Frontend behavior (Phase 5b):** `CompanyTab` fetches news via `useEffectVA` on symbol change. States: `loading → loaded | empty | error | unavailable`. Fetch is gated on `apiStatus.ok`; proxy offline → "unavailable" (no throw, no analytics impact). Items are normalized via `normalizeNewsItem`: empty headline → filtered out, URL scheme validated (http/https only), headline capped at 120 chars, `datetime` converted from Unix seconds to Date.
- **Fallback:** If the proxy is offline or the API key is absent, the news card shows a soft "unavailable" message. The rest of the Company Data tab (profile card, metrics) is unaffected.

---

## 3. Mock Data Path

When the proxy is offline or returns no usable data, the mock engine in `data.jsx` runs.

### Mock price engine

- Algorithm: Geometric Brownian Motion with per-asset `mu` (expected return) and `sig` (volatility).
- RNG: mulberry32, seeded with `seed + ticker_hash` for per-asset determinism.
- Seed source: `20260604 + (dateRange.length * 13)` — changes with date range selection, stable within a session.
- Start price: back-calculated from the terminal price so that the path ends near `u.px` (universe reference price).

### Mock correlation matrix

- 15×15 partially hard-coded `CORR` object for frequently used pairs.
- For undefined pairs: `0.35 + (hash(a+b) % 40) / 100` — a deterministic fallback in the 0.35–0.75 range.
- This means less common asset pairs always appear moderately positively correlated.

### Mock company profile / news

- Company profile: shows the real Finnhub profile when the proxy is running, or an empty state when not. No mock profile data.
- Company news: fetches live from Finnhub via proxy when `apiStatus.ok`. Shows "unavailable" when proxy is offline. No mock news data — the static `NEWS` placeholder was removed in Phase 5b.

---

## 4. Data Quality State Machine

```
App startup
  │
  ├─ fetch /api/health
  │     ├─ success (ok: true, hasFinnhubKey: true)
  │     │     → apiStatus = { ok: true, hasFinnhubKey: true }
  │     │     → fetch history + quote + profile for all holdings
  │     │
  │     ├─ success (ok: true, hasFinnhubKey: false)
  │     │     → apiStatus = { ok: true, hasFinnhubKey: false }
  │     │     → fetch history (will get 503 per symbol), quote (503)
  │     │     → all symbols fall through to Yahoo fallback for history
  │     │     → quote/profile: empty → position values use mock px
  │     │
  │     └─ failure (proxy offline or network error)
  │           → apiStatus = { ok: false }
  │           → marketDataStatus = "mock"
  │           → all analytics run on mock GBM data
  │
  ├─ Per symbol (parallel fetches)
  │     history ok  → historyBySymbol[symbol] = candles
  │     history fail → historyBySymbol[symbol] missing → mock GBM for that symbol
  │
  └─ buildPortfolio()
        realSymbols = symbols with usable history OR live quote
        sourceId = "real" if realSymbols.length > 0, else "mock"
        per asset:
          latestPrice = liveQuote.c ?? realPath.last ?? u.px
          path = realPath ?? mockGBM()
```

---

## 5. Missing Data Handling by Field

| Field | Source | Missing behavior |
|---|---|---|
| Price history | Finnhub → Yahoo → mock | Falls to mock GBM; asset still shown in portfolio |
| Latest price | Finnhub quote → history last → mock px | Position value uses mock px; no crash |
| adjClose | Yahoo adjclose array → close fallback | Uses raw close if adjclose is null |
| Company name | Finnhub profile | Shows ticker only |
| Company logo | Finnhub profile | Logo cell empty |
| Market cap | Finnhub profile | Shows "—" |
| Company news | Finnhub /company-news via proxy | Shows "unavailable" soft message; never breaks analytics |
| Sector | UNIVERSE constant (static) | Always available regardless of proxy |
| Beta | Synthetic formula (not from data) | Always has a value; not from real data |
| Correlation | Partial hard-coded matrix + hash fallback | Always has a value; less common pairs get synthetic value |

---

## 6. Known Data Quality Gaps

### Gap 1 — adjClose not used for return calculation consistency

The proxy normalizes and returns `adjClose`, and `historyPath()` correctly prefers `adjClose`. However, the mock path uses raw `px` as the base price with no dividend/split adjustment concept. When mixing real (adjusted) and mock prices across assets, the return series are not on a comparable basis.

**Impact:** Minor for index ETFs; potentially material for individual equities with significant dividends.

### Gap 2 — VTI benchmark is always fetched even if not in the portfolio

`app.jsx` unconditionally includes `"VTI"` in the `uniqueSymbols` list for history fetches. If the user has VTI in their portfolio this is free. If not, it adds one extra API call on every holdings or date-range change.

**Impact:** Minor API usage; no functional issue.

### Gap 3 — Quote price and history price may use different dates

The live quote returns the current intraday price. The history path ends at the last market close. Position values use `quote.c` (live) while the price history chart ends at the last close. The gap between them is not surfaced to the user.

**Impact:** Small intraday discrepancy in position value vs. chart endpoint.

### Gap 4 — Yahoo Finance endpoint is undocumented

`query1.finance.yahoo.com/v8/finance/chart` is an unofficial endpoint used by many open-source tools. Yahoo does not publish an SLA or stability guarantee. Breaking changes have historically occurred without notice.

**Mitigation:** This is intentional as a best-effort fallback. The proxy correctly labels responses with `provider: "yahoo"` and `fallbackUsed: true`. The user can see this in the Data tab.

### Gap 5 — No stale-data warning *(partially mitigated by Phase 5a cache metadata)*

If the proxy fetches data successfully at startup but the session continues for hours, the displayed prices and history are not refreshed. There is no "last refreshed" timestamp shown for real data beyond the static "Runtime API" label.

**Phase 5a mitigation:** Proxy responses now include `cachedAt` (ISO timestamp of when the cache entry was written) and `ttlSeconds` on cache hits. A future UI phase can surface this without further proxy changes.

**Remaining gap:** No "last refreshed" UI indicator. No manual refresh button. These remain for a future phase.

### Gap 6 — Partial price state is ambiguous *(Partially resolved in Phase 2)*

When `marketDataStatus.status === "partial"`, the badge says "Partial Prices X/Y" but the user cannot see which specific symbols loaded real data and which are on mock.

**Resolved:** The Data tab now includes a "Symbol data sources" card (compact table) showing each holding with its resolved `dataProvider` value and a color-coded pill:
- `pos` (green) — Finnhub or real data
- `warn` (yellow) — Yahoo Finance fallback
- `neutral` (grey) — Deterministic mock

The Overview tab's "Holdings detail" table also gains a "Source" column showing the same provider label inline.

**Remaining gap:** No per-symbol last-fetched timestamp. No manual refresh button. These remain for a future phase.

---

## 7. Per-Symbol Provider Labels (Phase 2)

`dataProvider` is a field set on every asset object in `buildPortfolio`. The following mapping is used by `dataProviderLabel()` (defined in `views-overview.jsx`, exported to `window`):

| Raw `dataProvider` | Displayed label | Pill tone |
|---|---|---|
| `"finnhub quote"` | Finnhub | green |
| `"finnhub"` | Finnhub | green |
| `"real"` | Real Data | green |
| `"yahoo"` | Yahoo Fallback | yellow |
| `"mock"` | Deterministic Mock | grey |
| anything else | Unknown | grey |

These labels appear in:
- **Overview tab** → Holdings detail table → Source column
- **Data tab** → Symbol data sources card → Provider column

---

## 8. Data Quality Badge Reference

| Badge text | Condition | Color |
|---|---|---|
| Real Prices | All holdings loaded real history | Green (pos) |
| Loading Prices | Fetch in progress | Accent (blue) |
| Partial Prices | Some symbols loaded, some on mock | Yellow (warn) |
| Mock Prices | Proxy offline or zero real symbols | Grey (neutral) |

These states are also available in the Data tab alongside:

- Proxy status (online / offline / key missing)
- Quote/profile loaded count
- History loaded count per requested symbol
