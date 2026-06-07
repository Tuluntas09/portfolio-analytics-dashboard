/* ============================================================
   src/portfolioStorage.js — Pure localStorage helpers for the
   named saved portfolios feature (Phase 8b-1).

   No dependencies; importable in both browser and Node.js.
   The optional `storage` parameter enables test injection so
   tests can pass a mock object without touching globalThis.localStorage.

   Schema: { schemaVersion, name, holdings, assumptions, savedAt }
   Only user-input state is persisted — no quotes, history,
   analytics results, company data, or API state.
   ============================================================ */

export const STORAGE_KEY = "qpa-portfolios";
export const SCHEMA_VERSION = 1;
export const MAX_SAVES = 10;

// Returns the list of well-formed saves, or [] on any error.
export function loadSaves(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWellFormed);
  } catch {
    return [];
  }
}

// Persists the current portfolio under `name`.
// Overwrites silently if a save with that name already exists.
// Returns { ok: true } or { ok: false, error: string }.
export function savePortfolio(name, holdings, assumptions, notes = "", storage = globalThis.localStorage) {
  if (!storage) return { ok: false, error: "storage_error" };

  const trimmed = sanitizeName(name);
  if (!trimmed) return { ok: false, error: "empty_name" };

  const existing = loadSaves(storage);
  const idx = existing.findIndex(e => e.name === trimmed);

  const entry = {
    schemaVersion: SCHEMA_VERSION,
    name: trimmed,
    holdings: holdings.map(h => {
      const saved = { t: String(h.t), lots: Number(h.lots) };
      if (typeof h.avgCost === "number" && Number.isFinite(h.avgCost) && h.avgCost > 0) {
        saved.avgCost = h.avgCost;
      }
      if (h.firstBought && typeof h.firstBought === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.firstBought)) {
        saved.firstBought = h.firstBought;
      }
      return saved;
    }),
    assumptions: {
      rf: Number(assumptions.rf),
      horizon: Number(assumptions.horizon),
      paths: Number(assumptions.paths),
    },
    notes: String(notes ?? "").slice(0, 500),
    savedAt: new Date().toISOString(),
  };

  let next;
  if (idx >= 0) {
    next = existing.slice();
    next[idx] = entry;
  } else {
    if (existing.length >= MAX_SAVES) return { ok: false, error: "max_reached" };
    next = [...existing, entry];
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false, error: "storage_error" };
  }
}

// Removes the save with the given name.
// Returns { ok: true } or { ok: false, error: string }.
export function deletePortfolio(name, storage = globalThis.localStorage) {
  if (!storage) return { ok: false, error: "storage_error" };
  try {
    const next = loadSaves(storage).filter(e => e.name !== name);
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false, error: "storage_error" };
  }
}

// Validates a saved entry against the allowed ticker set.
// Returns sanitized { holdings, assumptions } or null if invalid / unknown schema.
// Unknown schemaVersion returns null so stale/future entries are ignored safely.
export function validateEntry(entry, validTickers) {
  if (!entry || entry.schemaVersion !== SCHEMA_VERSION) return null;
  if (!Array.isArray(entry.holdings)) return null;
  if (!entry.assumptions || typeof entry.assumptions !== "object") return null;

  const holdings = entry.holdings.filter(h =>
    h &&
    typeof h.t === "string" &&
    validTickers.has(h.t) &&
    typeof h.lots === "number" &&
    Number.isFinite(h.lots) &&
    h.lots >= 0
  );
  if (holdings.length === 0) return null;

  const { rf, horizon, paths } = entry.assumptions;
  if (typeof rf !== "number" || !Number.isFinite(rf)) return null;
  if (typeof horizon !== "number" || !Number.isFinite(horizon) || horizon <= 0) return null;
  if (typeof paths !== "number" || !Number.isFinite(paths) || paths <= 0) return null;

  return {
    holdings: holdings.map(h => {
      const restored = { t: h.t, lots: h.lots };
      if (typeof h.avgCost === "number" && Number.isFinite(h.avgCost) && h.avgCost > 0) {
        restored.avgCost = h.avgCost;
      }
      if (h.firstBought && typeof h.firstBought === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.firstBought)) {
        restored.firstBought = h.firstBought;
      }
      return restored;
    }),
    assumptions: { rf, horizon, paths },
    notes: String(entry.notes ?? "").slice(0, 500),
  };
}

// Strips HTML injection characters and trims. Caps at 60 chars.
function sanitizeName(raw) {
  return String(raw)
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/&/g, "")
    .trim()
    .slice(0, 60);
}

// Returns true only if the entry has the required well-formed shape.
function isWellFormed(entry) {
  return (
    entry !== null &&
    typeof entry === "object" &&
    entry.schemaVersion === SCHEMA_VERSION &&
    typeof entry.name === "string" &&
    entry.name.length > 0 &&
    Array.isArray(entry.holdings) &&
    typeof entry.assumptions === "object" &&
    entry.assumptions !== null
  );
}
