/**
 * mobile-responsive.spec.js — Phase 12e E2E regression coverage for mobile
 * responsive behavior at 375×812 viewport.
 *
 * Scope:
 *   - App shell renders correctly at mobile width (Group A)
 *   - Sidebar drawer open/close interactions (Group B)
 *   - Tab navigation scrolls and activates at mobile width (Group C)
 *   - Key tab content renders without crashing (Group D)
 *   - Table horizontal scroll behavior (Group E)
 *
 * Design constraints:
 *   - No assertions on exact numeric/financial values.
 *   - No dependency on a live Finnhub API key or proxy.
 *   - All tests pass in mock/offline mode.
 *   - Desktop layout tests (37 existing tests) are unaffected — this file
 *     overrides the viewport only for its own tests via test.use().
 */

import { test, expect } from "@playwright/test";

// Override viewport for every test in this file to a typical mobile phone size.
test.use({
  viewport: { width: 375, height: 812 },
});

const APP_TIMEOUT = 30_000;

async function prepareLocalStorage(page) {
  await page.addInitScript(() => {
    localStorage.setItem("qpa-language", "en");
    localStorage.setItem("qpa-theme", "dark");
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// A. Mobile shell
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Mobile shell", () => {
  test("renders the app at mobile viewport", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
    await page.waitForTimeout(500);

    await expect(page.locator(".app")).toBeVisible();
    await expect(page.locator(".content")).toBeVisible();

    if (errors.length > 0) {
      throw new Error(`Uncaught JS errors on mobile load:\n  ${errors.join("\n  ")}`);
    }
  });

  test("hamburger button is visible and sidebar is closed by default", async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });

    await expect(page.locator(".hamburger-btn")).toBeVisible();

    // Sidebar must exist but must NOT carry the sidebar--open class.
    const sidebarClasses = await page.locator(".sidebar").getAttribute("class");
    expect(sidebarClasses).not.toContain("sidebar--open");

    // Backdrop is rendered only when open — it should not be visible.
    await expect(page.locator(".sidebar-backdrop")).not.toBeVisible();
  });

  test("app does not create full-page horizontal overflow", async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });

    // Allow 2 px tolerance for sub-pixel rounding across browsers.
    const noOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 2;
    });
    expect(noOverflow).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// B. Sidebar drawer
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Sidebar drawer", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("hamburger opens the sidebar drawer", async ({ page }) => {
    await page.locator(".hamburger-btn").click();

    const sidebarClasses = await page.locator(".sidebar").getAttribute("class");
    expect(sidebarClasses).toContain("sidebar--open");

    await expect(page.locator(".sidebar-backdrop")).toBeVisible();
  });

  test("backdrop closes the sidebar drawer", async ({ page }) => {
    await page.locator(".hamburger-btn").click();
    await expect(page.locator(".sidebar-backdrop")).toBeVisible();

    await page.locator(".sidebar-backdrop").click();

    const sidebarClasses = await page.locator(".sidebar").getAttribute("class");
    expect(sidebarClasses).not.toContain("sidebar--open");
  });

  test("sidebar close button closes the drawer", async ({ page }) => {
    await page.locator(".hamburger-btn").click();

    const sidebarClasses = await page.locator(".sidebar").getAttribute("class");
    expect(sidebarClasses).toContain("sidebar--open");

    await page.locator(".sidebar-close-btn").click();

    const updatedClasses = await page.locator(".sidebar").getAttribute("class");
    expect(updatedClasses).not.toContain("sidebar--open");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// C. Mobile tab navigation
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Mobile tab navigation", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("all seven tab buttons exist at mobile width", async ({ page }) => {
    await expect(page.locator(".tab-btn")).toHaveCount(7);
  });

  test("all tabs can be activated at mobile width", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const count = await page.locator(".tab-btn").count();
    for (let i = 0; i < count; i++) {
      const btn = page.locator(".tab-btn").nth(i);
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      // Tab body must remain visible after each activation — no crash.
      await expect(page.locator(".tab-body")).toBeVisible();
    }

    if (errors.length > 0) {
      throw new Error(`Uncaught JS errors during tab cycling:\n  ${errors.join("\n  ")}`);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// D. Mobile rendering smoke
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Mobile rendering smoke", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("Overview tab renders mobile content", async ({ page }) => {
    // Overview is the default tab — no click needed.
    await expect(page.locator(".kpi-strip")).toBeVisible();
    // At least one SVG should be rendered by the growth chart.
    await expect(page.locator("svg").first()).toBeVisible();
  });

  test("Risk tab renders at mobile width without crashing", async ({ page }) => {
    await page.locator(".tab-btn").nth(1).click();
    await expect(page.locator(".tab-body")).toBeVisible();
    await expect(page.locator(".card").first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// E. Table scroll behavior
// ──────────────────────────────────────────────────────────────────────────────

test.describe("Table scroll behavior", () => {
  test.beforeEach(async ({ page }) => {
    await prepareLocalStorage(page);
    await page.goto("/");
    await page.waitForSelector(".app", { timeout: APP_TIMEOUT });
  });

  test("table wrappers allow horizontal scroll without page overflow", async ({ page }) => {
    // Overview tab is default and contains the holdings table.
    await expect(page.locator(".tbl-wrap").first()).toBeVisible();

    // Computed overflow-x on the first wrapper must be auto or scroll.
    const overflowX = await page.locator(".tbl-wrap").first().evaluate((el) => {
      return window.getComputedStyle(el).overflowX;
    });
    expect(["auto", "scroll"]).toContain(overflowX);

    // Page-level overflow must remain within tolerance.
    const noPageOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 2;
    });
    expect(noPageOverflow).toBe(true);
  });

  test("table content remains accessible on mobile via scroll", async ({ page }) => {
    // Overview tab has a holdings table; navigate there explicitly.
    await page.locator(".tab-btn").nth(0).click();
    await expect(page.locator(".tbl-wrap").first()).toBeVisible();

    // Attempt to scroll the wrapper and verify scrollLeft changes or the table
    // already fits (either outcome means layout is not broken).
    const scrolled = await page.locator(".tbl-wrap").first().evaluate((el) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) {
        el.scrollLeft = maxScroll;
        return el.scrollLeft > 0;
      }
      // Table fits within the wrapper at this viewport — that is also acceptable.
      return true;
    });
    expect(scrolled).toBe(true);
  });
});
