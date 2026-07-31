import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the FleetSync Pro admin portal.
 *
 * This exists for UI/UX work — layout verification, responsive checks, screenshot
 * capture and accessibility auditing — not for backend integration testing. The
 * Spring Boot API is not started here, so specs are written to exercise the shell,
 * the design system and the loading/empty/error states rather than live data.
 *
 * Viewports mirror the three breakpoints index.css actually branches on, so a
 * responsive regression shows up in the project name that broke.
 */
const BASE_URL = process.env.PW_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  // Design-system checks read computed styles and fonts; parallel runs across
  // three viewport projects is plenty of concurrency without flaking on layout.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  /**
   * Capped rather than left to Playwright's default (half the logical cores).
   *
   * The suite has roughly doubled, and with three viewport projects running
   * fully parallel the constraint is the single Vite dev server, not the CPU:
   * every worker that reaches a lazily-loaded route makes it transform that
   * chunk, and past about four concurrent contexts the navigations start
   * exceeding their budget. That surfaced as a handful of unrelated tests
   * failing on timeouts in a full run while passing individually — the worst
   * kind of failure, because it teaches people to ignore red.
   */
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  outputDir: "test-results",

  /**
   * Generous, because the bottleneck is the dev server rather than the app.
   * main.jsx code-splits every route, so the first visit to /map or /reports in
   * a given run makes Vite transform that chunk (Leaflet and Recharts are not
   * small) while up to four workers compete for it. A 15s navigation budget and
   * the stock 30s test budget both proved too tight on an 8-core dev machine —
   * the failures were pure timeouts, never assertions.
   */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // 834px (iPad Air portrait), deliberately NOT 768px: index.css switches the
      // sidebar to off-canvas at `max-width: 768px`, so a 768-wide project sits
      // exactly on the boundary and only ever retests mobile's behaviour. 834
      // exercises the middle regime — inline rail narrowed to 240px.
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  // Reuses an already-running `npm run dev` instead of fighting it for port 5173.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
