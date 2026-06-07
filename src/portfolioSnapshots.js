/* ============================================================
   src/portfolioSnapshots.js — portfolio value daily snapshots (Phase 10a).

   Standalone pure module. No React imports.
   Optional injected storage via storage parameter (defaults to localStorage).
   Importable by Node.js tests via a makeStorage() in-memory mock.

   Exports: SNAPSHOT_VERSION, SNAPSHOT_KEY, MAX_SNAPSHOTS,
            todayIso, normalizeSnapshot, loadSnapshots, recordSnapshot,
            getLatestSnapshot, exportSnapshots, importSnapshots, calcDeltas.

   Recording policy:
     - Only source === "real" entries are stored.
     - totalValue must be > 0 and finite.
     - Same calendar day is overwritten (idempotent).
     - Oldest entries pruned to keep at most MAX_SNAPSHOTS entries.
   ============================================================ */

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_KEY = "qpa-snapshots";
export const MAX_SNAPSHOTS = 365;

export function todayIso(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function normalizeSnapshot(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (entry.source !== "real") return null;
  if (typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return null;
  if (typeof entry.totalValue !== "number" || !Number.isFinite(entry.totalValue) || entry.totalValue <= 0) return null;
  return { date: entry.date, totalValue: entry.totalValue, source: "real" };
}

export function loadSnapshots(storage = localStorage) {
  try {
    const raw = storage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeSnapshot)
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function recordSnapshot(totalValue, source, storage = localStorage, date = new Date()) {
  if (source !== "real") return { ok: false, reason: "not_real" };
  if (typeof totalValue !== "number" || !Number.isFinite(totalValue) || totalValue <= 0) {
    return { ok: false, reason: "invalid_value" };
  }

  const dateStr = todayIso(date);
  const existing = loadSnapshots(storage);
  const filtered = existing.filter(s => s.date !== dateStr);
  filtered.push({ date: dateStr, totalValue, source: "real" });

  const sorted = filtered
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_SNAPSHOTS);

  try {
    storage.setItem(SNAPSHOT_KEY, JSON.stringify(sorted));
  } catch {
    return { ok: false, reason: "storage_error" };
  }

  return { ok: true, snapshot: { date: dateStr, totalValue, source: "real" }, count: sorted.length };
}

export function getLatestSnapshot(storage = localStorage) {
  const snaps = loadSnapshots(storage);
  return snaps.length > 0 ? snaps[snaps.length - 1] : null;
}

export function exportSnapshots(storage = localStorage) {
  return loadSnapshots(storage);
}

export function importSnapshots(raw, storage = localStorage) {
  if (!Array.isArray(raw)) return { ok: false, count: 0 };

  const valid = raw
    .map(normalizeSnapshot)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_SNAPSHOTS);

  try {
    storage.setItem(SNAPSHOT_KEY, JSON.stringify(valid));
  } catch {
    return { ok: false, count: 0 };
  }

  return { ok: true, count: valid.length };
}

function _daysDiff(isoA, isoB) {
  const a = new Date(isoA + "T00:00:00Z");
  const b = new Date(isoB + "T00:00:00Z");
  return Math.round((a - b) / 86400000);
}

function _addDays(isoStr, days) {
  const d = new Date(isoStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function calcDeltas(snapshots, todayValue, todayDate = new Date()) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { wow: null, mom: null, ytd: null, inception: null };
  }
  if (typeof todayValue !== "number" || !Number.isFinite(todayValue) || todayValue <= 0) {
    return { wow: null, mom: null, ytd: null, inception: null };
  }

  const todayStr = todayIso(todayDate);

  function makeDelta(anchor) {
    if (!anchor) return null;
    const absValue = todayValue - anchor.totalValue;
    return { value: absValue, pct: absValue / anchor.totalValue };
  }

  function findClosest(targetIso, maxDaysDiff) {
    let best = null;
    let bestDiff = Infinity;
    for (const s of snapshots) {
      if (s.date >= todayStr) continue;
      const diff = Math.abs(_daysDiff(s.date, targetIso));
      if (diff <= maxDaysDiff && diff < bestDiff) {
        bestDiff = diff;
        best = s;
      }
    }
    return best;
  }

  const wowAnchor = findClosest(_addDays(todayStr, -7), 3);
  const momAnchor = findClosest(_addDays(todayStr, -30), 5);

  const year = todayDate.getUTCFullYear();
  const jan1 = `${year}-01-01`;
  let ytdAnchor = null;
  let ytdBestDiff = Infinity;
  for (const s of snapshots) {
    if (s.date >= todayStr) continue;
    const diff = Math.abs(_daysDiff(s.date, jan1));
    if (diff < ytdBestDiff) {
      ytdBestDiff = diff;
      ytdAnchor = s;
    }
  }

  const inceptionAnchor = snapshots.find(s => s.date < todayStr) || null;

  return {
    wow: makeDelta(wowAnchor),
    mom: makeDelta(momAnchor),
    ytd: makeDelta(ytdAnchor),
    inception: makeDelta(inceptionAnchor),
  };
}
