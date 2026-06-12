# Phase 13 — Production Proxy Deployment Plan

**Project:** Quant Portfolio Analytics Dashboard  
**Date:** 2026-06-10  
**Status:** Planning — no code changes yet  
**Scope:** Moving from optional-local-only proxy toward an optionally-deployed production proxy, without exposing the Finnhub API key to the browser and without breaking the static Vercel mock/offline demo.

---

## 1. Current Proxy Architecture

### 1.1 Server (`server/market-data-server.mjs`)

The proxy is a **zero-dependency Node.js HTTP server** using only built-in modules (`node:http`, `node:url`, `node:fs`, `node:path`). It runs as a single persistent process.

**Endpoints:**

| Method | Path | Upstream | Cache TTL |
|---|---|---|---|
| GET | `/api/health` | None (local) | Not cached |
| GET | `/api/market/quote?symbol=X` | Finnhub `/quote` | 60 s |
| GET | `/api/market/candles?symbol=X` | Finnhub `/stock/candle` | 30 min |
| GET | `/api/market/history?symbol=X` | Finnhub → Yahoo fallback | 30 min |
| GET | `/api/company/profile?symbol=X` | Finnhub `/stock/profile2` | 12 h |
| GET | `/api/company/news?symbol=X` | Finnhub `/company-news` | 10 min |
| OPTIONS | `*` | 204 (CORS preflight) | N/A |

**Process model:** Single-process; cache is in-memory and does not survive restarts. This is intentional — see cache.mjs comment: "Stale market data from a previous session is worse than a fresh miss."

**Port / host binding:**
- `process.env.MARKET_DATA_PORT || process.env.PORT || 8787`
- `process.env.MARKET_DATA_HOST || "127.0.0.1"` (loopback-only by default)
- Setting `MARKET_DATA_HOST=0.0.0.0` opens external connections — required for all cloud deployments

**API key security:**
- Read from `.env.local` → `.env` → `.streamlit/secrets.toml` via `loadLocalSecrets()`
- Never logged; never returned in any response
- Health endpoint exposes only `hasFinnhubKey: Boolean(getFinnhubKey())`

**Symbol validation:** `^[A-Z0-9.-]{1,15}$` — validated before any upstream call; 400 on mismatch.

**Fallback chain:** Finnhub `/stock/candle` → Yahoo Finance `v8/finance/chart` for history routes. Yahoo responses are labeled with `provider: "yahoo"` and `fallbackUsed: true`.

**429 handling:** `parseRetryAfter()` supports decimal seconds, HTTP-date string, and 60 s fallback. History routes fall through to Yahoo on Finnhub 429.

**Timeout:** 10 s per upstream request.

### 1.2 Cache (`server/cache.mjs`)

- In-memory `Map` store with per-entry expiry
- 500-entry max; LRU-style eviction (oldest insertion-order entry)
- In-flight deduplication: concurrent identical requests share a single Promise
- Errors (non-200 or `ok: false`) are **never cached** — failed upstream always retries
- Stats exposed via `/api/health`: `cacheEntries`, `inFlightRequests`, `cacheHits`, `cacheMisses`, `dedupedRequests`
- **Important:** Cache does not survive process restarts. On Render/Railway free tier, every cold start begins with an empty cache.

### 1.3 Frontend proxy configuration (`src/data.js`)

```js
// Line 70
const _PROXY_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8787";
```

- `VITE_API_BASE_URL` is an **optional build-time env var** — the only configuration point needed to aim the frontend at a deployed proxy.
- When unset, defaults to local development (`http://127.0.0.1:8787`).
- This variable is **not a secret** — it is a public URL baked into the bundle at build time.
- The comment on line 69 already says: "Never set VITE_FINNHUB_API_KEY".

### 1.4 Current CORS posture — CRITICAL GAP

The proxy currently responds to all requests with:
```
Access-Control-Allow-Origin: *
```

This means **any website on the internet** can call the deployed proxy from a browser and consume the Finnhub API key's request quota. For local development this is safe (loopback-only). For a publicly deployed proxy, this is an unacceptable exposure.

### 1.5 What currently works (no code changes needed)

- Port/host configurable via env vars — cloud platforms set `PORT` automatically
- Key loading supports environment variables directly — `FINNHUB_API_KEY` as a platform secret works without code changes
- Yahoo Finance fallback already in place
- Graceful mock fallback in the frontend already handles proxy unavailability
- `VITE_API_BASE_URL` hook already in place in `src/data.js`
- `vercel.json` is minimal and does not need to route proxy traffic

---

## 2. Deployment Options Comparison

### Option A — Status quo (unchanged)

**Description:** Static Vercel frontend (mock/offline). Proxy runs locally only when the developer starts it with `npm run api`. Not exposed to the public internet.

**What already works:** Everything. This is Mode A + B in `DEPLOYMENT.md`.

**Gaps for "production proxy":** The proxy is never publicly reachable. The public Vercel demo always shows mock data.

**Verdict:** Correct for the public portfolio demo. Not the goal of Phase 13.

---

### Option B — Separate backend host (Render / Railway / Fly.io) ← **RECOMMENDED**

**Description:** Deploy `server/market-data-server.mjs` as a persistent Node.js service on a separate backend platform. Set `VITE_API_BASE_URL` on the Vercel frontend to the proxy's public URL. The static Vercel demo remains untouched; the public demo can optionally be re-deployed with live data.

**Platforms:**

| Platform | Free tier | Cold start | Notes |
|---|---|---|---|
| Render | Yes (spins down after ~15 min idle) | ~30 s | Easiest setup; `PORT` set automatically |
| Railway | Yes (usage-based credits) | None (persistent) | Better for always-on; slightly more setup |
| Fly.io | Yes (3 shared VMs) | None (can be persistent) | Docker-based; most control |

**Env vars required on the proxy host:**

| Variable | Value | Notes |
|---|---|---|
| `FINNHUB_API_KEY` | Your Finnhub API key | Required for live data |
| `MARKET_DATA_HOST` | `0.0.0.0` | Required for external connections |
| `PORT` | Set by platform automatically | Proxy reads `PORT` already |
| `CORS_ORIGIN` | `https://your-project.vercel.app` | NEW — currently missing; needed to replace `"*"` |

**Env var required on Vercel (frontend build):**

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://your-proxy.onrender.com` | Not a secret; baked into bundle |

**Code changes required:**
- Replace `"Access-Control-Allow-Origin": "*"` with env-var-based allowlist (server/market-data-server.mjs) — ~10 lines
- Add CORS_ORIGIN to .env.example — 1 line
- Update DEPLOYMENT.md Option C walkthrough

**Impact on existing behavior:**
- Mode A (static demo with no proxy): zero change — `VITE_API_BASE_URL` not set on that Vercel deployment
- Mode B (local development): zero change — CORS_ORIGIN defaults to `"*"` when not set, preserving current local behavior
- Mode C (deployed proxy): CORS now restricts to the configured origin

**Verdict:** This is the right option. All infrastructure is already in place. The only missing piece is CORS hardening.

---

### Option C — Vercel serverless function wrapping the proxy

**Description:** Move the proxy logic into a Vercel Serverless Function (`/api/market/[...slug].js`), deployed alongside the frontend. The function runs in Vercel's Fluid Compute environment.

**Pros:** Single deployment, no separate backend host, `FINNHUB_API_KEY` stays in Vercel environment variables.

**Cons:**
- The in-memory cache (`server/cache.mjs`) is incompatible with serverless — each function invocation is stateless; cache does not survive across requests. The TTL caching that protects the Finnhub 60 req/min limit **would not work**.
- Node.js in-memory deduplication (in-flight Promises) also does not work across invocations.
- Without caching: a 5-ticker portfolio load triggers ~20 upstream Finnhub calls. At 60/min free tier, this would immediately rate-limit.
- Fixing this requires an external cache (Vercel KV or similar), which adds a paid dependency — violating the constraint "do not add paid services as a hard requirement."
- `vercel.json` rewrites would need to be added.

**Verdict:** NOT recommended for Phase 13. The in-memory cache is the core value of the proxy; serverless eliminates it without adding external cache infrastructure.

---

### Option D — Vercel API rewrites → external proxy (proxy-of-a-proxy)

**Description:** Add rewrites to `vercel.json` so that `/api/*` on the Vercel domain is transparently forwarded to the external proxy. This hides the proxy URL from the frontend bundle.

**Pros:** Proxy URL stays out of the bundle; CORS issues at the proxy level disappear (Vercel-to-proxy is server-to-server).

**Cons:**
- Adds latency: every proxy request goes through Vercel → external proxy → Finnhub.
- Each rewrite consumes a Vercel Function invocation, which counts against usage.
- The proxy still needs to be deployed externally (same as Option B) plus extra Vercel config.
- The proxy URL, while not in the bundle, is visible in Vercel project settings (not meaningfully more secret).
- Adds complexity with no material security gain for this use case.

**Verdict:** Over-engineered for this project. Option B is simpler with equivalent security.

---

## 3. Recommended Phase 13 Direction

**Option B: Deploy proxy to a persistent Node.js host; tighten CORS; update documentation.**

The proxy is already architecturally ready for production deployment. The only gap blocking production use is the open CORS policy (`"*"`). Everything else — port/host env vars, key loading from environment, Yahoo fallback, 429 handling — already works.

**Phase 13 scope (minimal, targeted):**

1. **CORS hardening in `server/market-data-server.mjs`** (~10 lines)  
   Read `CORS_ORIGIN` env var; if set, restrict `Access-Control-Allow-Origin` to that value; if unset, default to `"*"` for backward compatibility in local dev. Log a startup warning when `"*"` is in effect.

2. **Update `.env.example`** (1 line)  
   Document `CORS_ORIGIN=` with inline comment.

3. **Update `docs/DEPLOYMENT.md`** (Option C walkthrough)  
   Add step-by-step Render deployment instructions; CORS_ORIGIN env var; security notes.

4. **Update `docs/PRODUCTIZATION_ROADMAP.md`** (1 row)  
   Add Phase 13 entry with completion status.

**What Phase 13 does NOT include:**
- Proxy token authentication (deferred to Phase 14+ if needed)
- IP-level rate limiting at the proxy (deferred)
- External cache layer (not needed; breaks the no-paid-services constraint)
- Any changes to the frontend data fetching or fallback logic
- Any changes to financial formulas, localStorage schema, or mobile/responsive work

---

## 4. Security Model

### What is already secure (no changes needed)

| Item | How it is secured |
|---|---|
| `FINNHUB_API_KEY` not in browser bundle | Not prefixed with `VITE_`; Vite never reads it; proxy only |
| Key not logged or returned | Only `Boolean(getFinnhubKey())` appears in health response |
| Key not in git | `.env.local` is gitignored |
| Local proxy loopback-only by default | `MARKET_DATA_HOST` defaults to `127.0.0.1` |
| Symbol validation | `^[A-Z0-9.-]{1,15}$` before any upstream call |
| Upstream request timeout | 10 s per request |

### What Phase 13 fixes

**CORS: replace `"*"` with a configured allowlist.**

The CORS header is a browser-enforced policy — it does not block direct (non-browser) callers like `curl`. However, it does prevent other websites from making cross-origin requests to the proxy using the visitor's browser. For the threat model of a personal portfolio tool (protecting Finnhub API quota from casual abuse by third-party sites), CORS restriction is appropriate and sufficient.

Implementation:
```js
// server/market-data-server.mjs — proposed change
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
if (CORS_ORIGIN === "*") {
  console.warn("[proxy] WARNING: CORS_ORIGIN is not set — proxy accepts requests from any origin.");
}
// Replace every occurrence of:
//   "Access-Control-Allow-Origin": "*"
// with:
//   "Access-Control-Allow-Origin": CORS_ORIGIN
```

For local development: `CORS_ORIGIN` unset → `"*"` → current behavior unchanged.  
For deployed proxy: `CORS_ORIGIN=https://portfolio-analytics-dashboard-three.vercel.app` → only that origin allowed.

### What Phase 13 does NOT fix (acknowledged gaps, deferred)

| Gap | Risk level | Mitigation if needed |
|---|---|---|
| Non-browser callers can still reach proxy | Low for personal project | Add `PROXY_TOKEN` check in Phase 14 |
| No per-IP rate limiting | Medium if URL becomes public | Add simple in-memory IP counter in Phase 14 |
| Yahoo Finance endpoint undocumented | Low (already documented in DATA_QUALITY_MODEL.md) | Accept; label responses clearly |
| Cache lost on cold start | Low (Render free tier) | Document in DEPLOYMENT.md; frontend handles gracefully |

---

## 5. Frontend Configuration Model

### Current state

```
src/data.js line 70:
const _PROXY_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8787";
```

### What changes in Phase 13

**Nothing in the frontend changes.** The `VITE_API_BASE_URL` hook is already in place. Setting this env var on Vercel at build time is all that is needed to point the deployed frontend at the deployed proxy.

### Environment variable matrix

| Env var | Where set | Who uses it | Secret? |
|---|---|---|---|
| `FINNHUB_API_KEY` | Proxy host (Render/Railway) env | `server/market-data-server.mjs` only | Yes — never set on Vercel |
| `MARKET_DATA_HOST` | Proxy host env | `server/market-data-server.mjs` | No |
| `PORT` | Set by platform automatically | `server/market-data-server.mjs` | No |
| `CORS_ORIGIN` | Proxy host env | `server/market-data-server.mjs` | No (it's a public URL) |
| `VITE_API_BASE_URL` | Vercel build env | Baked into `dist/` bundle | No (public proxy URL) |

**Never add:**
- `VITE_FINNHUB_API_KEY` — would expose the key in the browser bundle
- `FINNHUB_API_KEY` as a Vercel env var — serves no purpose and risks exposure

---

## 6. Impact on Existing Behavior

### Mode A — Static Vercel demo (mock/offline)

**Impact: zero.**

The public demo at `portfolio-analytics-dashboard-three.vercel.app` is deployed without `VITE_API_BASE_URL`. The frontend defaults to `http://127.0.0.1:8787`, which is never reachable from a public Vercel deployment. The health check fails silently; the app runs on mock data as it always has.

Adding `CORS_ORIGIN` to the proxy does not affect the frontend static demo because the demo never talks to a proxy.

### Mode B — Local live-data development

**Impact: zero.**

Local development uses the proxy at `http://127.0.0.1:8787`. When `CORS_ORIGIN` is not set in `.env.local`, it defaults to `"*"` — same behavior as today. Developers who want to explicitly test CORS restriction locally can add `CORS_ORIGIN=http://127.0.0.1:8502` to `.env.local`.

### Mode C — Deployed proxy (new capability enabled by Phase 13)

This mode becomes fully documented and ready to deploy:
- Frontend deployed to Vercel with `VITE_API_BASE_URL` set
- Proxy deployed to Render/Railway with `FINNHUB_API_KEY`, `MARKET_DATA_HOST=0.0.0.0`, and `CORS_ORIGIN` set
- Real Finnhub data visible on the public demo

### Existing E2E tests (49/49)

**Impact: zero.** All 49 E2E tests run in mock/offline mode (no proxy). They test DOM structure, interaction, and rendering — none of them call the proxy or rely on CORS headers.

---

## 7. Test Strategy

### Existing tests (no changes needed)

All 49 Playwright E2E tests continue to pass unmodified. They use the Vite dev server with no proxy running.

### New tests for Phase 13

**Category 1 — Proxy integration (script-based, similar to existing `scripts/api-health-check.mjs` pattern):**

`scripts/proxy-cors-check.mjs`

| Test | Method |
|---|---|
| Health endpoint returns `ok: true` | GET `/api/health` |
| Health exposes `hasFinnhubKey` (boolean, not the key) | Check response shape |
| `Access-Control-Allow-Origin` is not `*` when `CORS_ORIGIN` is set | Start proxy with `CORS_ORIGIN=https://example.com`; check response header |
| `Access-Control-Allow-Origin` is `*` when `CORS_ORIGIN` is unset | Start proxy without env var; check response header |
| Unknown route returns 404 with `ok: false` | GET `/api/nonexistent` |
| Invalid symbol returns 400 | GET `/api/market/quote?symbol=!!INVALID` |

**Category 2 — Manual deployment validation checklist** (documented in DEPLOYMENT.md, not automated):

- [ ] Proxy deployed to Render; URL is `https://your-proxy.onrender.com`
- [ ] `GET https://your-proxy.onrender.com/api/health` returns `{ ok: true, hasFinnhubKey: true }`
- [ ] Response header `Access-Control-Allow-Origin` equals the configured Vercel origin
- [ ] Vercel frontend redeployed with `VITE_API_BASE_URL` set
- [ ] Dashboard sidebar shows "Proxy ready" and "Real Prices"
- [ ] After navigating away and returning: cache hit visible in `/api/health` stats
- [ ] Static demo deployment (without `VITE_API_BASE_URL`): sidebar shows "Mock Prices" — unchanged

### What NOT to add

- No E2E tests that depend on a live Finnhub key (would break CI without a key)
- No E2E tests that call a deployed proxy URL (environment-specific; not suitable for CI)
- No new npm dependencies for testing

---

## 8. Documentation Strategy

### Files to update in Phase 13

**`docs/DEPLOYMENT.md`**  
Option C section is already present but thin. Expand it with:
- Complete Render step-by-step (new service → Node.js → start command → env vars table)
- `CORS_ORIGIN` variable explanation and why it matters
- Cold-start behavior on Render free tier (already documented; keep and expand)
- Manual validation checklist (matching the test checklist above)
- Note that `VITE_API_BASE_URL` is not a secret and is safe in Vercel build env vars

**`.env.example`**  
Add `CORS_ORIGIN=` with comment explaining the purpose and that it should be set to the Vercel deployment URL.

**`docs/PRODUCTIZATION_ROADMAP.md`**  
Add Phase 13 entry once implementation is complete.

**`README.md`**  
No changes needed for Phase 13. The README already mentions Options A/B/C. If a "live data mode" badge or status row is desired, that belongs in a later reconciliation phase (Phase 13f pattern).

### Files NOT to change in Phase 13

- `docs/DATA_QUALITY_MODEL.md` — accurate as-is; no proxy security gaps to document here
- `docs/LOCAL_DAILY_USE.md` — local-only; unaffected
- `src/data.js` — no frontend changes
- Any test files — existing 49 E2E tests are unaffected

---

## 9. Risks and Mitigations

### Risk 1 — CORS misconfiguration locks out the frontend (HIGH impact, LOW probability)

**Scenario:** `CORS_ORIGIN` is set to a typo'd URL. The deployed proxy rejects all browser requests. The deployed frontend falls back to mock data silently — users see mock data without explanation.

**Mitigation:**
- Health endpoint `/api/health` does not require CORS (same-origin is fine for debugging; direct curl access always works)
- The manual validation checklist includes verifying `Access-Control-Allow-Origin` in the response header before announcing live mode
- The frontend mock fallback means the app continues to function; it does not hard-fail

### Risk 2 — Render free tier cold start degrades UX (MEDIUM impact, MEDIUM probability)

**Scenario:** No traffic for 15+ minutes → Render spins down the proxy → first user visits the deployed demo → health check times out → app shows mock data for that page load.

**Mitigation:** Already handled. `DEPLOYMENT.md` documents this. The frontend health-check timeout triggers mock fallback. User sees "Mock Prices" for the first ~30 s, then real data after proxy warms up on next reload.

**What NOT to add:** A complex retry loop in the frontend would make the app appear "stuck loading." The current "fall back immediately, then reload" UX is correct.

### Risk 3 — Finnhub free-tier rate limits on first cold-start load (MEDIUM impact, LOW probability)

**Scenario:** Cold start clears the in-memory cache. Portfolio load with 5 tickers + benchmark triggers ~25 upstream calls (history + quote + profile + news per symbol). At 60 req/min free tier, this can trigger 429s on the first load.

**Mitigation:** Already handled. 429 fallback to Yahoo for history; rate-limit banner in frontend UI. The proxy's TTL cache means subsequent loads within the TTL window (30 min for history) make zero upstream calls. Only cold starts are affected.

### Risk 4 — Yahoo Finance undocumented endpoint breaks (LOW impact, LOW probability but non-zero)

**Scenario:** Yahoo changes `query1.finance.yahoo.com/v8/finance/chart`. History for affected symbols falls to mock GBM. Portfolio shows "Partial Prices".

**Mitigation:** Already accepted and documented in `DATA_QUALITY_MODEL.md` Gap 4. The mock fallback handles this gracefully. No code change needed.

### Risk 5 — CORS `"*"` warning noise in local dev (LOW impact, LOW probability)

**Scenario:** Console warning about `"*"` CORS appears during `npm run api` and confuses developers.

**Mitigation:** Warning should be prefixed `[proxy]` and only printed when `CORS_ORIGIN` is not set. Add a note to `LOCAL_DAILY_USE.md` that this warning is expected and harmless in local development.

---

## 10. Acceptance Criteria

Phase 13 is complete when all of the following are true:

### Code changes
- [ ] `server/market-data-server.mjs`: `Access-Control-Allow-Origin` reads from `process.env.CORS_ORIGIN || "*"`; startup warning logged when `"*"` is in effect
- [ ] `.env.example`: `CORS_ORIGIN=` documented with explanatory comment

### Documentation
- [ ] `docs/DEPLOYMENT.md` Option C section: complete Render walkthrough, CORS env var, validation checklist
- [ ] `docs/PRODUCTIZATION_ROADMAP.md`: Phase 13 entry added

### Behavioral invariants
- [ ] `npm run api` without `CORS_ORIGIN` set: proxy starts, responds with `Access-Control-Allow-Origin: *` — no functional regression
- [ ] `CORS_ORIGIN=https://example.com npm run api`: proxy responds with `Access-Control-Allow-Origin: https://example.com`
- [ ] All 49 existing E2E tests pass unchanged
- [ ] Static Vercel demo still runs in mock/offline mode (no proxy required, no env vars required)
- [ ] Local `npm run dev` + `npm run api` live-data mode continues to work

### Security
- [ ] No Finnhub key appears in any browser-facing response, bundle, or env var list
- [ ] `VITE_FINNHUB_API_KEY` does not exist anywhere in the codebase
- [ ] `.env.example` contains only empty placeholders (no real key values)
- [ ] A deployed proxy with `CORS_ORIGIN` set rejects cross-origin browser requests from other origins

---

---

# Phase 13 — Strict Implementation Prompt

*Use this prompt verbatim when ready to implement Phase 13. It is self-contained and can be handed to a fresh context.*

---

You are working on the Quant Portfolio Analytics Dashboard. Phase 12 is complete and reconciled. Current release candidate: v2.2.0. Build: 314 kB / 94 kB gzip / 34 modules / 0 warnings. E2E: 49/49 passing.

**Now implement Phase 13 — Production Proxy Deployment: CORS Hardening.**

This is a targeted, minimal implementation. Make only the changes listed below. Do not refactor, do not add abstractions beyond what is specified, do not change any financial formulas, do not change the frontend data-fetching logic, do not change localStorage schema, do not add npm dependencies, and do not change any Phase 12 mobile/responsive work.

---

## Required changes — exactly these, nothing more

### Change 1: `server/market-data-server.mjs` — CORS env var

Near the top of the file, after the `import` statements and before `loadLocalSecrets`, add:

```js
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
```

Find the startup log line (the one that prints the listening address) and add a warning immediately before or after it:

```js
if (CORS_ORIGIN === "*") {
  console.warn("[proxy] WARNING: CORS_ORIGIN is not set — accepting requests from any origin. Set CORS_ORIGIN=<your-frontend-url> in production.");
}
```

Then find **every occurrence** of the literal string `"Access-Control-Allow-Origin": "*"` in `server/market-data-server.mjs` and replace it with `"Access-Control-Allow-Origin": CORS_ORIGIN`. Do not change anything else in this file. There should be exactly 2–3 occurrences (one in the CORS preflight OPTIONS handler and one or two in the standard response helper).

### Change 2: `.env.example` — document CORS_ORIGIN

Open `.env.example`. After the existing `MARKET_DATA_PORT` block, add exactly:

```
# CORS_ORIGIN — restrict which browser origin may call the proxy.
# Default: * (accepts any origin — safe for local development, NOT for a public proxy).
# In production, set to your Vercel deployment URL, e.g.:
# CORS_ORIGIN=https://portfolio-analytics-dashboard-three.vercel.app
# CORS_ORIGIN=
```

### Change 3: `docs/DEPLOYMENT.md` — expand Option C

The file currently has an "Option C — Deployed Proxy + Vercel Frontend" section. Expand it with:

1. **CORS_ORIGIN** row added to the "Environment variables to set on the proxy host" table:
   | Variable | Value | Required |
   | `CORS_ORIGIN` | Your Vercel deployment URL, e.g. `https://your-project.vercel.app` | Yes — replace `*` for production |

2. **Render step-by-step** subsection under "Deploy the proxy":
   - Create account at render.com
   - New → Web Service → Connect Git repository
   - Name: `portfolio-analytics-proxy` (or any name)
   - Runtime: Node
   - Build command: *(leave blank)*
   - Start command: `node server/market-data-server.mjs`
   - Instance type: Free
   - Add environment variables: `FINNHUB_API_KEY`, `MARKET_DATA_HOST=0.0.0.0`, `CORS_ORIGIN=https://your-project.vercel.app`
   - Deploy. Copy the service URL (e.g. `https://portfolio-analytics-proxy.onrender.com`).

3. **Validation checklist** subsection before the existing rate-limit notes:
   ```
   After deployment, verify:
   1. GET https://your-proxy.onrender.com/api/health → { ok: true, hasFinnhubKey: true }
   2. Response header: Access-Control-Allow-Origin equals your Vercel URL (not *)
   3. Redeploy Vercel frontend with VITE_API_BASE_URL=https://your-proxy.onrender.com
   4. Open the dashboard → sidebar shows "Proxy ready" and "Real Prices"
   5. Check /api/health → cacheHits increasing on repeated loads (confirms cache is working)
   6. Verify the static demo URL (without VITE_API_BASE_URL) still shows "Mock Prices"
   ```

4. **Cold-start note** (add to the existing "Expected behavior" table row for cold-starting Render):
   The proxy's in-memory cache resets on each cold start. The first portfolio load after a cold start will make upstream Finnhub calls; subsequent loads within the TTL window (30 min for history) are free from cache. A cold start takes approximately 30 seconds on Render's free tier.

### Change 4: `docs/PRODUCTIZATION_ROADMAP.md` — Phase 13 entry

Find the Phase 13 candidate section. Replace it with a completed Phase 13 entry following the same format as Phases 11 and 12.

---

## Invariants — must remain true after all changes

- `npm run api` without `CORS_ORIGIN` set: starts successfully, prints the `[proxy] WARNING` line, proxy works normally with `Access-Control-Allow-Origin: *`
- `CORS_ORIGIN=https://example.com npm run api`: proxy starts, all responses include `Access-Control-Allow-Origin: https://example.com`
- All 49 E2E tests pass unchanged (they run with no proxy; CORS is irrelevant)
- `FINNHUB_API_KEY` does not appear in any browser-facing response, bundle, or public env var
- `VITE_FINNHUB_API_KEY` does not exist anywhere in the codebase
- `.env.example` contains only empty placeholder values
- The static Vercel demo works with zero environment variables configured
- Financial formulas, localStorage schema, chart components, and mobile/responsive work are unchanged

---

## After implementation

Run these verifications:

```bash
# 1. All unit/lint checks pass
npm run test:smoke
npm run test:charts
npm run test:build

# 2. All 49 E2E tests pass
npm run test:e2e

# 3. Proxy starts with default CORS (*)
npm run api
# Expect: [proxy] WARNING: CORS_ORIGIN is not set...
# Then: curl http://127.0.0.1:8787/api/health → { ok: true, ... }
# Then: curl -I http://127.0.0.1:8787/api/health → Access-Control-Allow-Origin: *

# 4. Proxy starts with CORS restricted (PowerShell)
$env:CORS_ORIGIN="https://example.com"; node server/market-data-server.mjs
# Then: curl -I http://127.0.0.1:8787/api/health → Access-Control-Allow-Origin: https://example.com

# 5. .env.example has no real key values (all right-hand sides empty or commented)
```

When all checks pass, update `docs/PRODUCTIZATION_ROADMAP.md` with the Phase 13 completion entry.

---

*End of Phase 13 implementation prompt.*
