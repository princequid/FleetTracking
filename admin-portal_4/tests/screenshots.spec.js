import { test } from "./fixtures.js";
import { seedSession, seedTheme, gotoApp, settle } from "./helpers/auth.js";

/**
 * Screenshot capture for visual review — not visual regression.
 *
 * There are no committed baseline images and no `toHaveScreenshot` assertions on
 * purpose: baselines would go stale on every intentional design change and turn
 * into noise. This spec exists so a redesign can be *looked at* across all three
 * viewports in one command:
 *
 *     npm run ui:shots
 *
 * Output lands in `screenshots/<viewport>/`. Never fails on appearance.
 */

const PAGES = [
  "/login",
  "/forgot-password",
  "/dashboard",
  "/trips",
  "/dispatch",
  "/drivers",
  "/vehicles",
  "/incidents",
  "/reports",
  "/map",
  "/staff",
];

// Public routes must be captured *without* a session — LoginPage redirects to
// /dashboard as soon as isLoggedIn is true, so seeding one would screenshot the
// wrong page entirely.
const needsAuth = (path) => !["/login", "/forgot-password", "/reset-password"].includes(path);
const slug = (path) => path.replace(/^\//, "").replace(/\//g, "-") || "root";

for (const theme of ["light", "dark"]) {
  for (const path of PAGES) {
    test(`capture ${path} (${theme})`, async ({ page }, testInfo) => {
      if (needsAuth(path)) await seedSession(page);
      await seedTheme(page, theme);
      await gotoApp(page, path);

      // Charts, maps and data-driven content must reach their final state —
      // capturing mid-spinner defeats the point of a visual review.
      await settle(page);

      await page.screenshot({
        path: `screenshots/${testInfo.project.name}/${slug(path)}-${theme}.png`,
        fullPage: true,
      });
    });
  }
}
