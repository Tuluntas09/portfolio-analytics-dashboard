import http from "node:http";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { createCache, TTL_MS } from "./cache.mjs";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const DEFAULT_TIMEOUT_MS = 10000;
let localSecretsLoaded = false;

function parseSecretValue(line, key) {
  const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "i"));
  if (!match) return "";
  return match[1].replace(/^["']|["']$/g, "").trim();
}

function loadLocalSecrets() {
  if (localSecretsLoaded || process.env.FINNHUB_API_KEY) return;
  localSecretsLoaded = true;

  const candidates = [
    ".env.local",
    ".env",
    ".streamlit/secrets.toml",
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const value =
        parseSecretValue(line, "FINNHUB_API_KEY") ||
        parseSecretValue(line, "finnhub_api_key");
      if (value) {
        process.env.FINNHUB_API_KEY = value;
        return;
      }
    }
  }
}

function getFinnhubKey() {
  loadLocalSecrets();
  return process.env.FINNHUB_API_KEY || "";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function validateSymbol(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function dateToUnix(date) {
  return Math.floor(new Date(date + "T00:00:00Z").getTime() / 1000);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

// Parse Retry-After header value into seconds.
// Supports: decimal-seconds string ("60", "30.5"), HTTP-date string, missing/invalid → 60 s fallback.
function parseRetryAfter(header) {
  if (!header) return 60;
  const trimmed = header.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    const diff = Math.ceil((date.getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 60;
  }
  return 60;
}

async function fetchFinnhub(path, params) {
  const key = getFinnhubKey();
  if (!key) {
    return {
      statusCode: 503,
      payload: {
        ok: false,
        error: "FINNHUB_API_KEY is not configured",
      },
    };
  }

  const url = new URL(FINNHUB_BASE_URL + path);
  for (const [name, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(name, String(value));
  }
  url.searchParams.set("token", key);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      return {
        statusCode: 429,
        payload: {
          ok: false,
          error: "rate_limited",
          provider: "finnhub",
          retryAfter,
        },
      };
    }

    const data = await response.json().catch(() => ({}));
    return {
      statusCode: response.ok ? 200 : response.status,
      payload: {
        ok: response.ok,
        provider: "finnhub",
        endpoint: path,
        data,
      },
    };
  } catch (error) {
    return {
      statusCode: 502,
      payload: {
        ok: false,
        provider: "finnhub",
        endpoint: path,
        error: error.message,
      },
    };
  }
}

async function fetchYahooChart(symbol, fromDate, toDate, interval = "1d") {
  const url = new URL(`${YAHOO_CHART_BASE_URL}/${encodeURIComponent(symbol)}`);
  url.searchParams.set("period1", String(dateToUnix(fromDate)));
  url.searchParams.set("period2", String(dateToUnix(toDate) + 86400));
  url.searchParams.set("interval", interval);
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 portfolio-analytics-dashboard",
      },
    });
    const data = await response.json().catch(() => ({}));
    return {
      statusCode: response.ok ? 200 : response.status,
      payload: {
        ok: response.ok,
        provider: "yahoo",
        endpoint: "/v8/finance/chart",
        data,
      },
    };
  } catch (error) {
    return {
      statusCode: 502,
      payload: {
        ok: false,
        provider: "yahoo",
        endpoint: "/v8/finance/chart",
        error: error.message,
      },
    };
  }
}

function normalizeFinnhubCandles(symbol, data, fromDate, toDate) {
  if (!data || data.s !== "ok" || !Array.isArray(data.t)) {
    return [];
  }

  return data.t.map((time, index) => ({
    date: new Date(time * 1000).toISOString().slice(0, 10),
    open: data.o?.[index] ?? null,
    high: data.h?.[index] ?? null,
    low: data.l?.[index] ?? null,
    close: data.c?.[index] ?? null,
    volume: data.v?.[index] ?? null,
    adjClose: data.c?.[index] ?? null,
  })).filter(row =>
    row.date >= fromDate &&
    row.date <= toDate &&
    Number.isFinite(row.close)
  );
}

function normalizeYahooCandles(symbol, data, fromDate, toDate) {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  const adjClose = result?.indicators?.adjclose?.[0]?.adjclose;

  if (!Array.isArray(timestamps) || !quote) {
    return [];
  }

  return timestamps.map((time, index) => ({
    date: new Date(time * 1000).toISOString().slice(0, 10),
    open: quote.open?.[index] ?? null,
    high: quote.high?.[index] ?? null,
    low: quote.low?.[index] ?? null,
    close: quote.close?.[index] ?? null,
    volume: quote.volume?.[index] ?? null,
    adjClose: adjClose?.[index] ?? quote.close?.[index] ?? null,
  })).filter(row =>
    row.date >= fromDate &&
    row.date <= toDate &&
    Number.isFinite(row.close)
  );
}

function historyPayload({ symbol, provider, fallbackUsed, fromDate, toDate, candles, warning }) {
  return {
    ok: candles.length > 0,
    provider,
    fallbackUsed,
    symbol,
    from: fromDate,
    to: toDate,
    rows: candles.length,
    candles,
    ...(warning ? { warning } : {}),
  };
}

async function fetchHistoricalPrices(symbol, fromDate, toDate) {
  const finnhub = await fetchFinnhub("/stock/candle", {
    symbol,
    resolution: "D",
    from: dateToUnix(fromDate),
    to: dateToUnix(toDate),
  });
  const finnhubCandles = normalizeFinnhubCandles(symbol, finnhub.payload.data, fromDate, toDate);

  if (finnhub.statusCode === 200 && finnhubCandles.length > 0) {
    return {
      statusCode: 200,
      payload: historyPayload({
        symbol,
        provider: "finnhub",
        fallbackUsed: false,
        fromDate,
        toDate,
        candles: finnhubCandles,
      }),
    };
  }

  const yahoo = await fetchYahooChart(symbol, fromDate, toDate);
  const yahooCandles = normalizeYahooCandles(symbol, yahoo.payload.data, fromDate, toDate);

  if (yahoo.statusCode === 200 && yahooCandles.length > 0) {
    return {
      statusCode: 200,
      payload: historyPayload({
        symbol,
        provider: "yahoo",
        fallbackUsed: true,
        fromDate,
        toDate,
        candles: yahooCandles,
        warning: finnhub.payload.error === "rate_limited"
          ? `Finnhub rate limit reached (retry after ${finnhub.payload.retryAfter ?? 60}s); used Yahoo Finance fallback.`
          : (finnhub.payload.error || finnhub.payload.data?.error || "Finnhub candles unavailable; used Yahoo Finance fallback."),
      }),
    };
  }

  return {
    statusCode: yahoo.statusCode === 200 ? 502 : yahoo.statusCode,
    payload: {
      ok: false,
      provider: "none",
      fallbackUsed: true,
      symbol,
      from: fromDate,
      to: toDate,
      rows: 0,
      candles: [],
      error: yahoo.payload.error || yahoo.payload.data?.chart?.error?.description || "Historical prices unavailable",
      finnhubStatus: finnhub.statusCode,
      yahooStatus: yahoo.statusCode,
    },
  };
}

// Merge cache metadata into the response payload as additive fields.
// cacheStatus is always present; cachedAt and ttlSeconds are present on "hit" only.
function withCacheMeta(payload, cacheStatus, cachedAt, ttlSeconds) {
  return {
    ...payload,
    cacheStatus,
    ...(cachedAt !== undefined ? { cachedAt, ttlSeconds } : {}),
  };
}

export function createMarketDataServer() {
  const cache = createCache();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }

    if (req.method !== "GET") {
      return sendJson(res, 405, { ok: false, error: "Method not allowed" });
    }

    if (url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "market-data-proxy",
        hasFinnhubKey: Boolean(getFinnhubKey()),
        providers: {
          prices: "Finnhub stock candles with Yahoo Finance fallback",
          quote: "Finnhub quote",
          company: "Finnhub company profile2",
          news: "Finnhub company news",
        },
        timestamp: new Date().toISOString(),
        cache: cache.stats(),
      });
    }

    const symbol = validateSymbol(url.searchParams.get("symbol"));
    if (!symbol) {
      return sendJson(res, 400, { ok: false, error: "Valid symbol query parameter is required" });
    }

    if (url.pathname === "/api/market/quote") {
      const key = cache.cacheKey("quote", { symbol });
      const { statusCode, payload, cacheStatus, cachedAt, ttlSeconds } =
        await cache.getOrFetch(key, () => fetchFinnhub("/quote", { symbol }), TTL_MS.QUOTE);
      return sendJson(res, statusCode, withCacheMeta(payload, cacheStatus, cachedAt, ttlSeconds));
    }

    if (url.pathname === "/api/market/candles") {
      const resolution = url.searchParams.get("resolution") || "D";
      const toDate = url.searchParams.get("to") || todayIso();
      const fromDate = url.searchParams.get("from") || daysAgoIso(730);
      const key = cache.cacheKey("candles", { symbol, resolution, from: fromDate, to: toDate });
      const { statusCode, payload, cacheStatus, cachedAt, ttlSeconds } =
        await cache.getOrFetch(key, () => fetchFinnhub("/stock/candle", {
          symbol, resolution,
          from: dateToUnix(fromDate),
          to: dateToUnix(toDate),
        }), TTL_MS.CANDLES);
      return sendJson(res, statusCode, withCacheMeta(payload, cacheStatus, cachedAt, ttlSeconds));
    }

    if (url.pathname === "/api/market/history") {
      const toDate = url.searchParams.get("to") || todayIso();
      const fromDate = url.searchParams.get("from") || daysAgoIso(730);
      const key = cache.cacheKey("history", { symbol, from: fromDate, to: toDate });
      const { statusCode, payload, cacheStatus, cachedAt, ttlSeconds } =
        await cache.getOrFetch(key, () => fetchHistoricalPrices(symbol, fromDate, toDate), TTL_MS.HISTORY);
      return sendJson(res, statusCode, withCacheMeta(payload, cacheStatus, cachedAt, ttlSeconds));
    }

    if (url.pathname === "/api/company/profile") {
      const key = cache.cacheKey("profile", { symbol });
      const { statusCode, payload, cacheStatus, cachedAt, ttlSeconds } =
        await cache.getOrFetch(key, () => fetchFinnhub("/stock/profile2", { symbol }), TTL_MS.PROFILE);
      return sendJson(res, statusCode, withCacheMeta(payload, cacheStatus, cachedAt, ttlSeconds));
    }

    if (url.pathname === "/api/company/news") {
      const to = url.searchParams.get("to") || todayIso();
      const from = url.searchParams.get("from") || daysAgoIso(30);
      const key = cache.cacheKey("news", { symbol, from, to });
      const { statusCode, payload, cacheStatus, cachedAt, ttlSeconds } =
        await cache.getOrFetch(key, () => fetchFinnhub("/company-news", { symbol, from, to }), TTL_MS.NEWS);
      return sendJson(res, statusCode, withCacheMeta(payload, cacheStatus, cachedAt, ttlSeconds));
    }

    return sendJson(res, 404, { ok: false, error: "Endpoint not found" });
  });
}

export {
  parseRetryAfter,
  normalizeFinnhubCandles,
  normalizeYahooCandles,
  fetchHistoricalPrices,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // MARKET_DATA_PORT / PORT: override for public hosts (Render, Railway, Fly.io set PORT automatically).
  // MARKET_DATA_HOST: set to 0.0.0.0 for public deployment; defaults to 127.0.0.1 for local safety.
  const port = Number(process.env.MARKET_DATA_PORT || process.env.PORT || 8787);
  const host = process.env.MARKET_DATA_HOST || "127.0.0.1";
  createMarketDataServer().listen(port, host, () => {
    console.log(`Market data proxy listening on http://${host}:${port}`);
  });
}
