/* ============================================================
   src/dataStatus.js — pure derivation of a plain-language
   data-source status summary.

   This module ONLY reads the status state the app already tracks
   (proxy health, market-history load status, portfolio source,
   rate-limit flag) and condenses it into stable status codes for
   the UI to translate. It does NOT change provider selection,
   Finnhub/Yahoo/mock fallback, cache, or rate-limit behavior.

   Descriptive only — no advice, signals, or recommendations.
   Returns status CODES (not localized text) so the UI maps them
   through the existing i18n system. Pure & Node-importable —
   verified by scripts/data-transparency-check.mjs.
   ============================================================ */

// Proxy reachability, from the existing apiStatus shape
// { checked, ok, hasFinnhubKey }.
//   "checking"   — health not yet resolved
//   "unavailable"— proxy did not respond ok
//   "key-missing"— proxy online but no Finnhub key configured
//   "connected"  — proxy online with key
export function proxyState(apiStatus) {
  if (!apiStatus || !apiStatus.checked) return "checking";
  if (!apiStatus.ok) return "unavailable";
  if (!apiStatus.hasFinnhubKey) return "key-missing";
  return "connected";
}

// Current data mode, from marketDataStatus and the resolved source.
//   "pending" — live history still loading
//   "live"    — all requested holdings on live history
//   "partial" — some holdings live, some on fallback
//   "mock"    — deterministic mock / offline fallback
export function sourceMode(marketDataStatus, source) {
  const s = marketDataStatus && marketDataStatus.status;
  if (s === "loading") return "pending";
  if (s === "ready") return "live";
  if (s === "partial") return "partial";
  if (source && source.id === "real") return "live";
  return "mock";
}

// Combined, UI-facing summary. rateLimited is surfaced only when the
// app has actually observed a rate_limited response (no fabrication).
export function summarizeDataStatus(state = {}) {
  const { apiStatus, marketDataStatus, source, rateLimitWarning } = state;
  return {
    proxy: proxyState(apiStatus),
    mode: sourceMode(marketDataStatus, source),
    rateLimited: !!rateLimitWarning,
  };
}
