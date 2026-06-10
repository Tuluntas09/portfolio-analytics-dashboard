# Deployment Guide

**Quant Portfolio Analytics Dashboard**

**Public demo:** https://portfolio-analytics-dashboard-three.vercel.app/  
Deployment mode: Vercel static frontend (Option A). Live data requires a separate/local proxy — see Options B and C below.

---

## Overview

The project has two independently deployable pieces:

| Piece | What it is | Where it runs |
|---|---|---|
| **Frontend** | Vite React SPA — `dist/` | Any static host (Vercel, Netlify, GitHub Pages) |
| **Proxy** | Node.js HTTP server — `server/` | Local machine or separate backend host |

The frontend runs fully in mock/offline mode when the proxy is unavailable. Live market data (Finnhub quotes, Yahoo Finance history, company news) requires the proxy to be running and reachable by the browser.

**`FINNHUB_API_KEY` must stay on the proxy host only.** It is read exclusively by `server/market-data-server.mjs` and is never included in the Vite bundle or sent to the browser.

| Mode | Frontend | Proxy | API key | Live data |
|---|---|---|---|---|
| **A — Vercel static demo** | [Vercel (live)](https://portfolio-analytics-dashboard-three.vercel.app/) | Not deployed | Not required | No — mock/offline |
| **B — Local live-data** | `npm run dev` | `npm run api` | `.env.local` (local only) | Yes |
| **C — Deployed proxy** | Vercel + `VITE_API_BASE_URL` | Render / Railway / Fly.io | Proxy host only | Yes |

---

## Option A — Vercel Static Portfolio Demo *(public demo — mock/offline data)*

Deploy the Vite frontend to Vercel as a static site. The dashboard loads and all tabs are navigable via deterministic mock data. No API key is required.

**Best for:** recruiter review, GitHub portfolio presentation, offline demonstration.

**Live data:** not available in this mode — the proxy is not deployed. All analytics run on deterministic synthetic data. To see real Finnhub market data, run the proxy locally (Option B) or deploy it separately (Option C).

### Public demo

**https://portfolio-analytics-dashboard-three.vercel.app/**

The live demo is already deployed. You can also deploy your own copy:

```bash
# 1. Push the repository to GitHub (already done)
# 2. Go to https://vercel.com → New Project → Import Git Repository
# 3. Select: Tuluntas09/portfolio-analytics-dashboard
```

Vercel will detect the `vercel.json` configuration automatically:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

No environment variables are needed for the static demo. Do not add `FINNHUB_API_KEY` as a Vercel environment variable — it serves no purpose for static hosting and must never be sent to the browser.

**What users see in demo mode:**
- Full dashboard layout with sidebar, KPI strip, all 7 tabs
- All analytics computed from deterministic mock market data
- Data source label shows `Mock Prices`
- Company Data tab and news section show "proxy unavailable" state
- No real prices or company profile data

### Manual deploy via Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

---

## Option B — Full Local Live-Data Mode *(development — real Finnhub data)*

Run both the frontend and the proxy locally. The proxy fetches real market data from Finnhub and Yahoo Finance.

### Prerequisites

- Node.js 18+ installed
- A free Finnhub API key from [finnhub.io](https://finnhub.io)

### Setup

```bash
# 1. Clone
git clone https://github.com/Tuluntas09/portfolio-analytics-dashboard.git
cd portfolio-analytics-dashboard

# 2. Install dependencies
npm install

# 3. Configure API key
cp .env.example .env.local
# Edit .env.local:
#   FINNHUB_API_KEY=your_key_here

# 4. Start the market-data proxy (terminal 1)
npm run api

# 5. Start the Vite dev server (terminal 2)
npm run dev
```

| Service | URL |
|---|---|
| Dashboard | http://127.0.0.1:8502 |
| Proxy health | http://127.0.0.1:8787/api/health |

**Mock/offline mode** — skip steps 3 and 4. The dashboard falls back to mock data automatically when the proxy is unreachable.

### Proxy endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Proxy status and cache statistics |
| `GET /api/market/history?symbol=AAPL` | Normalized daily close series (Finnhub → Yahoo fallback) |
| `GET /api/market/quote?symbol=AAPL` | Real-time last price |
| `GET /api/company/profile?symbol=AAPL` | Company metadata |
| `GET /api/company/news?symbol=AAPL` | Recent news headlines |

### API key security

The proxy reads `FINNHUB_API_KEY` from:
1. `process.env.FINNHUB_API_KEY` (environment variable)
2. `.env.local` file (local secrets — not committed)
3. `.env` file (fallback)

Vite **never reads** this variable. It is not prefixed with `VITE_` and is not included in the browser bundle.

---

## Option C — Deployed Proxy + Vercel Frontend *(public live-data mode)*

Deploy the Node.js proxy to a separate backend host and configure the Vercel frontend to reach it. This enables live market data on the public demo without exposing the API key to the browser.

### Architecture

```
Browser
  └── Vercel (static frontend — dist/)
        └── HTTP requests → Render / Railway / Fly.io (Node.js proxy)
                                └── Finnhub API  (FINNHUB_API_KEY — proxy host only)
                                └── Yahoo Finance (fallback — no key needed)
```

### Why not Vercel Serverless Functions?

Moving the proxy into a Vercel Serverless Function (`/api/*.js`) is tempting because it eliminates the separate backend host. However, it is **not suitable** for this proxy:

- The proxy's in-memory TTL cache (`server/cache.mjs`) does not survive across serverless function invocations. Each invocation starts with an empty cache.
- Without caching, a 5-ticker portfolio load triggers ~25 upstream Finnhub calls per page load. The Finnhub free tier allows 60 requests/minute — a single load consumes nearly half the per-minute budget.
- The in-flight deduplication (prevents concurrent identical requests from each making a separate upstream call) also requires process-local state that serverless cannot provide.

**Use a persistent Node.js service (Option C below) to keep the in-memory cache working.**

---

### Step 1 — Deploy the proxy

Deploy `server/market-data-server.mjs` as a **persistent Node.js web service**.

**Recommended platforms:**

| Platform | Free tier | Cold start | Notes |
|---|---|---|---|
| [Render](https://render.com) | Yes (spins down after ~15 min idle) | ~30 s | Easiest setup; `PORT` auto-injected |
| [Railway](https://railway.app) | Yes (usage-based credits) | None | Always-on; slightly more setup |
| [Fly.io](https://fly.io) | Yes (3 shared VMs) | None | Docker-based; most control |

#### Render step-by-step

1. Go to [render.com](https://render.com) and create a free account.
2. Click **New → Web Service**.
3. Connect your GitHub repository (`Tuluntas09/portfolio-analytics-dashboard`).
4. Configure the service:
   - **Name:** `portfolio-analytics-proxy` (or any name)
   - **Runtime:** Node
   - **Build command:** *(leave blank — no build step)*
   - **Start command:** `node server/market-data-server.mjs`
   - **Instance type:** Free
5. Under **Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `FINNHUB_API_KEY` | Your Finnhub API key | Required for live data — stays on proxy host only |
| `MARKET_DATA_HOST` | `0.0.0.0` | Required — allows Render to route external traffic |
| `CORS_ORIGIN` | `https://your-project.vercel.app` | Required — your Vercel frontend URL |

> `PORT` is injected automatically by Render. The proxy reads `PORT` before falling back to `8787`.

6. Click **Create Web Service**. Render will deploy and give you a URL like `https://portfolio-analytics-proxy.onrender.com`.

#### Environment variables reference

| Variable | Where to set | Value | Required |
|---|---|---|---|
| `FINNHUB_API_KEY` | Proxy host env | Your Finnhub key | Yes |
| `MARKET_DATA_HOST` | Proxy host env | `0.0.0.0` | Yes (for external connections) |
| `CORS_ORIGIN` | Proxy host env | Your Vercel URL (e.g. `https://your-project.vercel.app`) | Yes (for deployed frontend) |
| `PORT` or `MARKET_DATA_PORT` | Set by platform automatically | — | Platform-dependent |

> **`CORS_ORIGIN` is not a secret.** It is your frontend's public URL. Do **not** add `FINNHUB_API_KEY` to Vercel. Do **not** add `VITE_FINNHUB_API_KEY` anywhere — the Finnhub key must never reach the browser.

---

### Step 2 — Configure the Vercel frontend

On your Vercel project, go to **Settings → Environment Variables** and add:

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://your-proxy.onrender.com` | Not a secret; baked into the bundle at build time |

After adding the variable, **redeploy the Vercel frontend** so it picks up the new build-time value. Without redeployment, the bundle still points to `http://127.0.0.1:8787`.

> If `VITE_API_BASE_URL` is absent, the static Vercel demo continues to run in mock/offline mode — unchanged from Option A. This is intentional and ensures the demo is always functional even when the proxy is unavailable.

---

### Step 3 — Validate the deployment

Run through this checklist after deployment and before announcing live-data mode:

- [ ] `GET https://your-proxy.onrender.com/api/health` returns `{ ok: true, hasFinnhubKey: true }`
- [ ] Response header `Access-Control-Allow-Origin` equals your Vercel URL (not `*`)
- [ ] Vercel frontend redeployed with `VITE_API_BASE_URL` set
- [ ] Open the dashboard → sidebar shows **Proxy ready** and **Real Prices**
- [ ] Navigate to the Data tab → verify "Symbol data sources" shows Finnhub or Yahoo providers (not Mock)
- [ ] Check `/api/health` again → `cacheHits` increasing on repeated loads confirms cache is working
- [ ] Open the original static demo URL (the one **without** `VITE_API_BASE_URL` configured) → sidebar still shows **Mock Prices** — confirms the fallback is intact

---

### Expected behavior after deployment

| Scenario | What the frontend does |
|---|---|
| Proxy reachable, valid key | Fetches real Finnhub quotes, history, and news. Badge shows **Real Prices**. |
| Proxy reachable, key missing | Proxy returns 503. Frontend falls back to mock data. Badge shows **Mock Prices**. |
| Proxy cold-starting (Render free tier) | Health check times out. Frontend falls back to mock data. Once proxy warms up (~30 s), a page reload shows live data. In-memory cache resets on each cold start. |
| Proxy unreachable | Health check fails. Frontend runs on deterministic mock data. All tabs remain functional. |
| Finnhub 429 rate limit | Yahoo Finance fallback used for history. Rate-limit banner shown in the frontend. |
| `CORS_ORIGIN` misconfigured | Browser receives a CORS error. Frontend falls back to mock data. Fix: correct `CORS_ORIGIN` on proxy host and restart service. |

---

### Risk notes

**Finnhub free-tier rate limits:** The free tier allows 60 requests/minute. A portfolio load with 5 tickers triggers up to 25 upstream calls (history + quote + profile + news per ticker). The proxy TTL cache (30 min for history, 60 s for quotes) means repeated reloads within the TTL window make zero upstream calls. Only the first load after a cold start is affected.

**Cold starts on Render free tier:** If no requests arrive for ~15 minutes, Render spins down the service. The next request wakes it up, but the first health check may time out (~30 s). The frontend handles this gracefully by falling back to mock data; a page reload after the proxy warms up will show live data.

**CORS misconfiguration:** If `CORS_ORIGIN` is set to a wrong URL, the frontend will silently fall back to mock data (the CORS error is browser-side; the proxy still returns data to non-browser callers like `curl`). Check the response header with browser DevTools → Network → any `/api/*` request → `Access-Control-Allow-Origin`.

**Key rotation:** To rotate the Finnhub API key, update `FINNHUB_API_KEY` on the proxy host and restart the service. No Vercel redeployment needed. The frontend never holds the key. Old cached responses in the proxy will expire within their TTL window (max 12 h for company profiles).

**Public demo traffic:** If the public Vercel URL receives significant traffic and all requests hit the deployed proxy, the Finnhub free-tier quota (60 req/min) may be exhausted. The proxy cache significantly reduces upstream calls for repeat visitors within the TTL window. For high-traffic scenarios, consider upgrading to a paid Finnhub plan or restricting `CORS_ORIGIN` to only your personal deployment URL.

---

## Security Checklist

| Item | Status |
|---|---|
| `FINNHUB_API_KEY` not in browser bundle | ✅ — Vite never reads it; not prefixed with `VITE_` |
| `FINNHUB_API_KEY` not committed to git | ✅ — `.env.local` is in `.gitignore` |
| `FINNHUB_API_KEY` not a Vercel env var | ✅ — must never be added to Vercel |
| `VITE_FINNHUB_API_KEY` does not exist | ✅ — never add this; it would expose the key to the bundle |
| `VITE_API_BASE_URL` is not a secret | ✅ — public proxy URL only; safe as a Vercel build var |
| `CORS_ORIGIN` restricts cross-origin access in production | ✅ — `resolveCorsOrigin()` never returns `*`; falls back to localhost |
| `.env.example` contains only empty placeholders | ✅ |
| `dist/` contains no server-side code | ✅ — `build.copyPublicDir: false` |
| Proxy defaults to loopback-only binding locally | ✅ — `MARKET_DATA_HOST` defaults to `127.0.0.1` |

---

## Build Reference

```bash
npm run build        # Vite production bundle → dist/
npm run test:build   # Validate dist/ structure and bundle size
npm run preview      # Serve dist/ locally at http://127.0.0.1:8502
```

Production build output (React 18.3.1):
- `dist/index.html` — ~6.5 kB
- `dist/assets/index-*.js` — ~314 kB raw / ~94 kB gzip
- No legacy JSX files, no server code, no secrets
