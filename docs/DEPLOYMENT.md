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

### Step 1 — Deploy the proxy

Deploy `server/market-data-server.mjs` as a **Node.js web service** on any platform that supports persistent Node.js processes.

**Example platforms:**

| Platform | Free tier | Notes |
|---|---|---|
| [Render](https://render.com) | Yes (spins down after ~15 min idle) | Web Service → Node, start command below |
| [Railway](https://railway.app) | Yes (usage-based credits) | Good for persistent Node services |
| [Fly.io](https://fly.io) | Yes | Docker-based, more control |

**Start command for the proxy host:**
```
node server/market-data-server.mjs
```

**Environment variables to set on the proxy host:**

| Variable | Value | Required |
|---|---|---|
| `FINNHUB_API_KEY` | Your Finnhub API key | Yes |
| `MARKET_DATA_HOST` | `0.0.0.0` | Yes — allows the host to accept external connections |
| `PORT` or `MARKET_DATA_PORT` | Set by platform automatically, or specify `8787` | Platform-dependent |

> Most platforms (Render, Railway, Fly.io) inject `PORT` automatically. The proxy reads `MARKET_DATA_PORT` first, then `PORT`, then defaults to `8787`.

### Step 2 — Configure the Vercel frontend

On your Vercel project, add one build-time environment variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-deployed-proxy.onrender.com` (your actual proxy URL) |

> **`VITE_API_BASE_URL` is not a secret.** It is simply the public URL of your proxy. Do **not** add `FINNHUB_API_KEY` to Vercel. Do **not** add `VITE_FINNHUB_API_KEY` anywhere — the Finnhub key must never reach the browser.

After setting the variable, redeploy the Vercel frontend so it picks up the new build-time value.

### Expected behavior after deployment

| Scenario | What the frontend does |
|---|---|
| Proxy is reachable and has a valid key | Fetches real Finnhub quotes, history, and news. `marketDataStatus` pill shows **Real Prices**. |
| Proxy is reachable but key is missing | Proxy returns 503. Frontend falls back to mock data for price history. |
| Proxy is cold-starting (Render free tier) | Health check times out. Frontend falls back to mock data. Once the proxy warms up (~30 s), a page reload shows live data. |
| Proxy is unreachable | Health check fails. Frontend runs entirely on deterministic mock data. All tabs remain functional. |
| Finnhub 429 rate limit | Yahoo Finance fallback used for history. Rate-limit banner shown in the frontend. |

### Rate-limit notes

The Finnhub free tier allows 60 requests/minute. A portfolio load with 5 tickers triggers up to 20 upstream calls (history + quote + profile + news per ticker). The proxy TTL cache (30 min for history, 60 s for quotes) means repeated reloads within the TTL window make zero upstream calls.

---

## Security Checklist

| Item | Status |
|---|---|
| `FINNHUB_API_KEY` not in browser bundle | ✅ — Vite never reads it; not prefixed with `VITE_` |
| `FINNHUB_API_KEY` not committed to git | ✅ — `.env.local` is in `.gitignore` |
| `FINNHUB_API_KEY` not a Vercel env var | ✅ — must never be added to Vercel |
| `VITE_FINNHUB_API_KEY` does not exist | ✅ — never add this; it would expose the key to the bundle |
| `VITE_API_BASE_URL` is not a secret | ✅ — public proxy URL only; safe as a Vercel build var |
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
- `dist/assets/index-*.js` — ~286 kB raw / ~88 kB gzip
- No legacy JSX files, no server code, no secrets
