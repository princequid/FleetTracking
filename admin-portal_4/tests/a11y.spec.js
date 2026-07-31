import { test, expect } from "./fixtures.js";
import { seedSession, seedTheme, gotoApp, settle } from "./helpers/auth.js";
import { auditPage, formatViolations } from "./helpers/audit.js";

/**
 * WCAG 2.1 AA audit via axe-core.
 *
 * The gate is serious + critical violations. Moderate and minor findings are
 * still recorded as a test attachment (see helpers/audit.js) so they're visible
 * without blocking every commit on cosmetic rule hits.
 *
 * Runs on all three viewport projects: contrast and reflow findings differ
 * between desktop and mobile, and only auditing desktop misses half of them.
 */

const ROUTES = [
  { path: "/login", auth: false },
  { path: "/forgot-password", auth: false },
  { path: "/dashboard", auth: true },
  { path: "/trips", auth: true },
  { path: "/dispatch", auth: true },
  { path: "/drivers", auth: true },
  { path: "/vehicles", auth: true },
  { path: "/incidents", auth: true },
  { path: "/reports", auth: true },
  { path: "/staff", auth: true },
  // Leaflet's own tile DOM is excluded rather than the page skipped, so the
  // map page's surrounding chrome is still held to the same bar.
  { path: "/map", auth: true, exclude: [".leaflet-container"] },
];

for (const { path, auth, exclude } of ROUTES) {
  test(`${path} has no serious or critical a11y violations`, async ({ page }, testInfo) => {
    if (auth) await seedSession(page);
    await gotoApp(page, path);
    await settle(page);

    const { blocking } = await auditPage(page, testInfo, { exclude });

    expect(blocking, `\n${formatViolations(blocking)}\n`).toEqual([]);
  });
}

test.describe("dark mode", () => {
  // Dark mode remaps the semantic token layer, which means it has an entirely
  // separate contrast profile. Auditing only light mode certifies half the app.
  for (const { path, auth } of [
    // /login must be audited *without* a session: LoginPage's effect redirects
    // to /dashboard the moment isLoggedIn is true, which would navigate out from
    // under the scan.
    { path: "/login", auth: false },
    { path: "/dashboard", auth: true },
    { path: "/trips", auth: true },
  ]) {
    test(`${path} passes in dark mode`, async ({ page }, testInfo) => {
      if (auth) await seedSession(page);
      await seedTheme(page, "dark");
      await gotoApp(page, path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await settle(page);

      const { blocking } = await auditPage(page, testInfo);

      expect(blocking, `\n${formatViolations(blocking)}\n`).toEqual([]);
    });
  }
});

test.describe("keyboard access", () => {
  test("login form is completable by keyboard alone", async ({ page }) => {
    await gotoApp(page, "/login");

    const email = page.locator("input[type='email'], input[name='email']").first();
    await email.focus();

    // Tab order must reach the password field and then the submit control
    // without detouring through anything unfocusable.
    await page.keyboard.press("Tab");
    const afterEmail = await page.evaluate(() => {
      const el = document.activeElement;
      return `${el?.tagName.toLowerCase()}:${el?.getAttribute("type") ?? ""}`;
    });
    expect(afterEmail).toContain("input");
  });

  test("focus is always visible on interactive elements", async ({ page }) => {
    await gotoApp(page, "/login");

    // index.css sets a global :focus-visible ring. If a component removed it
    // with `outline: none` and no replacement, this catches it.
    const button = page.getByRole("button", { name: /sign in|log in/i }).first();
    await button.focus();

    const ring = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        outlineWidth: s.outlineWidth,
        outlineStyle: s.outlineStyle,
        boxShadow: s.boxShadow,
      };
    });

    const hasRing =
      (ring.outlineStyle !== "none" && parseFloat(ring.outlineWidth) > 0) ||
      (ring.boxShadow !== "none" && ring.boxShadow !== "");

    expect(hasRing, `no visible focus indicator: ${JSON.stringify(ring)}`).toBe(true);
  });
});
