/* ============================================================
   src/portfolioBackup.js — JSON full-state backup/restore (Phase 9b).

   No dependencies; importable in both browser and Node.js.
   Exports: BACKUP_VERSION, exportBackup, importBackup, makeBackupFilename.

   The backup payload contains only user-input state:
     current holdings (including avgCost, firstBought), assumptions,
     notes, and the array of named saved portfolios.

   It intentionally excludes:
     fetched prices, candles, computed metrics, company profiles,
     company news, API status, rate-limit state, cache state, and secrets.
   ============================================================ */

export const BACKUP_VERSION = 1;

/**
 * Builds the full-state backup payload as a plain JS object.
 * The caller must JSON.stringify it and trigger the download.
 */
export function exportBackup(holdings, assumptions, notes, savedPortfolios) {
  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    current: {
      holdings: Array.isArray(holdings) ? holdings.map(h => {
        const out = { t: String(h.t), lots: Number(h.lots) };
        if (typeof h.avgCost === "number" && Number.isFinite(h.avgCost) && h.avgCost > 0) {
          out.avgCost = h.avgCost;
        }
        if (h.firstBought && typeof h.firstBought === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.firstBought)) {
          out.firstBought = h.firstBought;
        }
        return out;
      }) : [],
      assumptions: {
        rf:      Number(assumptions?.rf      ?? 0.043),
        horizon: Number(assumptions?.horizon ?? 5),
        paths:   Number(assumptions?.paths   ?? 2000),
      },
      notes: String(notes ?? "").slice(0, 500),
    },
    savedPortfolios: Array.isArray(savedPortfolios) ? savedPortfolios : [],
  };
}

/**
 * Validates and restores a parsed backup object.
 *
 * @param {object} raw   — already-parsed JSON (not the raw string)
 * @param {{ has(t: string): boolean }} validTickers  — duck-typed set
 * @returns {{ ok: true, current, savedPortfolios } | { ok: false, error: string }}
 */
export function importBackup(raw, validTickers) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_format" };
  }
  if (raw.backupVersion !== BACKUP_VERSION) {
    return { ok: false, error: "unsupported_version" };
  }
  if (!raw.current || typeof raw.current !== "object" || Array.isArray(raw.current)) {
    return { ok: false, error: "invalid_format" };
  }
  if (!Array.isArray(raw.current.holdings)) {
    return { ok: false, error: "invalid_format" };
  }

  // validate assumptions
  if (!raw.current.assumptions || typeof raw.current.assumptions !== "object") {
    return { ok: false, error: "invalid_assumptions" };
  }
  const { rf, horizon, paths } = raw.current.assumptions;
  if (typeof rf !== "number" || !Number.isFinite(rf)) {
    return { ok: false, error: "invalid_assumptions" };
  }
  if (typeof horizon !== "number" || !Number.isFinite(horizon) || horizon <= 0) {
    return { ok: false, error: "invalid_assumptions" };
  }
  if (typeof paths !== "number" || !Number.isFinite(paths) || paths <= 0) {
    return { ok: false, error: "invalid_assumptions" };
  }

  // filter and restore holdings
  const holdings = raw.current.holdings
    .filter(h =>
      h &&
      typeof h.t === "string" &&
      validTickers.has(h.t) &&
      typeof h.lots === "number" &&
      Number.isFinite(h.lots) &&
      h.lots >= 0
    )
    .map(h => {
      const out = { t: h.t, lots: h.lots };
      if (typeof h.avgCost === "number" && Number.isFinite(h.avgCost) && h.avgCost > 0) {
        out.avgCost = h.avgCost;
      }
      if (h.firstBought && typeof h.firstBought === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.firstBought)) {
        out.firstBought = h.firstBought;
      }
      return out;
    });

  if (holdings.length === 0) {
    return { ok: false, error: "no_valid_holdings" };
  }

  // filter saved portfolios — well-formedness check mirrored from portfolioStorage.js
  const rawSaved = Array.isArray(raw.savedPortfolios) ? raw.savedPortfolios : [];
  const savedPortfolios = rawSaved.filter(_isSavedPortfolioWellFormed);

  return {
    ok: true,
    current: {
      holdings,
      assumptions: { rf, horizon, paths },
      notes: String(raw.current.notes ?? "").slice(0, 500),
    },
    savedPortfolios,
  };
}

/**
 * Returns a timestamped filename for the backup download.
 * Example: "portfolio-backup-2026-06-07.json"
 */
export function makeBackupFilename() {
  return `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

// ── private helpers ──────────────────────────────────────────────────────────

// Mirrored from portfolioStorage.js — must stay in sync with SCHEMA_VERSION = 1.
const _STORAGE_SCHEMA_VERSION = 1;

function _isSavedPortfolioWellFormed(entry) {
  return (
    entry !== null &&
    typeof entry === "object" &&
    entry.schemaVersion === _STORAGE_SCHEMA_VERSION &&
    typeof entry.name === "string" &&
    entry.name.length > 0 &&
    Array.isArray(entry.holdings) &&
    typeof entry.assumptions === "object" &&
    entry.assumptions !== null
  );
}
