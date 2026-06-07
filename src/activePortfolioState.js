/* ============================================================
   src/activePortfolioState.js — active working portfolio persistence (Phase 10b).

   Standalone pure module. No React imports. No browser-only APIs
   except optional injected storage (defaults to globalThis.localStorage).
   Importable by Node.js tests via makeStorage() mock.

   Storage key: qpa-active-state
   Schema version: 1

   Persists: holdings (with avgCost, firstBought), assumptions, notes.
   Does NOT persist: fetched prices, history candles, computed metrics,
   company data, API status, rate-limit state, snapshots, secrets.
   ============================================================ */

export const ACTIVE_STATE_KEY = "qpa-active-state";
export const ACTIVE_STATE_VERSION = 1;

function _isValidTicker(str) {
  return typeof str === "string" && /^[A-Z0-9.]{1,8}$/.test(str.trim());
}

/**
 * Saves the current working portfolio state to storage.
 * Returns { ok: true, savedAt: string } or { ok: false, reason: string }.
 */
export function saveActiveState(holdings, assumptions, notes, storage = globalThis.localStorage) {
  if (!storage) return { ok: false, reason: "no_storage" };

  const payload = {
    schemaVersion: ACTIVE_STATE_VERSION,
    savedAt: new Date().toISOString(),
    holdings: Array.isArray(holdings)
      ? holdings
          .filter(h =>
            h &&
            _isValidTicker(h.t) &&
            typeof h.lots === "number" &&
            Number.isFinite(h.lots) &&
            h.lots >= 0
          )
          .map(h => {
            const out = { t: String(h.t), lots: Number(h.lots) };
            if (typeof h.avgCost === "number" && Number.isFinite(h.avgCost) && h.avgCost > 0) {
              out.avgCost = h.avgCost;
            }
            if (
              h.firstBought &&
              typeof h.firstBought === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(h.firstBought)
            ) {
              out.firstBought = h.firstBought;
            }
            return out;
          })
      : [],
    assumptions: {
      rf:      Number(assumptions?.rf      ?? 0.043),
      horizon: Number(assumptions?.horizon ?? 5),
      paths:   Number(assumptions?.paths   ?? 2000),
    },
    notes: String(notes ?? "").slice(0, 500),
  };

  try {
    storage.setItem(ACTIVE_STATE_KEY, JSON.stringify(payload));
    return { ok: true, savedAt: payload.savedAt };
  } catch {
    return { ok: false, reason: "storage_error" };
  }
}

/**
 * Loads and validates the saved active state.
 * Returns { holdings, assumptions, notes, savedAt } or null on any error.
 */
export function loadActiveState(storage = globalThis.localStorage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (parsed.schemaVersion !== ACTIVE_STATE_VERSION) return null;
    if (!Array.isArray(parsed.holdings)) return null;
    if (!parsed.assumptions || typeof parsed.assumptions !== "object") return null;

    const { rf, horizon, paths } = parsed.assumptions;
    if (typeof rf !== "number" || !Number.isFinite(rf)) return null;
    if (typeof horizon !== "number" || !Number.isFinite(horizon) || horizon <= 0) return null;
    if (typeof paths !== "number" || !Number.isFinite(paths) || paths <= 0) return null;

    const holdings = parsed.holdings
      .filter(h =>
        h &&
        _isValidTicker(h.t) &&
        typeof h.lots === "number" &&
        Number.isFinite(h.lots) &&
        h.lots >= 0
      )
      .map(h => {
        const restored = { t: h.t, lots: h.lots };
        if (typeof h.avgCost === "number" && Number.isFinite(h.avgCost) && h.avgCost > 0) {
          restored.avgCost = h.avgCost;
        }
        if (
          h.firstBought &&
          typeof h.firstBought === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(h.firstBought)
        ) {
          restored.firstBought = h.firstBought;
        }
        return restored;
      });

    return {
      holdings,
      assumptions: { rf, horizon, paths },
      notes: String(parsed.notes ?? "").slice(0, 500),
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
    };
  } catch {
    return null;
  }
}

/**
 * Removes the saved active state from storage.
 */
export function clearActiveState(storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.removeItem(ACTIVE_STATE_KEY);
  } catch {
    // ignore
  }
}
