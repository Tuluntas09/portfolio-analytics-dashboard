# Deployment Guide

**Quant Portfolio Analytics Dashboard**

---

## Overview

The project has two independently deployable pieces:

| Piece | What it is | Where it runs |
|---|---|---|
| **Frontend** | Vite React SPA — `dist/` | Any static host (Vercel, Netlify, GitHub Pages) |
| **Proxy** | Node.js HTTP server — `server/` | Local machine or separate backend host |

The frontend runs fully in mock/offline mode when the proxy is unavailable. Live market data (Finnhub quotes, Yahoo Finance history, company news) requires the proxy to be running and reachable by the browser.

**`FINNHUB_API_KEY` must stay on the proxy host only.** It is read exclusively by `server/market-data-server.mjs` and is never included in the Vite bundle or sent to the browser.

---

## Option A — Vercel Static Portfolio Demo *(recommended for public demo)*

Deploy the Vite frontend to Vercel as a static site. The dashboard loads and all tabs are navigable via deterministic mock data. No API key is required.

**Best for:** recruiter review, GitHub portfolio presentation, offline demonstration.

**Live data:** not available in this mode — the proxy is not deployed.

### Deploy to Vercel

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

No environment variables are needed for the static demo. Do not add `FINNHUB_API_KEY` as a Vercel environment variable — it serves no purpose for static hosting and should never be exposed to the browser.

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

## Option B — Full Local Live-Data Mode *(recommended for development)*

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

## Option C — Future Full Production Live-Data Mode

Deploy the frontend to Vercel and the proxy to a separate backend host. This enables live market data in production without exposing the API key to the browser.

> **Not implemented yet.** This is the planned next deployment step.

### Architecture

```
Browser
  └── Vercel (static frontend)
        └── HTTP requests → Render / Railway / Fly.io (Node.js proxy)
                                └── Finnhub API (key server-side only)
                                └── Yahoo Finance (fallback)
```

### Frontend environment variable

Add a build-time variable on Vercel to point the frontend at the deployed proxy:

```
VITE_API_BASE_URL=https://your-proxy.onrender.com
```

> `VITE_API_BASE_URL` is the only variable that belongs on Vercel. `FINNHUB_API_KEY` belongs on the proxy host exclusively.

### Proxy host requirements

- Node.js 18+ runtime
- `FINNHUB_API_KEY` environment variable set on the host
- CORS headers allowing requests from the Vercel frontend origin
- Start command: `node server/market-data-server.mjs`

### Candidate platforms

| Platform | Free tier | Notes |
|---|---|---|
| [Render](https://render.com) | Yes (spins down on idle) | Simple Node.js service deploy |
| [Railway](https://railway.app) | Yes (usage-based) | Good for persistent Node services |
| [Fly.io](https://fly.io) | Yes | Docker-based, more control |

---

## Security Checklist

| Item | Status |
|---|---|
| `FINNHUB_API_KEY` not in browser bundle | ✅ — Vite never reads it |
| `FINNHUB_API_KEY` not committed to git | ✅ — `.env.local` is `.gitignore`d |
| `FINNHUB_API_KEY` not a Vercel env var for static demo | ✅ — not required, not set |
| `.env.example` contains only an empty placeholder | ✅ |
| API key never prefixed with `VITE_` | ✅ — would expose it to the bundle |
| `dist/` contains no server-side code | ✅ — `build.copyPublicDir: false` |

---

## Build Reference

```bash
npm run build        # Vite production bundle → dist/
npm run test:build   # Validate dist/ structure and bundle size
npm run preview      # Serve dist/ locally at http://127.0.0.1:8502
```

Production build output (React 18.3.1):
- `dist/index.html` — 6.55 kB
- `dist/assets/index-*.js` — 261 kB raw / 81 kB gzip
- No legacy JSX files, no server code, no secrets
