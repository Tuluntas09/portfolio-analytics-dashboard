/**
 * scripts/notes-check.mjs — Phase 8f: portfolio notes tests
 * Node.js source-text + import-based checks. No DOM, no JSX parsing.
 * Run: node scripts/notes-check.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

let passed = 0;
let failed = 0;
function ok(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}`); failed++; }
}

const storageSrc = readFileSync(join(root, "src/portfolioStorage.js"), "utf8");
const appSrc     = readFileSync(join(root, "src/app.jsx"),             "utf8");
const sidebarSrc = readFileSync(join(root, "src/sidebar.jsx"),         "utf8");
const uiSrc      = readFileSync(join(root, "src/ui.js"),               "utf8");

import {
  loadSaves, savePortfolio, validateEntry,
  STORAGE_KEY, SCHEMA_VERSION,
} from "../src/portfolioStorage.js";

// ── helpers ──────────────────────────────────────────────────────────────────
function makeStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    getItem:    key      => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem:    (key, v) => { data[key] = v; },
    removeItem: key      => { delete data[key]; },
    _data:      data,
  };
}

const HOLDINGS  = [{ t: "AAPL", lots: 10 }];
const ASSUMPS   = { rf: 0.043, horizon: 5, paths: 2000 };
const VALID_SET = { has: t => ["AAPL", "MSFT", "VTI"].includes(t) };

// ═══════════════════════════════════════════════════════════════════════════
// 1. savePortfolio — notes persistence
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsavePortfolio — notes");

{
  const s = makeStorage();
  const r = savePortfolio("NoteTest", HOLDINGS, ASSUMPS, "my note", s);
  ok("savePortfolio with notes returns ok:true",    r.ok === true);
  const saves = loadSaves(s);
  ok("saved entry includes notes field",            typeof saves[0]?.notes === "string");
  ok("notes value serialized correctly",            saves[0]?.notes === "my note");
}

{
  const s = makeStorage();
  savePortfolio("EmptyNote", HOLDINGS, ASSUMPS, "", s);
  ok("empty notes serializes as empty string",      loadSaves(s)[0]?.notes === "");
}

{
  const s = makeStorage();
  savePortfolio("DefaultNote", HOLDINGS, ASSUMPS, undefined, s);
  ok("undefined notes defaults to empty string",   loadSaves(s)[0]?.notes === "");
}

{
  const longNote = "x".repeat(600);
  const s = makeStorage();
  savePortfolio("LongNote", HOLDINGS, ASSUMPS, longNote, s);
  const saved = loadSaves(s)[0];
  ok("notes capped at 500 chars on write",          saved?.notes?.length === 500);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. loadSaves — backward compatibility
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nloadSaves — backward compatibility");

{
  const oldEntry = JSON.stringify([{
    schemaVersion: SCHEMA_VERSION,
    name: "OldFormat",
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: ASSUMPS,
    savedAt: new Date().toISOString(),
  }]);
  const s = makeStorage({ [STORAGE_KEY]: oldEntry });
  const saves = loadSaves(s);
  ok("old saved entry without notes loads (not filtered)", saves.length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. validateEntry — notes pass-through and backward compat
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nvalidateEntry — notes");

{
  const entry = {
    schemaVersion: SCHEMA_VERSION,
    name: "Test",
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: ASSUMPS,
    notes: "thesis here",
    savedAt: new Date().toISOString(),
  };
  const loaded = validateEntry(entry, VALID_SET);
  ok("validateEntry passes through notes",          loaded?.notes === "thesis here");
}

{
  const entry = {
    schemaVersion: SCHEMA_VERSION,
    name: "NoNotes",
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: ASSUMPS,
    savedAt: new Date().toISOString(),
  };
  const loaded = validateEntry(entry, VALID_SET);
  ok("validateEntry returns notes:'' when field absent", loaded?.notes === "");
}

{
  const entry = {
    schemaVersion: SCHEMA_VERSION,
    name: "BadNotes",
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: ASSUMPS,
    notes: 12345,
    savedAt: new Date().toISOString(),
  };
  let loaded;
  try { loaded = validateEntry(entry, VALID_SET); } catch { loaded = null; }
  ok("malformed non-string notes coerced, does not crash", loaded !== null && typeof loaded?.notes === "string");
}

{
  const longEntry = {
    schemaVersion: SCHEMA_VERSION,
    name: "LongNoteEntry",
    holdings: [{ t: "AAPL", lots: 10 }],
    assumptions: ASSUMPS,
    notes: "y".repeat(600),
    savedAt: new Date().toISOString(),
  };
  const loaded = validateEntry(longEntry, VALID_SET);
  ok("validateEntry caps notes at 500 on load",     loaded?.notes?.length === 500);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. app.jsx — state, handlers, props
// ═══════════════════════════════════════════════════════════════════════════
console.log("\napp.jsx — notes wiring");

ok("portfolioNote state defined",
   appSrc.includes("portfolioNote") && appSrc.includes("setPortfolioNote"));
ok("portfolioNote initialized to empty string",
   appSrc.includes('useState("")') || appSrc.match(/portfolioNote[^=]*=\s*useState\(["']["']\)/) !== null
   || appSrc.includes('useState("")'));
ok("handleSavePortfolio passes portfolioNote to savePortfolio",
   appSrc.includes("savePortfolio(name, holdings, assumptions, portfolioNote)"));
ok("handleLoadPortfolio restores portfolioNote",
   appSrc.includes("setPortfolioNote(loaded.notes ?? \"\")") ||
   appSrc.includes("setPortfolioNote(loaded.notes ?? '')"));
ok("handleResetPortfolio clears portfolioNote",
   appSrc.match(/handleResetPortfolio[\s\S]{0,300}setPortfolioNote\(["']["']\)/) !== null);
ok("portfolioNote prop passed to Sidebar",
   appSrc.includes("portfolioNote={portfolioNote}"));
ok("setPortfolioNote prop passed to Sidebar",
   appSrc.includes("setPortfolioNote={setPortfolioNote}"));

// ═══════════════════════════════════════════════════════════════════════════
// 5. sidebar.jsx — notes UI
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nsidebar.jsx — notes UI");

ok("sidebar.jsx renders a textarea",         sidebarSrc.includes("<textarea"));
ok("maxLength={500} on textarea",            sidebarSrc.includes("maxLength={500}"));
ok("portfolioNote is the controlled value",  sidebarSrc.includes("value={portfolioNote}"));
ok("setPortfolioNote used in onChange",      sidebarSrc.includes("setPortfolioNote(e.target.value)"));
ok("character counter renders portfolioNote.length",
   sidebarSrc.includes("portfolioNote.length"));
ok("portfolioNotesChars i18n key used",      sidebarSrc.includes("portfolioNotesChars"));
ok(".note-area CSS defined",                 sidebarSrc.includes(".note-area"));
ok(".note-counter CSS defined",              sidebarSrc.includes(".note-counter"));

// ═══════════════════════════════════════════════════════════════════════════
// 6. i18n — ui.js parity
// ═══════════════════════════════════════════════════════════════════════════
console.log("\nui.js — i18n parity");

ok("EN portfolioNotes key present",          uiSrc.includes("portfolioNotes:"));
ok("TR portfolioNotes key present",          uiSrc.match(/tr:[\s\S]*?portfolioNotes:/) !== null);
ok("EN portfolioNotesPlaceholder key present", uiSrc.includes("portfolioNotesPlaceholder:"));
ok("TR portfolioNotesPlaceholder key present", uiSrc.match(/tr:[\s\S]*?portfolioNotesPlaceholder:/) !== null);
ok("EN portfolioNotesChars key present",     uiSrc.includes("portfolioNotesChars:"));
ok("TR portfolioNotesChars key present",     uiSrc.match(/tr:[\s\S]*?portfolioNotesChars:/) !== null);

// ═══════════════════════════════════════════════════════════════════════════
// 7. Invariants — schema, storage key, no analytics impact
// ═══════════════════════════════════════════════════════════════════════════
console.log("\ninvariants");

ok("schemaVersion remains 1",                storageSrc.includes("SCHEMA_VERSION = 1"));
ok("STORAGE_KEY remains qpa-portfolios",     STORAGE_KEY === "qpa-portfolios");
ok("notes does not affect financial formulas",
   !appSrc.match(/portfolioNote[\s\S]{0,50}(buildPortfolio|useMemo|annRet|sharpe)/));

// ═══════════════════════════════════════════════════════════════════════════
// result
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
