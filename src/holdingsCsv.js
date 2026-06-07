/* ============================================================
   src/holdingsCsv.js — Pure CSV import/export helpers (Phase 8a).

   No dependencies; importable in both browser and Node.js.
   Only parseHoldingsCsv and serializeHoldingsCsv are exported.
   Browser-side download is handled by the caller (app.jsx).
   ============================================================ */

export const CSV_HEADER = "ticker,lots";

/**
 * Parses CSV text into holdings.
 *
 * Accepted format:
 *   ticker,lots          (header row optional)
 *   AAPL,10
 *   MSFT,5.5
 *
 * Rules:
 *   - Splits on newlines (LF or CRLF).
 *   - Ignores empty lines.
 *   - Trims cells before processing.
 *   - Normalizes ticker to uppercase.
 *   - Aggregates duplicate valid tickers (lots are summed).
 *   - Accepts only tickers present in supportedTickers.
 *   - Rejects lots that are zero, negative, NaN, Infinity, or non-numeric.
 *   - Header row ("ticker,lots") is detected by first cell and skipped.
 *
 * @param {string} csvText - Raw CSV string from a file read.
 * @param {Set<string>} supportedTickers - Uppercase ticker symbols in UNIVERSE.
 * @returns {{ holdings, importedCount, unsupportedTickers, invalidRows }}
 */
export function parseHoldingsCsv(csvText, supportedTickers) {
  const lines = String(csvText).split(/\r?\n/);
  const accumulator = {};          // ticker → aggregated lots
  const unsupportedSet = new Set();
  let invalidRows = 0;
  let headerSkipped = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 2) { invalidRows++; continue; }

    const rawTicker = parts[0].trim();
    const rawLots   = parts[1].trim();

    // Skip header row (matched by first cell being "ticker", case-insensitive).
    if (!headerSkipped && rawTicker.toLowerCase() === "ticker") {
      headerSkipped = true;
      continue;
    }

    const ticker = rawTicker.toUpperCase();
    const lots   = parseFloat(rawLots);

    // Validate lots: must be a finite positive number.
    if (!rawLots || !Number.isFinite(lots) || lots <= 0) {
      invalidRows++;
      continue;
    }

    // Validate ticker: must exist in the supported universe.
    if (!supportedTickers.has(ticker)) {
      unsupportedSet.add(ticker);
      continue;
    }

    // Aggregate duplicates.
    accumulator[ticker] = (accumulator[ticker] || 0) + lots;
  }

  const holdings = Object.entries(accumulator).map(([t, lots]) => ({ t, lots }));

  return {
    holdings,
    importedCount: holdings.length,
    unsupportedTickers: [...unsupportedSet],
    invalidRows,
  };
}

/**
 * Serializes current holdings to CSV text (header row included).
 * Only exports ticker and lots — no prices, metrics, or other state.
 *
 * @param {Array<{t: string, lots: number}>} holdings
 * @returns {string}
 */
export function serializeHoldingsCsv(holdings) {
  const rows = [CSV_HEADER, ...holdings.map(h => `${h.t},${h.lots}`)];
  return rows.join("\n");
}
