# Local Daily Use — Quant Portfolio Analytics Dashboard

How to run the full local stack (live Finnhub data) on Windows every day.

---

## Quick Start (after first-time setup)

Double-click `start-local-dashboard.bat` in the project folder.

That's it. The launcher:
1. Opens a terminal for the Node.js proxy (port 8787)
2. Opens a terminal for the Vite frontend (port 8502)
3. Opens `http://127.0.0.1:8502` in your default browser after a short delay

### Optional: Create Desktop Shortcut

To launch the dashboard from the Desktop without navigating to the project folder each time, create a shortcut using either method below.

**Method A — PowerShell script (one command):**

Open PowerShell in the project root and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\create-desktop-shortcut.ps1
```

This creates `Quant Portfolio Dashboard.lnk` on your Desktop pointing to `start-local-dashboard.bat`. If the shortcut already exists it is overwritten. No admin privileges required.

**Method B — Right-click manually:**

1. In File Explorer, navigate to the project folder.
2. Right-click `start-local-dashboard.bat` → **Send to** → **Desktop (create shortcut)**.
3. Optionally rename the resulting shortcut to `Quant Portfolio Dashboard`.

**How to stop:** close both terminal windows.

---

## How to Tell Live Data Is Working

After the browser opens, look at the sidebar:

| Sidebar indicator | Meaning |
|---|---|
| **Proxy ready** | Proxy is running and FINNHUB_API_KEY is configured |
| **Real prices N/N** | Live Finnhub/Yahoo data loaded for all holdings |
| **Partial prices N/N** | Some tickers loaded live; others fell back to mock (rate limit or network) |
| **Proxy online - key missing** | Proxy is running but .env.local has no key |
| **Proxy offline** | Proxy is not running — start it first |
| **Mock prices** | Proxy not reachable; all analytics use synthetic data |

You can also open `http://127.0.0.1:8787/api/health` in a new browser tab at any time. A working proxy returns:

```json
{
  "ok": true,
  "hasFinnhubKey": true,
  ...
}
```

---

## First-Time Setup

Do this once before first use.

**1. Install dependencies**

```
npm install
```

**2. Create .env.local**

Create a file named `.env.local` in the project root (same folder as `package.json`).

```
FINNHUB_API_KEY=your_key_here
```

Replace `your_key_here` with your Finnhub API key. Get a free key at https://finnhub.io

Do **not** commit this file — it is gitignored.

**3. Run the launcher**

Double-click `start-local-dashboard.bat`.

---

## Manual Start (two terminals — alternative to the launcher)

If you prefer manual control or are on a non-Windows system:

**Terminal 1 — proxy:**
```
npm run api
```

Wait until you see: `Market data proxy listening on http://127.0.0.1:8787`

**Terminal 2 — frontend:**
```
npm run dev
```

Wait until Vite prints: `Local: http://127.0.0.1:8502/`

Then open `http://127.0.0.1:8502` in your browser.

---

## URLs

| Service | URL |
|---|---|
| Dashboard | http://127.0.0.1:8502 |
| Proxy health | http://127.0.0.1:8787/api/health |

---

## Ports

| Port | Service | Configurable? |
|---|---|---|
| 8502 | Vite frontend | `npm run dev` hardcodes this — change in package.json if needed |
| 8787 | Node.js proxy | Default; override with `MARKET_DATA_PORT=XXXX` in .env.local |

If port 8502 or 8787 is in use, you will see an error in the terminal. Free the port or change the setting.

---

## Troubleshooting

**Browser opens but shows Mock Prices / Proxy offline**

- The proxy terminal may still be starting. Wait 5 seconds and refresh the browser.
- If the proxy terminal shows an error, check that `.env.local` exists with the correct key name.
- If you see `EADDRINUSE`, port 8787 is already in use. Close any previous proxy window.

**Proxy ready but still showing Mock Prices**

- This means the proxy is up but Finnhub returned an error. Open `http://127.0.0.1:8787/api/health` and confirm `hasFinnhubKey` is `true`.
- If `hasFinnhubKey` is `false`, check that `.env.local` has `FINNHUB_API_KEY=` with a non-empty value (no quotes needed around the key).

**Partial prices — not all tickers loading**

- You have hit the Finnhub free-tier rate limit (60 requests/minute). The rate-limit banner will appear in the sidebar.
- Wait 60 seconds and the next data fetch cycle will pick up the remaining tickers from cache or a fresh request.
- The proxy cache (30-minute TTL for history) means subsequent refreshes within a session are free — rate limits only affect the first load.

**Vite terminal shows "Port 8502 is in use"**

- A previous dev server session was not closed. Close the old terminal window and re-run.

**How to change the frontend port**

Edit `package.json`:
```json
"dev": "vite --host 127.0.0.1 --port 8502"
```
Change `8502` to any free port. Update the URL you open in the browser accordingly. Also update `start-local-dashboard.bat` if you want the launcher to open the correct URL.

---

## Security Notes

- `FINNHUB_API_KEY` lives only in `.env.local` — never in source code, never in `git`.
- `.env.local` is gitignored by `.env.*` in `.gitignore`.
- The proxy binds to `127.0.0.1` by default — only your local machine can reach it.
- The browser never receives your API key — it only talks to your local proxy.
- The public Vercel demo at `portfolio-analytics-dashboard-three.vercel.app` is unaffected by your local setup.

---

## Mock/Offline Mode

To run without the proxy or an API key (synthetic data only):

1. Start only the frontend: `npm run dev`
2. Open `http://127.0.0.1:8502`

All tabs are fully functional on mock data. Cost basis and unrealized P&L will be computed against synthetic prices, not real market prices.
