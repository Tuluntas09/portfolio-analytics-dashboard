import http from "node:http";
import { createMarketDataServer, resolveCorsOrigin } from "../server/market-data-server.mjs";

const fail = message => {
  throw new Error(message);
};

// Low-level HTTP helper — allows setting arbitrary headers including Origin,
// which Node.js built-in fetch treats as a forbidden header.
function rawRequest(method, hostname, port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port, path, method, headers }, res => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ─── Original API health checks ─────────────────────────────────────────────

const server = createMarketDataServer();

try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const payload = await response.json();

  if (!response.ok) fail("/api/health did not return 200");
  if (payload.ok !== true) fail("/api/health payload ok flag is invalid");
  if (payload.service !== "market-data-proxy") fail("Unexpected service name");
  if (typeof payload.hasFinnhubKey !== "boolean") fail("hasFinnhubKey must be boolean");
  if (!payload.providers || payload.providers.company !== "Finnhub company profile2") {
    fail("Provider metadata is incomplete");
  }
  if (!payload.providers.prices.includes("Yahoo Finance fallback")) {
    fail("Health metadata should advertise Yahoo Finance fallback for prices");
  }
  if (!payload.cache || typeof payload.cache.cacheEntries !== "number") {
    fail("Health response must include cache stats object with numeric cacheEntries");
  }

  const missingSymbol = await fetch(`http://127.0.0.1:${port}/api/market/quote`);
  if (missingSymbol.status !== 400) fail("Missing symbol should return 400");

  const missingHistorySymbol = await fetch(`http://127.0.0.1:${port}/api/market/history`);
  if (missingHistorySymbol.status !== 400) fail("Missing history symbol should return 400");

  if (!process.env.FINNHUB_API_KEY) {
    const noKey = await fetch(`http://127.0.0.1:${port}/api/market/quote?symbol=AAPL`);
    if (noKey.status !== 503) fail("Missing FINNHUB_API_KEY should return 503 for live endpoints");
  }

  console.log("API health checks passed");
} finally {
  await new Promise(resolve => server.close(resolve));
}

// ─── CORS unit tests — resolveCorsOrigin ────────────────────────────────────
{
  const VERCEL_ORIGIN = "https://portfolio-analytics-dashboard-three.vercel.app";
  const saved = process.env.CORS_ORIGIN;

  // Case 1: allowed Vercel production origin is echoed
  process.env.CORS_ORIGIN = VERCEL_ORIGIN;
  const c1 = resolveCorsOrigin(VERCEL_ORIGIN);
  if (c1 !== VERCEL_ORIGIN) fail(`CORS case 1 (allowed origin): got "${c1}"`);

  // Case 2: trailing slash in CORS_ORIGIN env is stripped; request origin still matches
  process.env.CORS_ORIGIN = VERCEL_ORIGIN + "/";
  const c2 = resolveCorsOrigin(VERCEL_ORIGIN);
  if (c2 !== VERCEL_ORIGIN) fail(`CORS case 2 (trailing slash in env): got "${c2}"`);

  // Case 3: local origin http://127.0.0.1:8502 is always echoed
  process.env.CORS_ORIGIN = VERCEL_ORIGIN;
  const c3 = resolveCorsOrigin("http://127.0.0.1:8502");
  if (c3 !== "http://127.0.0.1:8502") fail(`CORS case 3 (local origin): got "${c3}"`);

  // Case 4: disallowed origin falls back to first configured, never "*"
  const c4 = resolveCorsOrigin("https://evil.example.com");
  if (c4 === "*") fail("CORS case 4: must never return wildcard");
  if (c4 !== VERCEL_ORIGIN) fail(`CORS case 4 (disallowed origin): got "${c4}"`);

  // Case 5: no Origin header falls back to first configured
  const c5 = resolveCorsOrigin(null);
  if (c5 !== VERCEL_ORIGIN) fail(`CORS case 5 (no origin): got "${c5}"`);

  // Case 6: comma-separated origins — second origin in list is echoed
  process.env.CORS_ORIGIN = `${VERCEL_ORIGIN},https://preview.example.com`;
  const c6 = resolveCorsOrigin("https://preview.example.com");
  if (c6 !== "https://preview.example.com") fail(`CORS case 6 (multi-origin): got "${c6}"`);

  // Restore
  if (saved !== undefined) process.env.CORS_ORIGIN = saved;
  else delete process.env.CORS_ORIGIN;

  console.log("CORS unit tests passed");
}

// ─── CORS HTTP header tests ──────────────────────────────────────────────────
{
  const VERCEL_ORIGIN = "https://portfolio-analytics-dashboard-three.vercel.app";
  const saved = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = VERCEL_ORIGIN;

  const server2 = createMarketDataServer();
  try {
    await new Promise(resolve => server2.listen(0, "127.0.0.1", resolve));
    const { port } = server2.address();

    // Case 6: OPTIONS /api/health — must respond 204/200 with CORS headers, no symbol needed
    const optHealth = await rawRequest("OPTIONS", "127.0.0.1", port, "/api/health", {
      Origin: VERCEL_ORIGIN,
    });
    if (optHealth.status !== 204 && optHealth.status !== 200) {
      fail(`OPTIONS /api/health: expected 204/200, got ${optHealth.status}`);
    }
    if (optHealth.headers["access-control-allow-origin"] !== VERCEL_ORIGIN) {
      fail(`OPTIONS /api/health ACAO: "${optHealth.headers["access-control-allow-origin"]}"`);
    }
    if (!optHealth.headers["vary"] || !optHealth.headers["vary"].includes("Origin")) {
      fail(`OPTIONS /api/health: missing Vary: Origin`);
    }

    // Case 7: OPTIONS /api/market/quote — must respond 204/200, no upstream API call
    const optQuote = await rawRequest("OPTIONS", "127.0.0.1", port, "/api/market/quote?symbol=AAPL", {
      Origin: VERCEL_ORIGIN,
    });
    if (optQuote.status !== 204 && optQuote.status !== 200) {
      fail(`OPTIONS /api/market/quote: expected 204/200, got ${optQuote.status}`);
    }
    if (optQuote.headers["access-control-allow-origin"] !== VERCEL_ORIGIN) {
      fail(`OPTIONS /api/market/quote ACAO: "${optQuote.headers["access-control-allow-origin"]}"`);
    }

    // CORS header present on GET /api/health
    const getHealth = await rawRequest("GET", "127.0.0.1", port, "/api/health", {
      Origin: VERCEL_ORIGIN,
    });
    if (getHealth.headers["access-control-allow-origin"] !== VERCEL_ORIGIN) {
      fail(`GET /api/health ACAO: "${getHealth.headers["access-control-allow-origin"]}"`);
    }
    if (!getHealth.headers["vary"] || !getHealth.headers["vary"].includes("Origin")) {
      fail(`GET /api/health: missing Vary: Origin`);
    }

    // CORS header present on 400 error response
    const get400 = await rawRequest("GET", "127.0.0.1", port, "/api/market/quote", {
      Origin: VERCEL_ORIGIN,
    });
    if (get400.status !== 400) fail(`Expected 400 for missing symbol, got ${get400.status}`);
    if (get400.headers["access-control-allow-origin"] !== VERCEL_ORIGIN) {
      fail(`400 response ACAO: "${get400.headers["access-control-allow-origin"]}"`);
    }

    // CORS header present on 404 response (include symbol so routing reaches the 404 handler)
    const get404 = await rawRequest("GET", "127.0.0.1", port, "/api/no-such-endpoint?symbol=AAPL", {
      Origin: VERCEL_ORIGIN,
    });
    if (get404.status !== 404) fail(`Expected 404 for unknown endpoint, got ${get404.status}`);
    if (get404.headers["access-control-allow-origin"] !== VERCEL_ORIGIN) {
      fail(`404 response ACAO: "${get404.headers["access-control-allow-origin"]}"`);
    }

    // Allow-Headers must include Authorization
    const allowHeaders = optHealth.headers["access-control-allow-headers"] || "";
    if (!allowHeaders.includes("Authorization")) {
      fail(`OPTIONS /api/health: Allow-Headers missing Authorization: "${allowHeaders}"`);
    }

  } finally {
    await new Promise(resolve => server2.close(resolve));
    if (saved !== undefined) process.env.CORS_ORIGIN = saved;
    else delete process.env.CORS_ORIGIN;
  }

  console.log("CORS HTTP header tests passed");
}
