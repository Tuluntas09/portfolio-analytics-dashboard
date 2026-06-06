import {
  normalizeFinnhubCandles,
  normalizeYahooCandles,
} from "../server/market-data-server.mjs";

const fail = message => {
  throw new Error(message);
};

const finnhubRows = normalizeFinnhubCandles("AAPL", {
  s: "ok",
  t: [1717200000, 1717286400],
  o: [190, 191],
  h: [193, 194],
  l: [189, 190],
  c: [192, 193],
  v: [1000, 1200],
}, "2024-06-01", "2024-06-02");

if (finnhubRows.length !== 2) fail("Finnhub rows should normalize to 2 rows");
if (finnhubRows[0].date !== "2024-06-01") fail("Finnhub date normalization failed");
if (finnhubRows[0].adjClose !== 192) fail("Finnhub adjClose should mirror close");

const yahooRows = normalizeYahooCandles("AAPL", {
  chart: {
    result: [{
      timestamp: [1717200000, 1717286400],
      indicators: {
        quote: [{
          open: [190, 191],
          high: [193, 194],
          low: [189, 190],
          close: [192, 193],
          volume: [1000, 1200],
        }],
        adjclose: [{
          adjclose: [191.5, 192.5],
        }],
      },
    }],
  },
}, "2024-06-01", "2024-06-02");

if (yahooRows.length !== 2) fail("Yahoo rows should normalize to 2 rows");
if (yahooRows[1].date !== "2024-06-02") fail("Yahoo date normalization failed");
if (yahooRows[1].adjClose !== 192.5) fail("Yahoo adjClose normalization failed");

const emptyYahooRows = normalizeYahooCandles("AAPL", { chart: { result: [] } }, "2024-06-01", "2024-06-02");
if (emptyYahooRows.length !== 0) fail("Invalid Yahoo payload should normalize to empty rows");

console.log("History normalization checks passed");
