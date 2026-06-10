/**
 * sidebar-features.spec.js — Phase 11b E2E coverage for sidebar and Phase 8–10 features.
 *
 * Scope:
 *   - Language toggle (Group A)
 *   - Sidebar Phase 8-10 controls: CSV, JSON backup, Save Current State, Print Report (Group B)
 *   - Date range preset buttons and Custom reveal (Group C)
 *   - Cost basis inputs in sidebar (Group D)
 *   - Saved portfolios UI and portfolio notes (Group E)
 *   - Active state save feedback (Group F)
 *   - Snapshot history card with seeded localStorage (Group G)
 *
 * Design constraints:
 *   - No assertions on exact numeric values, chart SVG paths, or pixel positions.
 *   - No dependency on a live Finnhub API key or proxy.
 *   - All tests pass in mock/offline mode.
 */

import { test, expect } from "@playwright/test";

// Generous timeout to accommodate Vite dev-server cold start and React mount latency.
const APP_TIMEOUT = 30_000;

// Pre-load localStorage before each test page navigation so the app starts in
// a predictable state (English language, dark theme). addInitScript runs
// before any page scripts execute, so it beats the localStorage.getItem checks
// in app.jsx.
async function prepareLocalStorage(page) {
  await page.addInitScript(() => {
    localStorage.setItem("qpa-language", "en");
    localStorage.setItem("qpa-theme", "dark");
  });
}

// Extends prepareLocalStorage with two valid snapshot entries so that the
// OverviewTab snapshot card renders (requires snapshots.length >= 2).
// Entries match normalizeSnapshot() validation: YYYY-MM-DD date, positive
// finite totalValue, source === "real".
async function prepareLocalStorageWithSnapshots(page) {
  await page.addInitScript(() => {
    localStorage.setItem("qpa-language", "en");
    localStorage.setItem("qpa-theme", "dark");
    localStorage.setItem(
      "qpa-snapshots",
      JSON.stringify([
        { date: "2026-06-01", totalValue: 100000, source: "real" },
        { date: "2026-06-09", totalValue: 105000, source: "real" },
      ])
    );
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// A. Language toggle
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Language toggle", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("language button shows EN when language is set to English", async ({ page }) => {
    await expect(page.locator(".lang-btn")).toBeVisible();
    await expect(page.locator(".lang-btn")).toHaveText("EN");
  });

  test("toggling language to TR updates tab labels and toggles back correctly", async ({ page }) => {
    await page.locator(".lang-btn").click();
    await expect(page.locator(".lang-btn")).toHaveText("TR");
    await expect(page.locator(".tab-btn").first()).toHaveText("Özet");

    await page.locator(".lang-btn").click();
    await expect(page.locator(".lang-btn")).toHaveText("EN");
    await expect(page.locator(".tab-btn").first()).toHaveText("Overview");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// B. Sidebar Phase 8-10 controls
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Sidebar Phase 8-10 controls", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("CSV Import and Export buttons are present", async ({ page }) => {
    await expect(page.getByText("Import CSV")).toBeVisible();
    await expect(page.getByText("Export CSV")).toBeVisible();
  });

  test("JSON backup Import and Export buttons are present", async ({ page }) => {
    await expect(page.getByText("Import JSON")).toBeVisible();
    await expect(page.getByText("Export JSON")).toBeVisible();
  });

  test("Save Current State button is visible and status shows initial text", async ({ page }) => {
    await expect(page.locator(".save-active-btn")).toBeVisible();
    await expect(page.locator(".save-active-btn")).toContainText("Save Current State");
    await expect(page.locator(".save-active-status")).toBeVisible();
    await expect(page.locator(".save-active-status")).toContainText("Not saved yet");
  });

  test("Print Report button is present in the topbar", async ({ page }) => {
    await expect(page.locator(".print-btn")).toBeVisible();
    await expect(page.locator(".print-btn")).toContainText("Print Report");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// C. Date range controls
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Date range controls", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("five date range preset buttons are present", async ({ page }) => {
    await expect(page.locator(".seg-btn")).toHaveCount(5);
  });

  test("2Y is the active date preset by default", async ({ page }) => {
    await expect(page.locator(".seg-btn.on")).toHaveText("2Y");
  });

  test("clicking Custom reveals date input fields", async ({ page }) => {
    await page.locator(".seg-btn").filter({ hasText: "Custom" }).click();
    await expect(page.locator(".date-input")).toHaveCount(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// D. Cost basis UI
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Cost basis UI", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("avg cost and first-bought inputs are visible in sidebar when holdings are present", async ({ page }) => {
    await expect(page.locator(".lot-cost-input").first()).toBeVisible();
    await expect(page.locator(".lot-date-input").first()).toBeVisible();
  });

  test("Overview tab holdings table includes cost basis column headers", async ({ page }) => {
    // Overview is the default tab — no navigation needed.
    await expect(page.getByText("Avg. Cost").first()).toBeVisible();
    await expect(page.getByText("Unrealized P&L").first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// E. Saved portfolios and notes
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Saved portfolios and notes", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("save portfolio name input and save button are visible", async ({ page }) => {
    await expect(page.locator(".save-name-input")).toBeVisible();
    await expect(page.locator(".save-btn")).toBeVisible();
  });

  test("saving a new portfolio name adds it to the saved list", async ({ page }) => {
    await page.locator(".save-name-input").fill("E2E Test Portfolio");
    await page.locator(".save-btn").click();
    await page.waitForSelector(".save-list");
    await expect(page.locator(".save-item-name").first()).toContainText("E2E Test Portfolio");
  });

  test("portfolio notes textarea and character counter are visible", async ({ page }) => {
    await expect(page.locator(".note-area")).toBeVisible();
    await expect(page.locator(".note-counter")).toContainText("0 / 500");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// F. Active state save feedback
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Active state save feedback", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("clicking Save Current State shows confirmation feedback", async ({ page }) => {
    await page.locator(".save-active-btn").click();
    await expect(page.locator(".save-active-status")).toContainText("Current state saved");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// G. Snapshot history (seeded localStorage)
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Snapshot history (seeded localStorage)", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorageWithSnapshots(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("seeded snapshots cause Portfolio value history card to appear in Overview", async ({ page }) => {
    // Overview is the default tab — no navigation needed.
    await expect(page.getByText("Portfolio value history")).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// H. Benchmark selector
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Benchmark selector", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
    // The benchmark selector lives inside Advanced assumptions — open the toggle first.
    await page.locator(".adv-toggle").click();
    await page.waitForSelector(".bench-sel-btn", { timeout: APP_TIMEOUT });
  });

  test("benchmark selector shows 4 options with VTI active by default", async ({ page }) => {
    await expect(page.locator(".bench-sel-btn")).toHaveCount(4);
    await expect(page.locator(".bench-sel-btn.on")).toHaveText("VTI");
  });

  test("selecting QQQ activates QQQ and deactivates VTI", async ({ page }) => {
    await page.locator(".bench-sel-btn", { hasText: "QQQ" }).click();
    await expect(page.locator(".bench-sel-btn.on")).toHaveText("QQQ");
    await expect(page.locator(".bench-sel-btn", { hasText: "VTI" })).not.toHaveClass(/\bon\b/);
  });
});
