# Phase 13b — Live Proxy Host Setup Checklist

**Project:** Quant Portfolio Analytics Dashboard  
**Date:** 2026-06-10  
**Purpose:** Operational step-by-step guide for connecting the existing Vercel static frontend to a Render-hosted Node.js proxy, while preserving the mock/offline fallback path.

**Known URLs:**
- Frontend (Vercel, already live): `https://portfolio-analytics-dashboard-three.vercel.app`
- Proxy (Render, to be created): `https://<your-service-name>.onrender.com` (determined in Step 1)

---

## Order Dependency Note

There is a one-time sequencing constraint:

1. **Create Render service first** → you get the Render URL
2. **Set env vars on Render** (including `CORS_ORIGIN` = Vercel URL, which is already known)
3. **Set `VITE_API_BASE_URL` in Vercel** = Render URL (now known from step 1)
4. **Redeploy Vercel frontend** to bake in the new build-time variable

Do not attempt to set `VITE_API_BASE_URL` before the Render URL is known.

---

## Section 1 — Render Setup Checklist

### 1.1 Create the service

- [ ] Go to [render.com](https://render.com) and sign in (or create a free account).
- [ ] Click **New → Web Service**.
- [ ] Under **Source Code**, select **Connect a repository**.
- [ ] Authorize Render to access GitHub if prompted.
- [ ] Select repository: `Tuluntas09/portfolio-analytics-dashboard`.
- [ ] **Root Directory:** leave blank. The start command addresses the subdirectory explicitly.
- [ ] **Branch:** `main`.

### 1.2 Configure the service

| Field | Value | Notes |
|---|---|---|
| **Name** | `portfolio-analytics-proxy` | Any name; determines the Render URL |
| **Region** | Oregon (US West) or Frankfurt | Choose closest to Vercel's edge |
| **Runtime** | Node | Not Docker |
| **Build Command** | *(leave blank)* | No build step needed |
| **Start Command** | `node server/market-data-server.mjs` | Exact command — do not use `npm run api` here |
| **Instance Type** | Free | Sufficient for personal use |

### 1.3 Node version

Render defaults to Node 20. The proxy requires Node 18+ (uses native `fetch` and `AbortSignal.timeout()`). Node 20 is confirmed compatible. If Render shows a Node version selector, choose **20** or higher.

> **Do not set Node to 16 or earlier.** Native fetch is not available below Node 18 and the proxy will crash on startup.

### 1.4 Environment variables

Under **Environment → Environment Variables**, add exactly these:

| Key | Value | Notes |
|---|---|---|
| `FINNHUB_API_KEY` | Your Finnhub API key | Get a free key at finnhub.io — keep this secret |
| `MARKET_DATA_HOST` | `0.0.0.0` | Required — allows Render to route external traffic |
| `CORS_ORIGIN` | `https://portfolio-analytics-dashboard-three.vercel.app` | Exact URL, no trailing slash |

> **Do not add `PORT` manually.** Render injects it automatically. The proxy reads `process.env.PORT` already.
>
> **Do not add `NODE_ENV=production` unless you want the startup warning.** The proxy will warn if `NODE_ENV=production` and `CORS_ORIGIN` is set — that warning is informational and the service will still work. The warning only fires when `CORS_ORIGIN` is missing.

### 1.5 Health check (optional but recommended)

In Render's **Health & Alerts** section:

| Field | Value |
|---|---|
| **Health Check Path** | `/api/health` |
| **Health Check Timeout** | 30 s |

This allows Render to detect crashes and restart automatically.

### 1.6 Deploy and get the URL

- [ ] Click **Create Web Service**.
- [ ] Wait for the first deploy to complete (watch the **Logs** tab — should take 1–3 minutes on first deploy).
- [ ] Confirm the log output contains: `Market data proxy listening on http://0.0.0.0:<PORT>`
- [ ] Copy your Render URL from the top of the service page: `https://<your-service-name>.onrender.com`

### 1.7 First deploy verification

Run this from your terminal (replace the URL):

```bash
curl https://<your-service-name>.onrender.com/api/health
```

Expected response:
```json
{
  "ok": true,
  "service": "market-data-proxy",
  "hasFinnhubKey": true,
  "providers": { ... },
  "timestamp": "...",
  "cache": { "cacheEntries": 0, ... }
}
```

- `ok: true` → proxy is running
- `hasFinnhubKey: true` → key was read successfully

If `hasFinnhubKey: false`, the `FINNHUB_API_KEY` env var was not set or not read. Go to Render → Environment and verify the key is present (it will show as `***` — click the eye icon to confirm it is non-empty).

---

## Section 2 — Proxy Validation Checklist

Replace `<RENDER_URL>` with your actual Render service URL throughout.

### 2.1 Health endpoint

```bash
curl -s https://<RENDER_URL>/api/health | python -m json.tool
```

Expected: `"ok": true`, `"hasFinnhubKey": true`.

### 2.2 CORS header — allowed origin

```bash
curl -s -I \
  -H "Origin: https://portfolio-analytics-dashboard-three.vercel.app" \
  https://<RENDER_URL>/api/health
```

Expected header:
```
Access-Control-Allow-Origin: https://portfolio-analytics-dashboard-three.vercel.app
```

If you see `Access-Control-Allow-Origin: http://localhost:5173`, `CORS_ORIGIN` is not set or the service has not restarted after setting it. Go to Render → Environment → verify the variable → trigger a manual redeploy.

### 2.3 CORS header — disallowed origin

```bash
curl -s -I \
  -H "Origin: https://evil.example.com" \
  https://<RENDER_URL>/api/health
```

Expected header (fallback to localhost, NOT the disallowed origin, NOT `*`):
```
Access-Control-Allow-Origin: http://localhost:5173
```

A browser making a cross-origin request from `evil.example.com` would receive a CORS error — this is the intended behavior.

### 2.4 Market data endpoint — real quote

```bash
curl -s "https://<RENDER_URL>/api/market/quote?symbol=AAPL" | python -m json.tool
```

Expected: `"ok": true`, `"data"` object contains `"c"` (current price), `"cacheStatus": "miss"`.

If `"ok": false` with `"FINNHUB_API_KEY is not configured"`: key is missing — verify env var.

### 2.5 Market data endpoint — price history

```bash
curl -s "https://<RENDER_URL>/api/market/history?symbol=AAPL" | python -m json.tool
```

Expected: `"ok": true`, `"candles"` array with multiple entries, `"provider": "finnhub"` or `"provider": "yahoo"` if Finnhub returned no data.

### 2.6 Cache behavior

Run the same history request twice within 30 minutes:

```bash
# First call
curl -s "https://<RENDER_URL>/api/market/history?symbol=AAPL" | grep cacheStatus
# Expected: "cacheStatus": "miss"

# Second call (immediate)
curl -s "https://<RENDER_URL>/api/market/history?symbol=AAPL" | grep cacheStatus
# Expected: "cacheStatus": "hit"
```

`"hit"` on the second call confirms the in-memory TTL cache is working. This is critical for staying within Finnhub's 60 req/min free-tier limit.

### 2.7 Symbol validation — invalid symbol

```bash
curl -s "https://<RENDER_URL>/api/market/quote?symbol=!!INVALID"
```

Expected: HTTP 400, `{"ok":false,"error":"Valid symbol query parameter is required"}`. The proxy does not forward invalid symbols to Finnhub.

### 2.8 429 / rate-limit behavior note

If Finnhub returns 429 during validation:
- `/api/market/history` routes fall through to Yahoo Finance automatically (`"provider": "yahoo"`, `"fallbackUsed": true`)
- `/api/market/quote` and `/api/company/profile` return `{"ok":false,"error":"rate_limited","retryAfter":60}`
- 429 responses are never cached — the next request will retry Finnhub

This is expected behavior. Wait 60 seconds and retry.

### 2.9 No secret leakage

Confirm the Finnhub API key does not appear in any response:

```bash
curl -s "https://<RENDER_URL>/api/health" | grep -i "finnhub_api_key\|api_key\|token"
```

Expected: no matches. The health endpoint exposes only `"hasFinnhubKey": true/false` — never the key value.

```bash
curl -s "https://<RENDER_URL>/api/market/quote?symbol=AAPL" | grep -i "token\|api_key"
```

Expected: no matches.

---

## Section 3 — Vercel Setup Checklist

### 3.1 Add VITE_API_BASE_URL

1. Go to [vercel.com](https://vercel.com) → your project (`portfolio-analytics-dashboard`).
2. Navigate to **Settings → Environment Variables**.
3. Click **Add New**.
4. Set:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://<your-service-name>.onrender.com` (no trailing slash)
   - **Environments:** Production (and Preview if you want live data on PR previews)
5. Click **Save**.

> `VITE_API_BASE_URL` is **not a secret**. It is a public URL baked into the browser bundle. It is safe to set as a plain environment variable. Do **not** mark it as sensitive/encrypted.

### 3.2 Trigger a redeploy

`VITE_API_BASE_URL` is a Vite build-time variable. It is baked into `dist/assets/index-*.js` at build time. **Simply saving the variable does not update the live site — you must redeploy.**

In Vercel → Deployments → click **Redeploy** on the latest deployment (or push a new commit to trigger CI).

Wait for the deployment to complete (usually 1–2 minutes).

### 3.3 Verify the built frontend is using the proxy

After redeployment:

1. Open the browser DevTools → **Network** tab.
2. Navigate to `https://portfolio-analytics-dashboard-three.vercel.app`.
3. Filter by `api/` — you should see requests to `https://<your-service-name>.onrender.com/api/health`, `/api/market/history`, etc.

Alternatively, check the built JS bundle contains the Render URL:

```bash
# Download and inspect the bundle (replace the hash)
curl -s https://portfolio-analytics-dashboard-three.vercel.app/assets/index-*.js | grep -o 'onrender.com[^"]*'
```

If the Render URL appears, the bundle was rebuilt with `VITE_API_BASE_URL` correctly embedded.

### 3.4 How to remove VITE_API_BASE_URL (return to mock/offline mode)

1. Vercel → Settings → Environment Variables → find `VITE_API_BASE_URL` → delete it.
2. Trigger a redeploy.
3. After redeployment, the frontend defaults to `http://127.0.0.1:8787` (unreachable from Vercel) and falls back to mock data automatically.

See Section 5 (Rollback Plan) for the full procedure.

---

## Section 4 — End-to-End Demo Verification Checklist

After both Render and Vercel are configured and redeployed:

### 4.1 Dashboard loads

- [ ] Navigate to `https://portfolio-analytics-dashboard-three.vercel.app`
- [ ] App loads without white screen or JS console errors
- [ ] Sidebar, topbar, and tab navigation all visible

### 4.2 Data Quality panel — real data indicator

- [ ] Open **Data tab** (last tab, index 6)
- [ ] Proxy status card shows **"Proxy ready"** (green)
- [ ] Quote loaded count shows N/N (e.g., "5/5")
- [ ] History loaded count shows N/N

- [ ] Switch to **Overview tab**
- [ ] Sidebar badge shows **"Real Prices"** (green) or **"Partial Prices"** (yellow if some tickers rate-limited)
- [ ] Holdings table "Source" column shows Finnhub or Yahoo labels (not "Deterministic Mock")

### 4.3 Fallback still works

To verify the fallback without breaking the live deployment:

Option A (browser DevTools): In Network tab, block requests to `<your-proxy>.onrender.com` → reload → sidebar should show **"Mock Prices"**, all tabs remain functional.

Option B (test with the un-configured demo URL): If you have a second Vercel deployment without `VITE_API_BASE_URL`, load that URL and confirm it shows **"Mock Prices"** and is fully functional.

### 4.4 Company data / news behavior

- [ ] Navigate to **Company Data tab** (index 5)
- [ ] Select a ticker in the dropdown (e.g., AAPL)
- [ ] Company profile card shows: name, exchange, industry, market cap
- [ ] News section loads recent headlines
- [ ] News footer shows: "News is provided for company context only — not as a market signal or recommendation."
- [ ] No advisory language (no buy/sell/hold signals, no target prices)
- [ ] News headlines open in new tab (`rel="noopener noreferrer"` applied)

### 4.5 Mobile layout still works

- [ ] Open Chrome DevTools → toggle device toolbar → select iPhone 12 Pro (390×844) or similar
- [ ] Hamburger button (☰) visible in top-left
- [ ] Sidebar hidden by default
- [ ] Hamburger click opens sidebar drawer
- [ ] Backdrop click closes sidebar drawer
- [ ] All 7 tabs navigable via horizontal scroll
- [ ] No full-page horizontal overflow

### 4.6 Print report still works

- [ ] Click **Print Report** button in the topbar
- [ ] Browser print dialog opens
- [ ] Print preview shows: report title, generated date, holdings count, date range, benchmark, data source label, non-advisory disclaimer
- [ ] Print preview does not show sidebar, topbar, or tab nav
- [ ] Cancel or print as PDF; confirm no secrets visible in the output

---

## Section 5 — Rollback Plan

**When to roll back:** See Section 8 (Go/No-Go Criteria). If live data is causing user-visible issues or the proxy is degrading performance, roll back to mock/offline in under 5 minutes.

### 5.1 Immediate rollback (< 5 minutes)

1. Go to Vercel → Settings → Environment Variables.
2. Delete `VITE_API_BASE_URL` (or set it to an empty string).
3. Go to Vercel → Deployments → click **Redeploy** on the latest deployment.
4. Wait ~1–2 minutes for the deployment to complete.
5. Reload the dashboard — sidebar should show **"Mock Prices"**.

The Render proxy does not need to be stopped. With `VITE_API_BASE_URL` absent, the frontend falls back to `http://127.0.0.1:8787`, which is unreachable from Vercel, and the health check silently fails → mock mode.

### 5.2 Disable the Render proxy (optional)

If you want to also suspend the proxy to avoid unnecessary Render usage:

1. Render → your service → **Settings → Suspend Service**.
2. This stops the service and deallocates the instance. No data is lost; all env vars are preserved.
3. To re-enable: Render → **Resume Service** → wait for first deploy.

### 5.3 Confirm rollback succeeded

After Vercel redeployment completes:

- [ ] Open `https://portfolio-analytics-dashboard-three.vercel.app`
- [ ] Sidebar shows **"Mock Prices"** (grey badge)
- [ ] Data tab shows **"Proxy offline"** state
- [ ] All tabs remain fully functional on synthetic data
- [ ] No network requests to `onrender.com` appear in DevTools

---

## Section 6 — Common Failure Modes

### 6.1 CORS mismatch

**Symptom:** Sidebar shows "Mock Prices" after Vercel redeploy despite proxy being reachable; browser console shows `Access to fetch ... has been blocked by CORS policy`.

**Cause:** `CORS_ORIGIN` on Render does not exactly match the `Origin` header sent by the browser.

**Check:** Browser DevTools → Network → any `api/health` request → Response Headers → `Access-Control-Allow-Origin`. Compare it to `https://portfolio-analytics-dashboard-three.vercel.app` character for character.

**Fix:** Render → Environment Variables → correct `CORS_ORIGIN` (no trailing slash, exact scheme+host) → manual redeploy.

---

### 6.2 Render sleeping / cold start

**Symptom:** First page load shows "Mock Prices"; reload 30 seconds later shows "Real Prices". No error in console.

**Cause:** Render free tier spins down the service after ~15 minutes of inactivity. The first request triggers a cold start (~30 s). The health check times out → frontend falls back to mock → proxy finishes starting → next reload works.

**This is expected and handled.** The frontend's mock fallback is the correct behavior during cold start. No fix required.

**Mitigation (optional):** Use an external uptime monitor (e.g., UptimeRobot free tier) to ping `https://<proxy>.onrender.com/api/health` every 10 minutes to keep the service warm.

---

### 6.3 Wrong start command

**Symptom:** Render deploy succeeds but requests to `/api/health` return 404 or connection refused.

**Cause:** Start command is wrong (e.g., `npm run dev` starts Vite, not the proxy; `npm start` does not exist).

**Fix:** Render → Settings → **Start Command** → set to exactly `node server/market-data-server.mjs` → manual redeploy.

---

### 6.4 Missing FINNHUB_API_KEY

**Symptom:** `GET /api/health` returns `"hasFinnhubKey": false`. Market data endpoints return `{"ok":false,"error":"FINNHUB_API_KEY is not configured"}`.

**Fix:** Render → Environment Variables → add `FINNHUB_API_KEY` with your key value → manual redeploy. Do NOT add this key to Vercel.

---

### 6.5 VITE_API_BASE_URL missing protocol

**Symptom:** Frontend makes no API requests, or requests go to `undefinedyour-proxy.onrender.com`.

**Cause:** `VITE_API_BASE_URL` was set to `your-proxy.onrender.com` (missing `https://`).

**Fix:** Vercel → Environment Variables → correct the value to `https://your-proxy.onrender.com` → redeploy Vercel.

---

### 6.6 CORS_ORIGIN trailing slash mismatch

**Symptom:** CORS error in browser. `Access-Control-Allow-Origin: https://portfolio-analytics-dashboard-three.vercel.app/` (note trailing slash) does not match `Origin: https://portfolio-analytics-dashboard-three.vercel.app` (no trailing slash).

**Cause:** `CORS_ORIGIN` was set with a trailing slash: `https://portfolio-analytics-dashboard-three.vercel.app/`.

**Fix:** Render → Environment Variables → correct `CORS_ORIGIN` to `https://portfolio-analytics-dashboard-three.vercel.app` (no trailing slash) → manual redeploy.

---

### 6.7 Finnhub 429 rate limit

**Symptom:** On first cold-start load, some symbols show "Yahoo Fallback" (yellow pill) instead of "Finnhub" (green pill). Rate-limit banner may appear briefly.

**Cause:** A portfolio load with 5 tickers + benchmark triggers ~25 upstream calls. If these arrive faster than 60 req/min, some calls hit the Finnhub rate limit.

**This is expected and handled.** History routes fall through to Yahoo Finance automatically. The proxy TTL cache (30 min for history, 60 s for quotes) means subsequent reloads within the TTL window make zero upstream calls — rate limits only affect the first cold-start load.

**No fix required.** Wait 60 seconds; next reload uses cache.

---

### 6.8 Yahoo Finance fallback behavior

**Symptom:** Some symbols show `"provider": "yahoo"` and `"fallbackUsed": true`. The Data tab shows a "Yahoo Fallback" warning pill.

**Cause:** Finnhub returned no data for that symbol (possible for some ETFs or international tickers) or was rate-limited. Yahoo Finance `v8/finance/chart` was used instead.

**This is expected behavior.** Yahoo data is normalized to the same schema as Finnhub data. Analytics are unaffected. `DATA_QUALITY_MODEL.md` Gap 4 documents that the Yahoo endpoint is unofficial.

---

### 6.9 Vercel environment variable not applied until redeploy

**Symptom:** `VITE_API_BASE_URL` is set in Vercel but the frontend still hits the old URL (or 127.0.0.1).

**Cause:** Vite bakes environment variables into the JS bundle at **build time**. Saving the variable in Vercel does not retroactively update the existing bundle.

**Fix:** After saving the variable, always trigger a new Vercel deployment. Check the deployment timestamp — the new deployment must be **after** you saved the env var.

---

## Section 7 — Security Checklist

Before going live, verify all of the following:

| Check | How to verify | Expected |
|---|---|---|
| `FINNHUB_API_KEY` only on Render | Vercel → Settings → Env Vars → search for `FINNHUB` | Not found |
| `VITE_FINNHUB_API_KEY` never created | Vercel → Settings → Env Vars → search | Not found |
| `FINNHUB_API_KEY` not in Render logs | Render → Logs → search for `FINNHUB_API_KEY` | Not found (startup log should never print it) |
| Key not in browser bundle | `curl https://portfolio-analytics-dashboard-three.vercel.app/assets/index-*.js \| grep -c FINNHUB` | `0` |
| CORS not wildcard | `curl -sI -H "Origin: https://evil.example.com" https://<proxy>/api/health \| grep Access-Control-Allow-Origin` | `http://localhost:5173` (not `*`) |
| CORS_ORIGIN exact match | `curl -sI -H "Origin: https://portfolio-analytics-dashboard-three.vercel.app" https://<proxy>/api/health \| grep Access-Control-Allow-Origin` | Exact Vercel URL |
| No secrets in API response | `curl -s https://<proxy>/api/market/quote?symbol=AAPL \| grep -i token` | Empty |
| `.env.local` gitignored | `git status` in project root | `.env.local` not listed |
| `.env.local` not committed | `git log --all --full-history -- .env.local` | No commits found |
| `hasFinnhubKey` is boolean | `curl -s https://<proxy>/api/health \| grep hasFinnhubKey` | `true` or `false`, not the key value |

---

## Section 8 — Go / No-Go Decision Criteria

### Go (keep live proxy enabled) when:

- [ ] `GET /api/health` returns `ok: true` and `hasFinnhubKey: true`
- [ ] CORS header returns the exact Vercel URL (not `*`, not a localhost address)
- [ ] Dashboard sidebar shows **"Real Prices"** or **"Partial Prices"** (not "Mock Prices")
- [ ] At least one ticker's "Source" column shows Finnhub or Yahoo (not all Mock)
- [ ] Company Data tab loads a profile card and at least one news headline for a known ticker (AAPL, NVDA)
- [ ] No uncaught JavaScript errors in browser DevTools console
- [ ] All 7 tabs navigate and render without crashing
- [ ] Mock fallback is confirmed working (test with proxy blocked or second deployment without `VITE_API_BASE_URL`)
- [ ] Print report produces readable output with non-advisory disclaimer
- [ ] Mobile layout works (hamburger visible at 390 px, sidebar drawer opens/closes)
- [ ] No secrets visible in any API response or browser bundle

### No-go (roll back to mock/offline) when:

- [ ] Proxy is returning 5xx errors consistently (not just cold start)
- [ ] CORS header returns `*` (wildcard — means `resolveCorsOrigin` has a bug)
- [ ] Any API key or token appears in an API response body
- [ ] Dashboard crashes (white screen, uncaught JS error) when proxy is reachable
- [ ] All tickers show "Mock Prices" despite proxy health check passing (misconfiguration, investigate before going live)
- [ ] Render proxy is serving data from a previous session's stale cache incorrectly (unlikely — errors are never cached)
- [ ] Finnhub rate limits are consistently exhausted within normal usage (upgrade key tier or reduce portfolio size)

### Partial go (live data with known gaps) acceptable when:

- [ ] Some tickers show "Yahoo Fallback" — acceptable, documented behavior
- [ ] Cold-start delay causes first-load mock mode — acceptable, recovers on reload
- [ ] Company news unavailable for some symbols — acceptable, non-advisory fallback state shown

---

## Section 9 — Final Recommended Order of Operations

Follow this exact sequence from Render creation to final Vercel verification.

```
Step 1 — Create Render service
  ├── New → Web Service → connect GitHub repo
  ├── Start command: node server/market-data-server.mjs
  ├── Instance type: Free
  └── Do NOT add env vars yet (you need the Render URL first)

Step 2 — Copy the Render URL
  └── From Render service page: https://<name>.onrender.com
      Save this — you need it for Vercel and for Render env vars

Step 3 — Add env vars to Render
  ├── FINNHUB_API_KEY = your key
  ├── MARKET_DATA_HOST = 0.0.0.0
  └── CORS_ORIGIN = https://portfolio-analytics-dashboard-three.vercel.app
      (Note: no trailing slash)

Step 4 — Trigger Render manual deploy
  ├── Render → Deployments → Manual Deploy → Deploy latest commit
  └── Wait for: "Market data proxy listening on http://0.0.0.0:<PORT>"

Step 5 — Validate proxy (Section 2 checklist)
  ├── curl /api/health → ok:true, hasFinnhubKey:true
  ├── CORS header with Vercel Origin → exact Vercel URL
  ├── CORS header with unknown Origin → http://localhost:5173
  ├── /api/market/quote?symbol=AAPL → ok:true with price data
  └── Second history request → cacheStatus:hit

  ⛔ If any proxy check fails, fix it before proceeding to Step 6.

Step 6 — Add VITE_API_BASE_URL to Vercel
  ├── Vercel → Settings → Environment Variables
  ├── Key: VITE_API_BASE_URL
  ├── Value: https://<name>.onrender.com  (exact URL, no trailing slash)
  └── Environment: Production (and Preview if desired)

Step 7 — Redeploy Vercel frontend
  ├── Vercel → Deployments → Redeploy latest
  └── Wait for deployment to complete (~1–2 min)

Step 8 — End-to-end verification (Section 4 checklist)
  ├── Dashboard loads without errors
  ├── Sidebar shows Real Prices or Partial Prices
  ├── Data tab shows Proxy ready + Finnhub/Yahoo providers
  ├── Company Data tab loads profile and news
  ├── Mobile layout works (hamburger, drawer, scroll)
  └── Print report works with disclaimer

Step 9 — Security verification (Section 7 checklist)
  ├── FINNHUB_API_KEY not in Vercel env vars
  ├── FINNHUB_API_KEY not in browser bundle
  ├── CORS not wildcard
  └── No key in any API response

Step 10 — Go/No-Go decision (Section 8)
  ├── All Go criteria met → live proxy is active ✓
  └── Any No-Go criteria → execute rollback (Section 5)
```

---

## Appendix: Quick Reference Commands

```bash
# Health check
curl -s https://<RENDER_URL>/api/health | python -m json.tool

# CORS — allowed origin
curl -sI -H "Origin: https://portfolio-analytics-dashboard-three.vercel.app" \
     https://<RENDER_URL>/api/health | grep Access-Control-Allow-Origin

# CORS — disallowed origin (should return localhost, not *)
curl -sI -H "Origin: https://evil.example.com" \
     https://<RENDER_URL>/api/health | grep Access-Control-Allow-Origin

# Real quote
curl -s "https://<RENDER_URL>/api/market/quote?symbol=AAPL" | python -m json.tool

# History (first call → miss; second call → hit)
curl -s "https://<RENDER_URL>/api/market/history?symbol=AAPL" | grep -E '"cacheStatus"|"provider"'

# No secrets in response
curl -s "https://<RENDER_URL>/api/health" | grep -i "finnhub_api_key\|token"
# Expected: no output

# Verify Render URL baked into Vercel bundle
curl -s https://portfolio-analytics-dashboard-three.vercel.app | \
  grep -o 'src="/assets/index[^"]*"' | \
  while read f; do
    FILE=$(echo $f | sed 's/src="\(.*\)"/\1/');
    curl -s "https://portfolio-analytics-dashboard-three.vercel.app$FILE" | \
      grep -o 'onrender\.com[^"]*' | head -1;
  done
```

---

## Appendix: Recommended File Edit (Minor)

One small improvement to `docs/DEPLOYMENT.md` would be worth making before deployment: the Render step-by-step in Phase 13a's checklist says "Do not add PORT manually" but does not explain that Render injects it automatically. This is already stated in this checklist document (Section 1.4). The `docs/DEPLOYMENT.md` Option C section already contains equivalent guidance.

**No file edits are required before deployment.** All necessary documentation is in place:
- `docs/DEPLOYMENT.md` — Option C full walkthrough
- `.env.example` — all variables documented
- `server/market-data-server.mjs` — `resolveCorsOrigin` function with inline comments
- This checklist (`docs/PHASE_13B_DEPLOYMENT_CHECKLIST.md`) — operational procedure

Proceed to Render when ready.
