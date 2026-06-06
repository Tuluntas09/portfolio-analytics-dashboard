import { createMarketDataServer } from "../server/market-data-server.mjs";

const fail = message => {
  throw new Error(message);
};

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
