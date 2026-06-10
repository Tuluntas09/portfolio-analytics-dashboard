/**
 * dashboard.spec.js — browser-level smoke tests for the Quant Portfolio Analytics
 * Dashboard (Phase 6 onward).
 *
 * Scope:
 *   - App loads and all 7 tabs are navigable.
 *   - Core structural regions (shell, sidebar, topbar, tab nav, content) render.
 *   - No uncaught JavaScript errors on initial load.
 *   - Mock/offline mode (proxy not running) does not crash the app.
 *   - Dark ↔ light theme toggle works.
 *
 * Design constraints:
 *   - No assertions on exact numeric values, chart SVG paths, or pixel positions.
 *   - No dependency on a live Finnhub API key.
 *   - Tests pass in mock/offline mode (proxy not required).
 */

import { test, expect } from "@playwright/test";

// Generous timeout to accommodate Vite dev-server cold start and React mount latency.
const APP_TIMEOUT = 30_000;

// Pre-load localStorage before each test page navigation so the app starts in
// a predictable state (English language, dark theme).  addInitScript runs
// before any page scripts execute, so it beats the localStorage.getItem checks
// in app.jsx.
async function prepareLocalStorage(page) {
  await page.addInitScript(() => {
    localStorage.setItem("qpa-language", "en");
    localStorage.setItem("qpa-theme", "dark");
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Page load integrity
// ──────────────────────────────────────────────────────────────────────────────

// This test manages its own navigation so it can register the pageerror listener
// before goto() — events fired before listener registration are not replayed.
test("app loads without uncaught JavaScript errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await prepareLocalStorage(page);
  await page.goto("/");
  await page.waitForSelector(".app", { timeout: APP_TIMEOUT });

  // Brief settle: allow any deferred React micro-tasks to complete before checking errors.
  await page.waitForTimeout(500);

  if (errors.length > 0) {
    throw new Error(
      `Uncaught JS errors on load:\n  ${errors.join("\n  ")}`
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Dashboard shell structure
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Dashboard shell", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("all structural regions are visible", async ({ page }) => {
    await expect(page.locator(".app")).toBeVisible();
    await expect(page.locator(".sidebar")).toBeVisible();
    await expect(page.locator(".main")).toBeVisible();
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".tabnav")).toBeVisible();
    await expect(page.locator(".content")).toBeVisible();
  });

  test("topbar shows 3 portfolio metric cards", async ({ page }) => {
    // Ann. Return, Sharpe, Max DD — present in mock mode too
    await expect(page.locator(".head-metric")).toHaveCount(3);
  });

  test("all 7 tab buttons are present", async ({ page }) => {
    await expect(page.locator(".tab-btn")).toHaveCount(7);
  });

  test("exactly one tab is active at startup", async ({ page }) => {
    await expect(page.locator(".tab-btn.on")).toHaveCount(1);
  });

  test("Overview is the active tab on startup", async ({ page }) => {
    // Overview is TABS[0]; its button is the first .tab-btn.
    await expect(page.locator(".tab-btn").first()).toHaveClass(/\bon\b/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Tab navigation — each tab must render its content container
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Tab navigation", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("Overview tab (0) renders portfolio KPI strip", async ({ page }) => {
    // Default tab; no click needed.
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".kpi-strip")).toBeVisible();
  });

  test("Risk tab (1) renders without crashing", async ({ page }) => {
    await page.locator(".tab-btn").nth(1).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".card").first()).toBeVisible();
  });

  test("Portfolio Improvement tab (2) renders without crashing", async ({ page }) => {
    await page.locator(".tab-btn").nth(2).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".opt-cards")).toBeVisible();
  });

  test("Simulation tab (3) renders without crashing", async ({ page }) => {
    await page.locator(".tab-btn").nth(3).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".card").first()).toBeVisible();
  });

  test("Performance Analysis tab (4) renders without crashing", async ({ page }) => {
    await page.locator(".tab-btn").nth(4).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".card").first()).toBeVisible();
  });

  test("Company Data tab (5) renders even when proxy is unavailable", async ({ page }) => {
    await page.locator(".tab-btn").nth(5).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    // At least one card (profile or news) renders regardless of proxy state.
    await expect(page.locator(".card").first()).toBeVisible();
  });

  test("Data tab (6) renders data-quality audit panel", async ({ page }) => {
    await page.locator(".tab-btn").nth(6).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    // src-grid contains the per-source status tiles.
    await expect(page.locator(".src-grid")).toBeVisible();
  });

  test("rapid tab cycling does not crash the app", async ({ page }) => {
    // Cycle through all tabs twice to exercise React state transitions.
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 7; i++) {
        await page.locator(".tab-btn").nth(i).click();
      }
    }
    // App must still be alive and show content.
    await expect(page.locator(".tab-body")).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Mock / offline fallback
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Mock fallback (proxy offline)", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("portfolio analytics remain visible in mock mode", async ({ page }) => {
    // The proxy health check fails quickly; the app should fall back to mock
    // prices and still show the overview metrics.
    await expect(page.locator(".kpi-strip")).toBeVisible();
    await expect(page.locator(".tab-body")).toBeVisible();
  });

  test("Company Data tab does not crash when proxy is offline", async ({ page }) => {
    // News fetch is gated on apiStatus.ok; offline → shows 'unavailable' state.
    await page.locator(".tab-btn").nth(5).click();
    await expect(page.locator(".tab-body")).toBeVisible();
  });

  test("Data tab shows proxy offline state without crashing", async ({ page }) => {
    await page.locator(".tab-btn").nth(6).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".src-grid")).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Theme toggle
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Theme toggle", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("toggles between dark and light themes", async ({ page }) => {
    // Should start in dark (set by prepareLocalStorage).
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Click the .theme-btn in the sidebar header.
    await page.locator(".theme-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Toggle back.
    await page.locator(".theme-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("dashboard content remains visible after theme change", async ({ page }) => {
    await page.locator(".theme-btn").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // Key structural elements must still be visible in light mode.
    await expect(page.locator(".app")).toBeVisible();
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".kpi-strip")).toBeVisible();
  });
});
