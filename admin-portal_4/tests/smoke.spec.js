import { test, expect } from "./fixtures.js";
import { seedSession, seedTheme, gotoApp } from "./helpers/auth.js";

/**
 * Does the shell still render and navigate?
 *
 * The cheap gate that runs before any UI redesign is called done. It asserts
 * structure and design-system wiring, never data — the API is not up.
 */

test.describe("public routes", () => {
  test("login page renders its form", async ({ page }) => {
    await gotoApp(page, "/login");

    await expect(page.getByRole("heading", { name: "Welcome back", level: 1 })).toBeVisible();
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("forgot-password page is reachable from login", async ({ page }) => {
    await gotoApp(page, "/login");
    await page.getByRole("link", { name: /forgot password/i }).click();

    await expect(page).toHaveURL(/forgot-password/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("password visibility toggle flips the input type", async ({ page }) => {
    await gotoApp(page, "/login");

    const password = page.locator("#login-password");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });

  test("guarded route redirects to login when unauthenticated", async ({ page }) => {
    await gotoApp(page, "/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("authenticated shell", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("shell chrome renders around the page outlet", async ({ page }, testInfo) => {
    await gotoApp(page, "/dashboard");

    await expect(page.locator("header.navbar")).toBeVisible();
    await expect(page.locator("#main-content")).not.toBeEmpty();
    // Keyboard escape hatch out of the nav — first focusable element in Layout.
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeAttached();

    // CSS keeps the rail visible above the mobile breakpoint; below it the rail
    // is off-canvas until the hamburger is used.
    if (testInfo.project.name !== "mobile") {
      await expect(page.getByRole("complementary", { name: "Main navigation" })).toBeVisible();
    }
  });

  test("document title tracks the active route", async ({ page }) => {
    await gotoApp(page, "/trips");
    await expect(page).toHaveTitle("FleetSync — Manage Trips");
  });

  // Every nav destination must mount without throwing. A blank page here means a
  // redesign broke a route — the most common regression in this portal.
  for (const path of [
    "/dashboard",
    "/trips",
    "/dispatch",
    "/drivers",
    "/vehicles",
    "/incidents",
    "/reports",
    "/map",
    "/staff",
  ]) {
    test(`${path} mounts without an uncaught error`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await gotoApp(page, path);

      // Seeded role is SUPER_ADMIN, so no guard should bounce us elsewhere.
      expect(page.url()).toContain(path);
      // Content landed in the outlet, and it isn't the ErrorBoundary fallback.
      await expect(page.locator("#main-content")).not.toBeEmpty();
      await expect(page.locator(".error-boundary, [class*='errorBoundary']")).toHaveCount(0);
      expect(errors, `uncaught errors on ${path}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
});

test.describe("design system wiring", () => {
  test("theme toggle flips data-theme and remaps semantic tokens", async ({ page }) => {
    await seedSession(page);
    await seedTheme(page, "light");
    await gotoApp(page, "/dashboard");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    const readBg = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
      );
    const lightBg = await readBg();

    // ThemeToggle renders a radiogroup, not plain buttons.
    await page.getByRole("radio", { name: "Dark theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("radio", { name: "Dark theme" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Layer-2 tokens must actually change. If they don't, a component is
    // hardcoding hexes and dark mode is only cosmetically applied.
    expect(await readBg()).not.toBe(lightBg);
  });

  /**
   * Both brand faces come from Google Fonts over the network. Enumerating
   * `document.fonts` was flaky under parallel projects — a dozen contexts
   * requesting fonts.googleapis.com at once means some FontFaceSets are still
   * filling when `status` first reads "loaded".
   *
   * `document.fonts.ready` is the correct signal, and `check()` asks the real
   * question — "would this face render?" — rather than inspecting the registry.
   */
  test("both brand typefaces are available and applied", async ({ page }) => {
    await gotoApp(page, "/login");
    await page.evaluate(() => document.fonts.ready);

    const available = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        display: document.fonts.check("700 16px 'Plus Jakarta Sans'"),
        sans: document.fonts.check("400 16px 'Inter'"),
      };
    });
    expect(available.display, "Plus Jakarta Sans did not load").toBe(true);
    expect(available.sans, "Inter did not load").toBe(true);

    // And the cascade actually routes each role to the right face.
    const h1Font = await page
      .getByRole("heading", { level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font, "h1 should use the display face").toMatch(/Plus Jakarta Sans/);

    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont, "body should use the sans face").toMatch(/Inter/);
  });
});
