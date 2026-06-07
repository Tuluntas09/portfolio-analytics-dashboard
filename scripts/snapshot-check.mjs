/**
 * snapshot-check.mjs — verifies src/portfolioSnapshots.js and related
 * integration points (portfolioBackup.js snapshots field).
 *
 * All snapshot functions accept an optional storage parameter so they can
 * be tested in Node.js without a real localStorage. This file provides a
 * simple in-memory makeStorage() helper for that purpose.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SNAPSHOT_VERSION,
  SNAPSHOT_KEY,
  MAX_SNAPSHOTS,
  todayIso,
  normalizeSnapshot,
  loadSnapshots,
  recordSnapshot,
  getLatestSnapshot,
  exportSnapshots,
  importSnapshots,
  calcDeltas,
} from "../src/portfolioSnapshots.js";

import {
  BACKUP_VERSION,
  exportBackup,
  importBackup,
} from "../src/portfolioBackup.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dir, "..");

let passed = 0;
const fail = msg => { throw new Error(msg); };

function check(label, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    throw new Error(`[FAIL] ${label}: ${e.message}`);
  }
}

function makeStorage() {
  const store = {};
  return {
    getItem:    k => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

// ── 1. File existence ─────────────────────────────────────────────────────────
check("src/portfolioSnapshots.js exists", () => {
  const p = path.join(root, "src", "portfolioSnapshots.js");
  if (!fs.existsSync(p)) fail("file not found");
});

// ── 2. Source text checks ─────────────────────────────────────────────────────
const snapshotSrc = fs.readFileSync(
  path.join(root, "src", "portfolioSnapshots.js"), "utf8"
);

check("SNAPSHOT_VERSION present in source", () => {
  if (!snapshotSrc.includes("SNAPSHOT_VERSION")) fail("SNAPSHOT_VERSION not found in source");
});

check("SNAPSHOT_KEY present in source", () => {
  if (!snapshotSrc.includes("SNAPSHOT_KEY")) fail("SNAPSHOT_KEY not found in source");
});

check("No FINNHUB in snapshot module source", () => {
  if (snapshotSrc.toUpperCase().includes("FINNHUB")) fail("FINNHUB must not appear in portfolioSnapshots.js");
});

check("No VITE_FINNHUB_API_KEY in snapshot module source", () => {
  if (snapshotSrc.includes("VITE_FINNHUB_API_KEY")) fail("VITE_FINNHUB_API_KEY must not appear in portfolioSnapshots.js");
});

check("No advisory language in snapshot module", () => {
  const lower = snapshotSrc.toLowerCase();
  for (const term of ["target price", "recommend"]) {
    if (lower.includes(term)) fail(`Advisory term "${term}" must not appear in portfolioSnapshots.js`);
  }
});

check("No React import in snapshot module", () => {
  if (snapshotSrc.includes('from "react"') || snapshotSrc.includes("from 'react'")) {
    fail("portfolioSnapshots.js must not import React");
  }
});

// ── 3. Constants ──────────────────────────────────────────────────────────────
check("SNAPSHOT_VERSION === 1", () => {
  if (SNAPSHOT_VERSION !== 1) fail(`Expected 1, got ${SNAPSHOT_VERSION}`);
});

check("SNAPSHOT_KEY === 'qpa-snapshots'", () => {
  if (SNAPSHOT_KEY !== "qpa-snapshots") fail(`Expected "qpa-snapshots", got ${SNAPSHOT_KEY}`);
});

check("MAX_SNAPSHOTS === 365", () => {
  if (MAX_SNAPSHOTS !== 365) fail(`Expected 365, got ${MAX_SNAPSHOTS}`);
});

// ── 4. todayIso ───────────────────────────────────────────────────────────────
check("todayIso returns YYYY-MM-DD format", () => {
  const result = todayIso(new Date("2026-06-07T12:00:00Z"));
  if (result !== "2026-06-07") fail(`Expected "2026-06-07", got "${result}"`);
});

check("todayIso with specific date", () => {
  const result = todayIso(new Date("2025-01-15T00:00:00Z"));
  if (result !== "2025-01-15") fail(`Expected "2025-01-15", got "${result}"`);
});

check("todayIso returns 10-char string", () => {
  const result = todayIso(new Date());
  if (typeof result !== "string" || result.length !== 10) fail(`Got "${result}"`);
});

// ── 5. normalizeSnapshot ──────────────────────────────────────────────────────
check("normalizeSnapshot: valid entry returns normalized", () => {
  const entry = { date: "2026-06-01", totalValue: 50000, source: "real" };
  const result = normalizeSnapshot(entry);
  if (!result) fail("Should return normalized entry");
  if (result.date !== "2026-06-01") fail("date mismatch");
  if (result.totalValue !== 50000) fail("totalValue mismatch");
  if (result.source !== "real") fail("source mismatch");
});

check("normalizeSnapshot: null returns null", () => {
  if (normalizeSnapshot(null) !== null) fail("Should return null");
});

check("normalizeSnapshot: source=mock returns null", () => {
  if (normalizeSnapshot({ date: "2026-06-01", totalValue: 1000, source: "mock" }) !== null) {
    fail("Should reject mock source");
  }
});

check("normalizeSnapshot: totalValue=0 returns null", () => {
  if (normalizeSnapshot({ date: "2026-06-01", totalValue: 0, source: "real" }) !== null) {
    fail("Should reject zero totalValue");
  }
});

check("normalizeSnapshot: totalValue negative returns null", () => {
  if (normalizeSnapshot({ date: "2026-06-01", totalValue: -100, source: "real" }) !== null) {
    fail("Should reject negative totalValue");
  }
});

check("normalizeSnapshot: totalValue NaN returns null", () => {
  if (normalizeSnapshot({ date: "2026-06-01", totalValue: NaN, source: "real" }) !== null) {
    fail("Should reject NaN totalValue");
  }
});

check("normalizeSnapshot: invalid date format returns null", () => {
  if (normalizeSnapshot({ date: "06-07-2026", totalValue: 1000, source: "real" }) !== null) {
    fail("Should reject invalid date format");
  }
});

check("normalizeSnapshot: missing source returns null", () => {
  if (normalizeSnapshot({ date: "2026-06-01", totalValue: 1000 }) !== null) {
    fail("Should reject missing source");
  }
});

check("normalizeSnapshot: non-object returns null", () => {
  if (normalizeSnapshot("string") !== null) fail("Should reject string");
  if (normalizeSnapshot(42) !== null) fail("Should reject number");
});

// ── 6. loadSnapshots ──────────────────────────────────────────────────────────
check("loadSnapshots: empty storage returns []", () => {
  const st = makeStorage();
  const result = loadSnapshots(st);
  if (!Array.isArray(result) || result.length !== 0) fail("Should return empty array");
});

check("loadSnapshots: invalid JSON returns []", () => {
  const st = makeStorage();
  st.setItem(SNAPSHOT_KEY, "not-json{{{");
  const result = loadSnapshots(st);
  if (!Array.isArray(result) || result.length !== 0) fail("Should return empty array on bad JSON");
});

check("loadSnapshots: filters mock entries", () => {
  const st = makeStorage();
  const entries = [
    { date: "2026-06-01", totalValue: 1000, source: "real" },
    { date: "2026-06-02", totalValue: 2000, source: "mock" },
  ];
  st.setItem(SNAPSHOT_KEY, JSON.stringify(entries));
  const result = loadSnapshots(st);
  if (result.length !== 1) fail(`Expected 1 entry, got ${result.length}`);
  if (result[0].source !== "real") fail("Should only include real entries");
});

check("loadSnapshots: returns sorted ascending by date", () => {
  const st = makeStorage();
  const entries = [
    { date: "2026-06-03", totalValue: 3000, source: "real" },
    { date: "2026-06-01", totalValue: 1000, source: "real" },
    { date: "2026-06-02", totalValue: 2000, source: "real" },
  ];
  st.setItem(SNAPSHOT_KEY, JSON.stringify(entries));
  const result = loadSnapshots(st);
  if (result.length !== 3) fail("Expected 3 entries");
  if (result[0].date !== "2026-06-01") fail("Should be sorted ascending");
  if (result[2].date !== "2026-06-03") fail("Last should be most recent");
});

check("loadSnapshots: non-array JSON returns []", () => {
  const st = makeStorage();
  st.setItem(SNAPSHOT_KEY, JSON.stringify({ bad: "data" }));
  const result = loadSnapshots(st);
  if (!Array.isArray(result) || result.length !== 0) fail("Should return empty array for non-array data");
});

// ── 7. recordSnapshot ─────────────────────────────────────────────────────────
check("recordSnapshot: records successfully", () => {
  const st = makeStorage();
  const date = new Date("2026-06-07T12:00:00Z");
  const result = recordSnapshot(50000, "real", st, date);
  if (!result.ok) fail(`Should succeed: ${result.reason}`);
  if (result.snapshot.date !== "2026-06-07") fail("snapshot date mismatch");
  if (result.snapshot.totalValue !== 50000) fail("snapshot totalValue mismatch");
  if (result.count !== 1) fail(`Expected count 1, got ${result.count}`);
});

check("recordSnapshot: source=mock returns {ok:false, reason:'not_real'}", () => {
  const st = makeStorage();
  const result = recordSnapshot(50000, "mock", st);
  if (result.ok) fail("Should not succeed for mock source");
  if (result.reason !== "not_real") fail(`Expected reason 'not_real', got '${result.reason}'`);
});

check("recordSnapshot: totalValue=0 returns {ok:false, reason:'invalid_value'}", () => {
  const st = makeStorage();
  const result = recordSnapshot(0, "real", st);
  if (result.ok) fail("Should not succeed for zero value");
  if (result.reason !== "invalid_value") fail(`Expected 'invalid_value', got '${result.reason}'`);
});

check("recordSnapshot: NaN value returns {ok:false}", () => {
  const st = makeStorage();
  const result = recordSnapshot(NaN, "real", st);
  if (result.ok) fail("Should reject NaN value");
});

check("recordSnapshot: same-day overwrite (idempotent)", () => {
  const st = makeStorage();
  const date = new Date("2026-06-07T12:00:00Z");
  recordSnapshot(50000, "real", st, date);
  recordSnapshot(55000, "real", st, date);
  const snaps = loadSnapshots(st);
  if (snaps.length !== 1) fail(`Expected 1 snapshot, got ${snaps.length}`);
  if (snaps[0].totalValue !== 55000) fail("Should have overwritten with new value");
});

check("recordSnapshot: prunes to MAX_SNAPSHOTS", () => {
  const st = makeStorage();
  const entries = [];
  for (let i = 0; i < MAX_SNAPSHOTS; i++) {
    const d = new Date("2023-01-01T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    entries.push({ date: d.toISOString().slice(0, 10), totalValue: 1000 + i, source: "real" });
  }
  st.setItem(SNAPSHOT_KEY, JSON.stringify(entries));
  const newDate = new Date("2025-01-10T12:00:00Z");
  const result = recordSnapshot(10000, "real", st, newDate);
  if (!result.ok) fail("Should succeed");
  const loaded = loadSnapshots(st);
  if (loaded.length !== MAX_SNAPSHOTS) fail(`Expected ${MAX_SNAPSHOTS}, got ${loaded.length}`);
  if (loaded[0].date === "2023-01-01") fail("Oldest entry should have been pruned");
});

check("recordSnapshot: returns {ok, snapshot, count}", () => {
  const st = makeStorage();
  const date = new Date("2026-06-07T00:00:00Z");
  const result = recordSnapshot(75000, "real", st, date);
  if (!result.ok) fail("Should succeed");
  if (typeof result.count !== "number") fail("count must be a number");
  if (!result.snapshot || typeof result.snapshot.date !== "string") fail("snapshot.date must be string");
  if (typeof result.snapshot.totalValue !== "number") fail("snapshot.totalValue must be number");
});

check("recordSnapshot: negative value returns {ok:false}", () => {
  const st = makeStorage();
  const result = recordSnapshot(-100, "real", st);
  if (result.ok) fail("Should reject negative value");
  if (result.reason !== "invalid_value") fail(`Expected 'invalid_value', got '${result.reason}'`);
});

// ── 8. getLatestSnapshot ──────────────────────────────────────────────────────
check("getLatestSnapshot: returns most recent", () => {
  const st = makeStorage();
  recordSnapshot(1000, "real", st, new Date("2026-06-01T00:00:00Z"));
  recordSnapshot(2000, "real", st, new Date("2026-06-05T00:00:00Z"));
  const latest = getLatestSnapshot(st);
  if (!latest) fail("Should return a snapshot");
  if (latest.date !== "2026-06-05") fail(`Expected 2026-06-05, got ${latest.date}`);
  if (latest.totalValue !== 2000) fail("Should return most recent value");
});

check("getLatestSnapshot: returns null for empty storage", () => {
  const st = makeStorage();
  const result = getLatestSnapshot(st);
  if (result !== null) fail("Should return null for empty storage");
});

// ── 9. exportSnapshots ───────────────────────────────────────────────────────
check("exportSnapshots: returns valid array", () => {
  const st = makeStorage();
  recordSnapshot(50000, "real", st, new Date("2026-06-01T00:00:00Z"));
  recordSnapshot(55000, "real", st, new Date("2026-06-07T00:00:00Z"));
  const result = exportSnapshots(st);
  if (!Array.isArray(result)) fail("Should return array");
  if (result.length !== 2) fail(`Expected 2, got ${result.length}`);
  if (result[0].source !== "real") fail("Entries should have source=real");
});

check("exportSnapshots: returns empty array when no snapshots", () => {
  const st = makeStorage();
  const result = exportSnapshots(st);
  if (!Array.isArray(result) || result.length !== 0) fail("Should return empty array");
});

// ── 10. importSnapshots ───────────────────────────────────────────────────────
check("importSnapshots: imports valid array", () => {
  const st = makeStorage();
  const data = [
    { date: "2026-05-01", totalValue: 45000, source: "real" },
    { date: "2026-06-01", totalValue: 50000, source: "real" },
  ];
  const result = importSnapshots(data, st);
  if (!result.ok) fail("Should succeed");
  if (result.count !== 2) fail(`Expected count 2, got ${result.count}`);
  const loaded = loadSnapshots(st);
  if (loaded.length !== 2) fail(`Expected 2 loaded, got ${loaded.length}`);
});

check("importSnapshots: non-array returns {ok:false, count:0}", () => {
  const st = makeStorage();
  const result = importSnapshots("not an array", st);
  if (result.ok) fail("Should fail for non-array");
  if (result.count !== 0) fail(`Expected count 0, got ${result.count}`);
});

check("importSnapshots: null returns {ok:false, count:0}", () => {
  const st = makeStorage();
  const result = importSnapshots(null, st);
  if (result.ok) fail("Should fail for null");
  if (result.count !== 0) fail("count should be 0");
});

check("importSnapshots: filters invalid entries", () => {
  const st = makeStorage();
  const data = [
    { date: "2026-05-01", totalValue: 45000, source: "real" },
    { date: "2026-06-01", totalValue: 0, source: "real" },
    { date: "2026-06-02", totalValue: 5000, source: "mock" },
    { date: "bad-date", totalValue: 1000, source: "real" },
  ];
  const result = importSnapshots(data, st);
  if (!result.ok) fail("Should succeed with partial data");
  if (result.count !== 1) fail(`Expected 1 valid entry, got ${result.count}`);
});

// ── 11. calcDeltas ────────────────────────────────────────────────────────────
check("calcDeltas: empty snapshots returns all nulls", () => {
  const result = calcDeltas([], 50000);
  if (result.wow !== null || result.mom !== null || result.ytd !== null || result.inception !== null) {
    fail("All deltas should be null for empty snapshots");
  }
});

check("calcDeltas: invalid todayValue (NaN) returns all nulls", () => {
  const snaps = [{ date: "2026-06-01", totalValue: 50000, source: "real" }];
  const result = calcDeltas(snaps, NaN);
  if (result.wow !== null || result.mom !== null || result.ytd !== null || result.inception !== null) {
    fail("All deltas should be null for NaN todayValue");
  }
});

check("calcDeltas: todayValue=0 returns all nulls", () => {
  const snaps = [{ date: "2026-06-01", totalValue: 50000, source: "real" }];
  const result = calcDeltas(snaps, 0);
  if (result.wow !== null || result.mom !== null || result.ytd !== null || result.inception !== null) {
    fail("All deltas should be null for zero todayValue");
  }
});

check("calcDeltas: WoW delta calculation", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [
    { date: "2026-05-31", totalValue: 58000, source: "real" }, // exactly 7 days ago
  ];
  const result = calcDeltas(snaps, 60000, today);
  if (result.wow === null) fail("WoW should not be null");
  if (Math.abs(result.wow.value - 2000) > 0.01) fail(`Expected value 2000, got ${result.wow.value}`);
  if (Math.abs(result.wow.pct - 2000 / 58000) > 1e-6) fail(`WoW pct mismatch`);
});

check("calcDeltas: MoM delta calculation", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [
    { date: "2026-05-08", totalValue: 55000, source: "real" }, // ~30 days ago
  ];
  const result = calcDeltas(snaps, 60000, today);
  if (result.mom === null) fail("MoM should not be null");
  if (Math.abs(result.mom.value - 5000) > 0.01) fail(`Expected value 5000, got ${result.mom.value}`);
  if (Math.abs(result.mom.pct - 5000 / 55000) > 1e-6) fail(`MoM pct mismatch`);
});

check("calcDeltas: YTD delta calculation", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [
    { date: "2026-01-02", totalValue: 52000, source: "real" }, // close to Jan 1
  ];
  const result = calcDeltas(snaps, 60000, today);
  if (result.ytd === null) fail("YTD should not be null");
  if (Math.abs(result.ytd.value - 8000) > 0.01) fail(`Expected YTD value 8000, got ${result.ytd.value}`);
});

check("calcDeltas: inception delta calculation", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [
    { date: "2025-12-15", totalValue: 50000, source: "real" }, // oldest
    { date: "2026-05-31", totalValue: 58000, source: "real" },
  ];
  const result = calcDeltas(snaps, 60000, today);
  if (result.inception === null) fail("inception should not be null");
  if (Math.abs(result.inception.value - 10000) > 0.01) fail(`Expected inception value 10000, got ${result.inception.value}`);
  if (Math.abs(result.inception.pct - 10000 / 50000) > 1e-6) fail(`inception pct mismatch`);
});

check("calcDeltas: inception returns null when oldest === today", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [
    { date: "2026-06-07", totalValue: 60000, source: "real" }, // only today
  ];
  const result = calcDeltas(snaps, 60000, today);
  if (result.inception !== null) fail("inception should be null when only snapshot is from today");
});

check("calcDeltas: WoW returns null when no snapshot within tolerance", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [
    { date: "2026-05-27", totalValue: 57000, source: "real" }, // 11 days ago — outside ±3d tolerance
  ];
  const result = calcDeltas(snaps, 60000, today);
  if (result.wow !== null) fail("WoW should be null when no snapshot within ±3d of target");
});

check("calcDeltas: all four deltas from multi-entry snapshots", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [
    { date: "2025-12-15", totalValue: 50000, source: "real" },
    { date: "2026-01-02", totalValue: 52000, source: "real" },
    { date: "2026-05-08", totalValue: 55000, source: "real" },
    { date: "2026-05-31", totalValue: 58000, source: "real" },
  ];
  const result = calcDeltas(snaps, 60000, today);
  if (!result.wow)       fail("WoW should be non-null");
  if (!result.mom)       fail("MoM should be non-null");
  if (!result.ytd)       fail("YTD should be non-null");
  if (!result.inception) fail("inception should be non-null");
});

check("calcDeltas: pct is correct ratio", () => {
  const today = new Date("2026-06-07T12:00:00Z");
  const snaps = [{ date: "2025-12-15", totalValue: 50000, source: "real" }];
  const result = calcDeltas(snaps, 60000, today);
  if (!result.inception) fail("Should have inception");
  const expectedPct = (60000 - 50000) / 50000;
  if (Math.abs(result.inception.pct - expectedPct) > 1e-9) {
    fail(`pct should be ${expectedPct}, got ${result.inception.pct}`);
  }
});

// ── 12. Backup integration ────────────────────────────────────────────────────
check("exportBackup: includes snapshots field", () => {
  const snaps = [{ date: "2026-06-01", totalValue: 50000, source: "real" }];
  const payload = exportBackup([], { rf: 0.043, horizon: 5, paths: 2000 }, "", [], snaps);
  if (!("snapshots" in payload)) fail("exportBackup payload must have snapshots field");
  if (!Array.isArray(payload.snapshots)) fail("snapshots must be an array");
  if (payload.snapshots.length !== 1) fail(`Expected 1 snapshot, got ${payload.snapshots.length}`);
});

check("exportBackup: snapshots defaults to []", () => {
  const holding = [{ t: "AAPL", lots: 10 }];
  const payload = exportBackup(holding, { rf: 0.043, horizon: 5, paths: 2000 }, "", []);
  if (!("snapshots" in payload)) fail("snapshots field must exist even when not passed");
  if (!Array.isArray(payload.snapshots) || payload.snapshots.length !== 0) {
    fail("snapshots should default to empty array");
  }
});

check("importBackup: returns snapshots from backup", () => {
  const snaps = [{ date: "2026-06-01", totalValue: 50000, source: "real" }];
  const payload = exportBackup(
    [{ t: "AAPL", lots: 10 }],
    { rf: 0.043, horizon: 5, paths: 2000 },
    "",
    [],
    snaps
  );
  const validTickers = { has: tkr => tkr === "AAPL" };
  const result = importBackup(payload, validTickers);
  if (!result.ok) fail(`importBackup should succeed: ${result.error}`);
  if (!Array.isArray(result.snapshots)) fail("result.snapshots must be an array");
  if (result.snapshots.length !== 1) fail(`Expected 1 snapshot, got ${result.snapshots.length}`);
});

check("importBackup: handles missing snapshots field (backward compat)", () => {
  const payload = {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    current: {
      holdings: [{ t: "AAPL", lots: 10 }],
      assumptions: { rf: 0.043, horizon: 5, paths: 2000 },
      notes: "",
    },
    savedPortfolios: [],
    // no snapshots field intentionally
  };
  const validTickers = { has: tkr => tkr === "AAPL" };
  const result = importBackup(payload, validTickers);
  if (!result.ok) fail(`importBackup should succeed: ${result.error}`);
  if (!Array.isArray(result.snapshots)) fail("result.snapshots must be array even when field is absent");
  if (result.snapshots.length !== 0) fail("result.snapshots should be [] when field absent");
});

check("importSnapshots: round-trip preserves entries", () => {
  const st = makeStorage();
  const original = [
    { date: "2026-05-01", totalValue: 45000, source: "real" },
    { date: "2026-06-01", totalValue: 55000, source: "real" },
  ];
  importSnapshots(original, st);
  const exported = exportSnapshots(st);
  if (exported.length !== 2) fail("Round-trip should preserve 2 entries");
  if (exported[0].date !== "2026-05-01") fail("First entry date mismatch");
  if (exported[1].totalValue !== 55000) fail("Second entry value mismatch");
});

// ── Final ─────────────────────────────────────────────────────────────────────
console.log(`snapshot checks passed (${passed} tests)`);
