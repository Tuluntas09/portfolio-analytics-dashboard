import { createCache, TTL_MS } from "../server/cache.mjs";
import { createMarketDataServer } from "../server/market-data-server.mjs";

const fail = message => { throw new Error(message); };

// 1. cacheKey produces stable, sorted keys regardless of parameter insertion order
{
  const cache = createCache();
  const k1 = cache.cacheKey("history", { symbol: "AAPL", from: "2024-01-01", to: "2024-12-31" });
  const k2 = cache.cacheKey("history", { to: "2024-12-31", symbol: "AAPL", from: "2024-01-01" });
  if (k1 !== k2) fail(`cacheKey must be order-independent: "${k1}" !== "${k2}"`);
  if (!k1.startsWith("history?")) fail(`cacheKey must include route prefix: ${k1}`);
  if (!k1.includes("symbol=AAPL")) fail(`cacheKey must include symbol param: ${k1}`);
  if (!k1.includes("from=2024-01-01")) fail(`cacheKey must include from param: ${k1}`);
  // params should be sorted alphabetically: from < symbol < to
  const expectedKey = "history?from=2024-01-01&symbol=AAPL&to=2024-12-31";
  if (k1 !== expectedKey) fail(`cacheKey expected "${expectedKey}", got "${k1}"`);
}

// 2. cacheKey filters out null/empty params
{
  const cache = createCache();
  const k = cache.cacheKey("quote", { symbol: "MSFT", extra: null, empty: "" });
  if (k.includes("extra") || k.includes("empty")) {
    fail(`cacheKey must omit null/empty params: ${k}`);
  }
}

// 3. TTL expiry: entry is returned before TTL and not returned after
{
  let now = 1000;
  const cache = createCache({ clock: () => now });
  const result = { statusCode: 200, payload: { ok: true, data: "test" } };

  cache.set("expiry-key", result, 500); // expiresAt = 1500

  const hit = cache.get("expiry-key");
  if (hit === null) fail("Cache should return entry before TTL expires (now=1000, expiresAt=1500)");

  now = 1600; // advance past TTL
  const expired = cache.get("expiry-key");
  if (expired !== null) fail("Cache should return null after TTL expires (now=1600, expiresAt=1500)");
}

// 4. Error responses (non-200) are not cached
{
  const cache = createCache();
  let callCount = 0;
  const errorFetch = async () => {
    callCount++;
    return { statusCode: 503, payload: { ok: false, error: "no key" } };
  };

  const r1 = await cache.getOrFetch("err-key", errorFetch, 60_000);
  const r2 = await cache.getOrFetch("err-key", errorFetch, 60_000);

  if (r1.cacheStatus !== "miss") fail(`First error fetch: expected cacheStatus="miss", got "${r1.cacheStatus}"`);
  if (r2.cacheStatus !== "miss") fail(`Second error fetch: expected cacheStatus="miss" (not cached), got "${r2.cacheStatus}"`);
  if (callCount !== 2) fail(`Error responses must not be cached: expected 2 outbound calls, got ${callCount}`);
}

// 5. ok:false payloads with statusCode 200 are not cached
{
  const cache = createCache();
  let callCount = 0;
  const okFalseFetch = async () => {
    callCount++;
    return { statusCode: 200, payload: { ok: false, error: "empty result" } };
  };

  const r1 = await cache.getOrFetch("ok-false-key", okFalseFetch, 60_000);
  const r2 = await cache.getOrFetch("ok-false-key", okFalseFetch, 60_000);

  if (r2.cacheStatus !== "miss") fail(`ok:false payload should not be cached, got "${r2.cacheStatus}"`);
  if (callCount !== 2) fail(`ok:false responses must not be cached: expected 2 calls, got ${callCount}`);
}

// 6. Successful responses are cached on subsequent calls
{
  const cache = createCache();
  let callCount = 0;
  const successFetch = async () => {
    callCount++;
    return { statusCode: 200, payload: { ok: true, provider: "finnhub", data: { c: 123 } } };
  };

  const r1 = await cache.getOrFetch("ok-key", successFetch, 60_000);
  const r2 = await cache.getOrFetch("ok-key", successFetch, 60_000);
  const r3 = await cache.getOrFetch("ok-key", successFetch, 60_000);

  if (r1.cacheStatus !== "miss") fail(`First fetch: expected "miss", got "${r1.cacheStatus}"`);
  if (r2.cacheStatus !== "hit") fail(`Second fetch: expected "hit", got "${r2.cacheStatus}"`);
  if (r3.cacheStatus !== "hit") fail(`Third fetch: expected "hit", got "${r3.cacheStatus}"`);
  if (callCount !== 1) fail(`Cached: expected 1 outbound call, got ${callCount}`);
  if (!r2.cachedAt) fail('Cache hit must include "cachedAt" field');
  if (typeof r2.ttlSeconds !== "number" || r2.ttlSeconds <= 0) {
    fail(`Cache hit "ttlSeconds" must be a positive number, got ${r2.ttlSeconds}`);
  }
}

// 7. In-flight request de-duplication: concurrent identical requests share one outbound call
{
  const cache = createCache();
  let callCount = 0;

  const slowFetch = async () => {
    callCount++;
    await new Promise(r => setTimeout(r, 10));
    return { statusCode: 200, payload: { ok: true, data: "slow" } };
  };

  const [r1, r2, r3] = await Promise.all([
    cache.getOrFetch("dedup-key", slowFetch, 60_000),
    cache.getOrFetch("dedup-key", slowFetch, 60_000),
    cache.getOrFetch("dedup-key", slowFetch, 60_000),
  ]);

  if (callCount !== 1) fail(`De-duplication: expected 1 outbound call, got ${callCount}`);
  if (r1.cacheStatus !== "miss") fail(`First in-flight: expected "miss", got "${r1.cacheStatus}"`);
  if (r2.cacheStatus !== "deduped") fail(`Second in-flight: expected "deduped", got "${r2.cacheStatus}"`);
  if (r3.cacheStatus !== "deduped") fail(`Third in-flight: expected "deduped", got "${r3.cacheStatus}"`);
  // All three should carry the same payload data
  if (r2.payload?.data !== "slow") fail(`Deduped result must carry original payload`);
}

// 8. De-duplication with error: concurrent requests share the error, nothing cached
{
  const cache = createCache();
  let callCount = 0;

  const slowError = async () => {
    callCount++;
    await new Promise(r => setTimeout(r, 10));
    return { statusCode: 502, payload: { ok: false, error: "upstream down" } };
  };

  const [r1, r2] = await Promise.all([
    cache.getOrFetch("dedup-err-key", slowError, 60_000),
    cache.getOrFetch("dedup-err-key", slowError, 60_000),
  ]);

  if (callCount !== 1) fail(`Error de-duplication: expected 1 outbound call, got ${callCount}`);
  if (r1.cacheStatus !== "miss") fail(`First dedup error: expected "miss", got "${r1.cacheStatus}"`);
  if (r2.cacheStatus !== "deduped") fail(`Second dedup error: expected "deduped", got "${r2.cacheStatus}"`);

  // After both settle, a fresh request should be a new miss (not cached)
  const r3 = await cache.getOrFetch("dedup-err-key", slowError, 60_000);
  if (r3.cacheStatus !== "miss") fail(`Post-dedup error: expected "miss" on retry, got "${r3.cacheStatus}"`);
  if (callCount !== 2) fail(`Post-dedup retry: expected 2 total outbound calls, got ${callCount}`);
}

// 9. Max entries cap: cache does not grow beyond maxEntries
{
  const cache = createCache({ maxEntries: 3 });

  for (let i = 0; i < 10; i++) {
    cache.set(`cap-key-${i}`, { statusCode: 200, payload: { ok: true, i } }, 60_000);
  }

  const { cacheEntries } = cache.stats();
  if (cacheEntries > 3) fail(`Max entries cap violated: expected ≤3, got ${cacheEntries}`);
}

// 10. stats() counters are accurate
{
  const cache = createCache();
  const fetch1 = async () => ({ statusCode: 200, payload: { ok: true } });

  await cache.getOrFetch("stats-key", fetch1, 60_000); // miss
  await cache.getOrFetch("stats-key", fetch1, 60_000); // hit
  await cache.getOrFetch("stats-key", fetch1, 60_000); // hit

  const s = cache.stats();
  if (s.cacheMisses !== 1) fail(`stats: expected 1 miss, got ${s.cacheMisses}`);
  if (s.cacheHits !== 2) fail(`stats: expected 2 hits, got ${s.cacheHits}`);
  if (s.cacheEntries !== 1) fail(`stats: expected 1 entry, got ${s.cacheEntries}`);
}

// 11. TTL_MS constants are positive and ordered correctly
{
  for (const [name, val] of Object.entries(TTL_MS)) {
    if (typeof val !== "number" || val <= 0) fail(`TTL_MS.${name} must be a positive number, got ${val}`);
  }
  if (TTL_MS.QUOTE >= TTL_MS.HISTORY) fail("TTL_MS.QUOTE must be shorter than HISTORY (live prices expire faster)");
  if (TTL_MS.HISTORY >= TTL_MS.PROFILE) fail("TTL_MS.HISTORY must be shorter than PROFILE (company metadata is stable)");
  if (TTL_MS.NEWS >= TTL_MS.PROFILE) fail("TTL_MS.NEWS must be shorter than PROFILE");
}

// 12. Health endpoint includes cache stats object
{
  const server = createMarketDataServer();
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const payload = await res.json();

    if (!res.ok) fail("/api/health must return 200");
    if (!payload.cache) fail('Health endpoint must include a "cache" field');
    const requiredStats = ["cacheEntries", "inFlightRequests", "cacheHits", "cacheMisses", "dedupedRequests"];
    for (const stat of requiredStats) {
      if (typeof payload.cache[stat] !== "number") {
        fail(`Health cache.${stat} must be a number, got ${typeof payload.cache[stat]}`);
      }
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

// 13. API response shape remains backward compatible (cacheStatus is additive, original fields preserved)
{
  const cache = createCache();
  const originalPayload = {
    ok: true,
    provider: "finnhub",
    fallbackUsed: false,
    symbol: "AAPL",
    from: "2024-01-01",
    to: "2024-12-31",
    rows: 1,
    candles: [{ date: "2024-01-02", close: 150 }],
  };
  const fetchFn = async () => ({ statusCode: 200, payload: originalPayload });

  const r = await cache.getOrFetch("compat-key", fetchFn, 60_000);

  // All original payload fields preserved
  for (const field of ["ok", "provider", "fallbackUsed", "symbol", "from", "to", "rows", "candles"]) {
    if (r.payload[field] === undefined) fail(`Backward compat: payload.${field} must be preserved`);
  }
  // cacheStatus is the only additive field at the result level
  if (!["hit", "miss", "deduped"].includes(r.cacheStatus)) {
    fail(`cacheStatus must be "hit", "miss", or "deduped"; got "${r.cacheStatus}"`);
  }
  // statusCode preserved
  if (r.statusCode !== 200) fail(`statusCode must be preserved through cache layer, got ${r.statusCode}`);
}

// 14. Missing API key behavior is unchanged (503, not cached)
{
  const savedKey = process.env.FINNHUB_API_KEY;
  delete process.env.FINNHUB_API_KEY;

  const server = createMarketDataServer();
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    const r1 = await fetch(`http://127.0.0.1:${port}/api/market/quote?symbol=AAPL`);
    const r2 = await fetch(`http://127.0.0.1:${port}/api/market/quote?symbol=AAPL`);

    if (r1.status !== 503) fail(`No-key quote: expected 503, got ${r1.status}`);
    if (r2.status !== 503) fail(`No-key quote retry: expected 503 (errors not cached), got ${r2.status}`);

    const p1 = await r1.json();
    if (p1.ok !== false) fail("No-key response payload must have ok:false");
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (savedKey !== undefined) process.env.FINNHUB_API_KEY = savedKey;
  }
}

console.log("Cache checks passed");
