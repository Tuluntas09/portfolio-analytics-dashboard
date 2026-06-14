/* ============================================================
   src/presentationPortfolio.js — first-launch demo seed.

   Provides a small, neutral starter portfolio so the dashboard is
   not empty on a brand-new install. This is for demonstration and
   onboarding only — it is NOT investment advice, NOT a recommended
   or model portfolio, and implies nothing about these assets.

   The bootstrap is a one-time operation: it runs only when there are
   no saved portfolios AND no active state in storage. If the user
   already has any data, it does nothing and never overwrites.

   Reuses the existing storage helpers (savePortfolio, saveActiveState)
   so no storage logic is duplicated here.
   ============================================================ */

import { loadSaves, savePortfolio } from "./portfolioStorage.js";
import { loadActiveState, saveActiveState } from "./activePortfolioState.js";

// Neutral display name — see product boundary notes above.
export const PRESENTATION_PORTFOLIO_NAME = "QPA Presentation Portfolio";

// Neutral, non-advisory description used as the portfolio note.
export const PRESENTATION_PORTFOLIO_NOTE =
  "Starter portfolio for presentation and onboarding.";

// A small, balanced set of recognizable tickers already in UNIVERSE:
// broad US/international equity ETFs, an aggregate bond ETF, gold, and
// two large liquid names. Chosen only to make the dashboard non-empty
// and visually useful — not as a suggestion to hold any of these.
export const PRESENTATION_HOLDINGS = [
  { t: "VTI", lots: 80 },   // US broad market ETF
  { t: "VEA", lots: 200 },  // International developed markets ETF
  { t: "BND", lots: 150 },  // Aggregate bond ETF
  { t: "GLD", lots: 40 },   // Gold ETF
  { t: "AAPL", lots: 50 },  // Large liquid equity
  { t: "MSFT", lots: 30 },  // Large liquid equity
];

export const PRESENTATION_ASSUMPTIONS = { rf: 0.043, horizon: 5, paths: 2000 };

/**
 * One-time first-launch seed.
 *
 * If storage has no saved portfolios AND no active state, this:
 *   1. saves the starter portfolio as a named saved portfolio, and
 *   2. loads it as the active state.
 *
 * If any saved portfolio or active state already exists, it does
 * nothing — existing user data is never overwritten.
 *
 * Returns true if the starter portfolio was seeded, false otherwise.
 */
export function bootstrapPresentationPortfolio(storage = globalThis.localStorage) {
  if (!storage) return false;

  const hasSaves = loadSaves(storage).length > 0;
  const hasActiveState = loadActiveState(storage) !== null;
  if (hasSaves || hasActiveState) return false;

  savePortfolio(
    PRESENTATION_PORTFOLIO_NAME,
    PRESENTATION_HOLDINGS,
    PRESENTATION_ASSUMPTIONS,
    PRESENTATION_PORTFOLIO_NOTE,
    storage,
  );
  saveActiveState(
    PRESENTATION_HOLDINGS,
    PRESENTATION_ASSUMPTIONS,
    PRESENTATION_PORTFOLIO_NOTE,
    storage,
  );
  return true;
}
