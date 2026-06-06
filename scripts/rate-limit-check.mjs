// Lightweight tests for Finnhub 429 rate-limit detection and Retry-After parsing.
// Consistent with project test style (no external dependencies, pure Node.js).

import fs from "node:fs";
import { createCache } from "../server/cache.mjs";
import { parseRetryAfter, createMarketDataServer } from "../server/market-data-server.mjs";

const fail = message => { throw new Error(message); };

// 1. parseRetryAfter: integer seconds string
{
  const result = parseRetryAfter("60");
  if (result !== 60) fail(`parseRetryAfter seconds "60": expected 60, got ${result}`);
}

// 2. parseRetryAfter: decimal seconds string
{
  const result = parseRetryAfter("30.5");
  if (result !== 31) fail(`parseRetryAfter decimal "30.5": expected 31 (ceil), got ${result}`);
}

// 3. parseRetryAfter: HTTP-date format (future date)
{
  const future = new Date(Date.now() + 90 * 1000);
  const result = parseRetryAfter(future.toUTCString());
  if (result < 88 || result > 92) {
    fail(`parseRetryAfter HTTP-date (90s future): expected ~90, got ${result}`);
  }
}

// 4. parseRetryAfter: HTTP-date format (past date) → fallback 60
{
  const past = new Date(Date.now() - 30 * 1000);
  const result = parseRetryAfter(past.toUTCString());
  if (result !== 60) fail(`parseRetryAfter HTTP-date (past): expected fallback 60, got ${result}`);
}

// 5. parseRetryAfter: missing header → 60 s fallback
{
  if (parseRetryAfter(null) !== 60) fail("parseRetryAfter(null): expected 60");
  if (parseRetryAfter(undefined) !== 60) fail("parseRetryAfter(undefined): expected 60");
  if (parseRetryAfter("") !== 60) fail('parseRetryAfter(""): expected 60');
}

// 6. parseRetryAfter: invalid/garbage value → 60 s fallback
{
  const result = parseRetryAfter("not-a-date-or-number");
  if (result !== 60) fail(`parseRetryAfter invalid: expected 60, got ${result}`);
}

// 7. parseRetryAfter: zero/negative seconds → fallback 60
{
  const zero = parseRetryAfter("0");
  if (zero !== 60) fail(`parseRetryAfter "0": expected fallback 60, got ${zero}`);
  const neg = parseRetryAfter("-5");
  if (neg !== 60) fail(`parseRetryAfter "-5": expected fallback 60, got ${neg}`);
}

// 8. 429 response is not cached (statusCode 429, ok:false)
{
  const cache = createCache();
  let callCount = 0;
  const fn429 = async () => {
    callCount++;
    return {
      statusCode: 429,
      payload: { ok: false, error: "rate_limited", provider: "finnhub", retryAfter: 60 },
    };
  };

  const r1 = await cache.getOrFetch("rl-key", fn429, 60_000);
  const r2 = await cache.getOrFetch("rl-key", fn429, 60_000);

  if (r1.cacheStatus !== "miss") fail(`429 first fetch: expected "miss", got "${r1.cacheStatus}"`);
  if (r2.cacheStatus !== "miss") fail(`429 second fetch: expected "miss" (not cached), got "${r2.cacheStatus}"`);
  if (callCount !== 2) fail(`429 must not be cached: expected 2 outbound calls, got ${callCount}`);
}

// 9. 429 structured payload shape is correct
{
  const cache = createCache();
  const fn429 = async () => ({
    statusCode: 429,
    payload: { ok: false, error: "rate_limited", provider: "finnhub", retryAfter: 60 },
  });
  const result = await cache.getOrFetch("rl-shape-key", fn429, 60_000);
  if (result.payload.ok !== false) fail("429 payload: ok must be false");
  if (result.payload.error !== "rate_limited") fail(`429 payload: error must be "rate_limited", got "${result.payload.error}"`);
  if (result.payload.provider !== "finnhub") fail(`429 payload: provider must be "finnhub"`);
  if (typeof result.payload.retryAfter !== "number" || result.payload.retryAfter <= 0) {
    fail(`429 payload: retryAfter must be a positive number, got ${result.payload.retryAfter}`);
  }
}

// 10. Existing missing API key behavior unchanged (503, ok:false, not cached)
// Pre-warm loadLocalSecrets() while the real key is present (mirrors the pattern in
// cache-check.mjs test 12), so that the subsequent delete is respected by getFinnhubKey().
{
  const warmServer = createMarketDataServer();
  await new Promise(resolve => warmServer.listen(0, "127.0.0.1", resolve));
  await fetch(`http://127.0.0.1:${warmServer.address().port}/api/health`);
  await new Promise(resolve => warmServer.close(resolve));
}
{
  const savedKey = process.env.FINNHUB_API_KEY;
  delete process.env.FINNHUB_API_KEY;

  const server = createMarketDataServer();
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    const r1 = await fetch(`http://127.0.0.1:${port}/api/market/quote?symbol=AAPL`);
    const r2 = await fetch(`http://127.0.0.1:${port}/api/market/quote?symbol=AAPL`);

    if (r1.status !== 503) fail(`No-key: expected 503, got ${r1.status}`);
    if (r2.status !== 503) fail(`No-key retry: expected 503 (errors not cached), got ${r2.status}`);

    const p1 = await r1.json();
    if (p1.ok !== false) fail("No-key payload must have ok:false");
    if (p1.error !== "FINNHUB_API_KEY is not configured") {
      fail(`No-key error message unchanged: got "${p1.error}"`);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (savedKey !== undefined) process.env.FINNHUB_API_KEY = savedKey;
  }
}

// 11. Warning copy exists in EN and TR (app.jsx and views-analysis.jsx)
{
  const root = new URL("..", import.meta.url);
  const uiSrc = fs.readFileSync(new URL("public/legacy/ui.jsx", root), "utf8");
  const viewsSrc = fs.readFileSync(new URL("public/legacy/views-analysis.jsx", root), "utf8");

  const enCopy = "Rate limit reached — some data may be delayed.";
  const trCopy = "Rate limit sınırına ulaşıldı — bazı veriler gecikebilir.";

  if (!uiSrc.includes(enCopy)) fail(`EN rate-limit copy missing from ui.jsx: "${enCopy}"`);
  if (!uiSrc.includes(trCopy)) fail(`TR rate-limit copy missing from ui.jsx: "${trCopy}"`);
  if (!viewsSrc.includes(enCopy)) fail(`EN rate-limit copy missing from views-analysis.jsx: "${enCopy}"`);
  if (!viewsSrc.includes(trCopy)) fail(`TR rate-limit copy missing from views-analysis.jsx: "${trCopy}"`);
}

// 12. rate_limited news status is handled in views-analysis.jsx without crashing
{
  const root = new URL("..", import.meta.url);
  const viewsSrc = fs.readFileSync(new URL("public/legacy/views-analysis.jsx", root), "utf8");
  if (!viewsSrc.includes('"rate_limited"')) {
    fail('views-analysis.jsx must handle newsState.status === "rate_limited"');
  }
  if (!viewsSrc.includes("newsRateLimit")) {
    fail("views-analysis.jsx must use copy.newsRateLimit for rate_limited state");
  }
}

// 13. Proxy does not expose FINNHUB_API_KEY in 429 response
{
  const root = new URL("..", import.meta.url);
  const serverSrc = fs.readFileSync(new URL("server/market-data-server.mjs", root), "utf8");
  // The 429 response block must not reference `key` variable after detecting 429
  // Verify payload structure contains only ok, error, provider, retryAfter
  const payloadBlock = serverSrc.match(/status === 429[\s\S]*?return \{[\s\S]*?\};/m)?.[0] || "";
  if (payloadBlock.includes("token") || payloadBlock.includes("FINNHUB_API_KEY")) {
    fail("429 response payload must not contain API key or token");
  }
}

// 14. Existing cache behavior is preserved: successful responses still cached, errors not
{
  const cache = createCache();
  let callCount = 0;
  const successFn = async () => {
    callCount++;
    return { statusCode: 200, payload: { ok: true, provider: "finnhub", data: { c: 42 } } };
  };

  const r1 = await cache.getOrFetch("preserve-key", successFn, 60_000);
  const r2 = await cache.getOrFetch("preserve-key", successFn, 60_000);

  if (r1.cacheStatus !== "miss") fail(`Cache preserve: first call should be "miss", got "${r1.cacheStatus}"`);
  if (r2.cacheStatus !== "hit") fail(`Cache preserve: second call should be "hit", got "${r2.cacheStatus}"`);
  if (callCount !== 1) fail(`Cache preserve: expected 1 outbound call, got ${callCount}`);
}

console.log("Rate-limit checks passed");
