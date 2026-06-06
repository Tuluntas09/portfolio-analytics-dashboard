/**
 * capture-screenshots.mjs — headless Playwright screenshot capture for README assets.
 *
 * Usage:
 *   npm run capture:screenshots
 *
 * The script starts the Vite dev server automatically if it is not already
 * running on port 8502, captures two screenshots, then stops the server.
 * No FINNHUB_API_KEY needed — the app runs in mock/offline mode.
 *
 * Output:
 *   docs/assets/dashboard-overview.png  — Overview tab, dark theme, 1440×900
 *   docs/assets/dashboard-risk.png      — Risk Analytics tab, dark theme, 1440×900
 */

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root  = path.resolve(__dir, "..");
const out   = path.join(root, "docs", "assets");
const URL   = "http://127.0.0.1:8502";

async function waitForServer(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Dev server at ${url} not ready after ${timeoutMs / 1000}s`);
}

async function main() {
  await mkdir(out, { recursive: true });

  // Reuse a running server if available; otherwise start one.
  let serverProc = null;
  let reusing    = false;
  try {
    await waitForServer(URL, 800);
    reusing = true;
    console.log("Reusing running dev server.");
  } catch {
    console.log("Starting dev server…");
    serverProc = spawn("npm", ["run", "dev"], {
      cwd: root, stdio: "ignore", shell: true,
    });
    process.on("exit", () => serverProc?.kill());
    await waitForServer(URL, 20_000);
    console.log("Dev server ready.");
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Mirror the same localStorage seed used in E2E tests.
    await page.addInitScript(() => {
      localStorage.setItem("qpa-language", "en");
      localStorage.setItem("qpa-theme",    "dark");
    });

    // ── Overview tab ───────────────────────────────────────────────────────────
    await page.goto(URL);
    await page.waitForSelector(".kpi-strip",  { timeout: 20_000 });
    await page.waitForSelector(".tab-body",   { timeout: 10_000 });
    await page.waitForTimeout(1500); // allow SVG charts to finish rendering

    const overviewPath = path.join(out, "dashboard-overview.png");
    await page.screenshot({ path: overviewPath });
    console.log(`✓  ${path.relative(root, overviewPath)}`);

    // ── Risk Analytics tab ─────────────────────────────────────────────────────
    await page.locator(".tab-btn").nth(1).click();
    await page.waitForSelector(".tab-body", { timeout: 10_000 });
    await page.waitForTimeout(1000);

    const riskPath = path.join(out, "dashboard-risk.png");
    await page.screenshot({ path: riskPath });
    console.log(`✓  ${path.relative(root, riskPath)}`);

    await ctx.close();
  } finally {
    await browser.close();
    if (!reusing && serverProc) serverProc.kill();
  }

  console.log("\nScreenshots saved to docs/assets/");
}

main().catch(err => {
  console.error("\nCapture failed:", err.message);
  process.exit(1);
});
