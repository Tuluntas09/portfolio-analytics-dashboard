# localStorage Storage Schema

**Project:** Quant Portfolio Analytics Dashboard  
**Date:** 2026-06-10  
**Status:** Current through Phase 11e — migration plumbing installed; all versions at 1.

---

## localStorage Key Map

| Key | Owning module | Data shape | Version field | Current version |
|---|---|---|---|---|
| `qpa-portfolios` | `src/portfolioStorage.js` | `Array<{schemaVersion, name, holdings, assumptions, notes, savedAt}>` | `schemaVersion` per entry | 1 |
| `qpa-active-state` | `src/activePortfolioState.js` | `{schemaVersion, holdings, assumptions, notes, savedAt}` | `schemaVersion` in payload | 1 |
| `qpa-snapshots` | `src/portfolioSnapshots.js` | `Array<{schemaVersion, date, totalValue, source}>` | `schemaVersion` per entry (added Phase 11e) | 1 |
| `qpa-theme` | `src/app.jsx` (direct) | `"dark"` or `"light"` | None (primitive string) | — |
| `qpa-language` | `src/app.jsx` (direct) | `"en"` or `"tr"` | None (primitive string) | — |

### Backup / export file (not a localStorage key)

The JSON backup file produced by `src/portfolioBackup.js` uses `backupVersion` (not `schemaVersion`) as its envelope version field. Current `BACKUP_VERSION = 1`. This naming difference is intentional; the backup envelope describes the file format, not the storage schema.

---

## Version Constants

| Constant | Module | Value |
|---|---|---|
| `SCHEMA_VERSION` | `src/portfolioStorage.js` | `1` |
| `ACTIVE_STATE_VERSION` | `src/activePortfolioState.js` | `1` |
| `SNAPSHOT_VERSION` | `src/portfolioSnapshots.js` | `1` |
| `BACKUP_VERSION` | `src/portfolioBackup.js` | `1` |

---

## Migration Framework (Phase 11e)

Each storage module now contains a private `migrate*` helper that runs before validation on every load. In Phase 11e all helpers are pass-throughs (no data is actually migrated; the mechanism is installed for future use).

### Contract

```
migratePortfolioEntry(entry)   → portfolioStorage.js
migrateActiveState(parsed)     → activePortfolioState.js
migrateSnapshotEntry(entry)    → portfolioSnapshots.js
```

Each function:
- Returns the entry unchanged if `schemaVersion` already equals the current version constant.
- Returns the entry unchanged if `schemaVersion` is unknown (future or zero) — subsequent `isWellFormed` / version checks then reject it if needed.
- Never throws; returns the input as-is for null or non-object inputs.

To add a real migration step when bumping a version constant, add a branch:
```js
if (v === 1 && SCHEMA_VERSION >= 2) {
  return { ...entry, newField: defaultValue, schemaVersion: 2 };
}
```

### Load-path order

```
loadSaves:        parse → map(migratePortfolioEntry) → filter(isWellFormed) → (rest of validation)
loadActiveState:  parse → migrateActiveState → version check → (rest of validation)
loadSnapshots:    parse → map(migrateSnapshotEntry) → map(normalizeSnapshot) → filter(Boolean) → sort
importSnapshots:  raw  → map(migrateSnapshotEntry) → map(normalizeSnapshot) → filter(Boolean) → sort → store
```

---

## Backward Compatibility Policy

1. **localStorage key names are frozen.** No key name changes across phases.
2. **Valid v1 data must continue loading** after any schema version bump.
3. **Malformed data fails safely** — no crashes, graceful return of `[]` or `null`.
4. **Unknown future versions are not accepted** as current valid data. After migration is attempted, `isWellFormed` / version equality checks reject entries whose version the code does not recognize.
5. **Snapshot entries missing `schemaVersion` are treated as legacy v1.** Entries written before Phase 11e have no `schemaVersion` field; `migrateSnapshotEntry` defaults the missing field to `1` so they continue to load.
6. **Migrations are additive only.** New fields get default values; existing fields are preserved. Field removals require an explicit named migration step.
7. **Version numbers are not bumped in Phase 11e.** This phase installs the migration plumbing only.

---

## Module Ownership

| Module | Owns |
|---|---|
| `src/portfolioStorage.js` | `qpa-portfolios` reads, writes, validation, migration |
| `src/activePortfolioState.js` | `qpa-active-state` reads, writes, validation, migration |
| `src/portfolioSnapshots.js` | `qpa-snapshots` reads, writes, validation, migration, delta calculation |
| `src/portfolioBackup.js` | JSON backup import/export (file only, no localStorage key) |
| `src/app.jsx` | `qpa-theme` and `qpa-language` primitive reads/writes with allowlist coercion |

---

## Primitive Key Coercion (Phase 11e)

`qpa-theme` and `qpa-language` do not use schema versioning (they are single strings). `app.jsx` reads them with explicit allowlist guards:

```js
// qpa-theme — valid: "dark", "light"; default: "dark"
const raw = localStorage.getItem("qpa-theme");
return raw === "dark" || raw === "light" ? raw : "dark";

// qpa-language — valid: "en", "tr"; default: "tr"
const raw = localStorage.getItem("qpa-language");
return raw === "en" || raw === "tr" ? raw : "tr";
```

Any corrupted or unexpected value resolves to the documented default rather than propagating to React state.

---

## Test Coverage

| Module | Check script | Key schema tests |
|---|---|---|
| `portfolioStorage.js` | `scripts/portfolio-storage-check.mjs` | schemaVersion:99 rejected; mixed arrays; T-S1/S2/S3 migration plumbing |
| `activePortfolioState.js` | `scripts/active-state-check.mjs` | schemaVersion:99 returns null; T-A1/A2 migration plumbing |
| `portfolioSnapshots.js` | `scripts/snapshot-check.mjs` | legacy entries (no schemaVersion) load; schemaVersion:1 written to raw JSON; T-SN1/SN2/SN3/SN4 |
| `portfolioBackup.js` | `scripts/backup-check.mjs` | wrong backupVersion rejected; T-B1/T-B2 private mirror removed; import check |
| `app.jsx` | `scripts/app-check.mjs` | allowlist checks for qpa-theme and qpa-language |
