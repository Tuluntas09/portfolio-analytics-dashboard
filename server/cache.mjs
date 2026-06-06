// In-memory response cache with TTL expiry, request de-duplication, and bounded memory.
//
// Design notes:
// - Non-persistent: process restart clears all entries. Intentional — stale
//   market data from a previous session is worse than a fresh miss.
// - Not shared across processes: each proxy instance owns its own cache.
// - Suitable for local-dev and single-user personal use. Not suitable for
//   high-traffic multi-user deployments without an external cache layer.
// - Errors (non-200, ok:false) are never cached. A failed upstream call
//   always retries on the next request.
//
// TTL rationale (conservative defaults):
//   QUOTE:   60 s  — live prices change every few seconds; 60 s balances
//                    freshness with Finnhub's 60 req/min free-tier limit
//   HISTORY: 30 min — daily candles for past dates are immutable within a
//                    trading session; 30 min covers most interactive use
//   CANDLES: 30 min — same granularity and rationale as history
//   PROFILE: 12 h   — company name/sector/exchange rarely changes intra-day
//   NEWS:    10 min — headlines arrive periodically; 10 min avoids stale feed

export const TTL_MS = {
  QUOTE:   60_000,
  HISTORY: 30 * 60_000,
  CANDLES: 30 * 60_000,
  PROFILE: 12 * 60 * 60_000,
  NEWS:    10 * 60_000,
};

const MAX_ENTRIES_DEFAULT = 500;

export function createCache({ maxEntries = MAX_ENTRIES_DEFAULT, clock = () => Date.now() } = {}) {
  // store: key → { result, expiresAt, cachedAt, ttlMs }
  const store = new Map();
  // inFlight: key → Promise<{ statusCode, payload }>
  const inFlight = new Map();

  let hits = 0;
  let misses = 0;
  let deduped = 0;

  // Remove expired entries; evict oldest (Map insertion order) to make room for one more entry.
  // Called before each set(), so the invariant store.size ≤ maxEntries holds after set().
  function prune() {
    const now = clock();
    for (const [k, entry] of store) {
      if (entry.expiresAt <= now) store.delete(k);
    }
    // Evict oldest entries until there is room for one more
    while (store.size >= maxEntries) {
      const firstKey = store.keys().next().value;
      if (firstKey === undefined) break;
      store.delete(firstKey);
    }
  }

  // Returns the stored entry (result, cachedAt, ttlMs) or null on miss/expiry.
  function get(key) {
    const entry = store.get(key);
    if (!entry) { misses++; return null; }
    if (entry.expiresAt <= clock()) { store.delete(key); misses++; return null; }
    hits++;
    return entry;
  }

  // Stores a successful result. Caller must verify it is worth caching.
  function set(key, result, ttlMs) {
    prune();
    store.set(key, {
      result,
      expiresAt: clock() + ttlMs,
      cachedAt: clock(),
      ttlMs,
    });
  }

  // Fetch-or-return:
  //   cache hit  → return immediately with cacheStatus:"hit"
  //   in-flight  → attach to the existing promise, cacheStatus:"deduped"
  //   miss       → call fetchFn, cache if successful, cacheStatus:"miss"
  //
  // fetchFn must return { statusCode, payload } and must not throw.
  // Only statusCode 200 with payload.ok !== false is cached.
  async function getOrFetch(key, fetchFn, ttlMs) {
    const entry = get(key);
    if (entry !== null) {
      return {
        ...entry.result,
        cacheStatus: "hit",
        cachedAt: new Date(entry.cachedAt).toISOString(),
        ttlSeconds: Math.round(entry.ttlMs / 1000),
      };
    }

    if (inFlight.has(key)) {
      deduped++;
      const result = await inFlight.get(key);
      return { ...result, cacheStatus: "deduped" };
    }

    // Register a shared promise so concurrent identical requests attach here.
    let resolveInflight;
    const promise = new Promise(resolve => { resolveInflight = resolve; });
    inFlight.set(key, promise);

    let result;
    try {
      result = await fetchFn();
    } catch (err) {
      result = { statusCode: 502, payload: { ok: false, error: err.message } };
    } finally {
      inFlight.delete(key);
    }

    resolveInflight(result);
    if (result.statusCode === 200 && result.payload?.ok !== false) {
      set(key, result, ttlMs);
    }
    return { ...result, cacheStatus: "miss" };
  }

  function stats() {
    return {
      cacheEntries: store.size,
      inFlightRequests: inFlight.size,
      cacheHits: hits,
      cacheMisses: misses,
      dedupedRequests: deduped,
    };
  }

  // Stable, deterministic cache key: route + alphabetically sorted query params.
  // Example:
  //   cacheKey("history", { symbol: "AAPL", from: "2024-01-01", to: "2024-12-31" })
  //   → "history?from=2024-01-01&symbol=AAPL&to=2024-12-31"
  function cacheKey(route, params) {
    const sorted = Object.entries(params)
      .filter(([, v]) => v != null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return sorted ? `${route}?${sorted}` : route;
  }

  return { get, set, getOrFetch, stats, cacheKey };
}
