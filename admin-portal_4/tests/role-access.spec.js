import { test, expect } from "./fixtures.js";
import { gotoApp, seedSession, ROLES } from "./helpers/auth.js";

/**
 * The portal is staff-only, and this pins both directions of that rule.
 *
 * Drivers could previously sign in here. Nothing leaked — every service rejects
 * a DRIVER token — but they reached a full admin shell where each page rendered
 * its error state, which reads as broken software rather than as a boundary.
 *
 * The reason this is worth a spec rather than a code comment is the opposite
 * failure: the obvious way to write the guard is to reuse STAFF_ROLES, which
 * excludes DISPATCHER and would silently lock dispatchers out of the entire
 * product. Both halves have to hold, so both are asserted here.
 *
 * Unlike the rest of this suite these tests do exercise the login flow, with
 * /auth/login stubbed — the seeding helper deliberately bypasses login, so it
 * cannot cover the check that happens during it.
 */

function stubLogin(page, role) {
  return page.route(/\/auth\/login$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userId: 1,
        email: "someone@fleetsync.test",
        role,
        accessToken: "stub-access",
        refreshToken: "stub-refresh",
      }),
    }),
  );
}

async function signIn(page) {
  await page.fill('input[type="email"]', "someone@fleetsync.test");
  await page.fill('input[type="password"]', "a-password");
  await page.getByRole("button", { name: /sign in/i }).click();
}

test("a driver signing in is turned away and told where to go", async ({ page }) => {
  await stubLogin(page, ROLES.DRIVER);
  await gotoApp(page, "/login");
  await signIn(page);

  await expect(page.getByText(/FleetSync driver app/i)).toBeVisible();
  expect(page.url()).toContain("/login");
  expect(page.url()).not.toContain("/dashboard");
});

test("a rejected driver login leaves no session behind", async ({ page }) => {
  await stubLogin(page, ROLES.DRIVER);
  await gotoApp(page, "/login");
  await signIn(page);
  await expect(page.getByText(/FleetSync driver app/i)).toBeVisible();

  // Valid credentials still must not produce a stored session, or the next
  // visit walks straight into the shell without passing the check again.
  const stored = await page.evaluate(() =>
    window.localStorage.getItem("fleettrack-auth"),
  );
  expect(stored === null || !JSON.parse(stored).state.isLoggedIn).toBe(true);
});

test("a stale driver session is ejected without a redirect loop", async ({ page }) => {
  await seedSession(page, { role: ROLES.DRIVER });

  // The loop this guards against: the layout guard bounces a driver to
  // /dashboard, which lives inside the guarded route, which bounces again. If
  // that regresses, the page never settles and gotoApp times out here rather
  // than reaching an assertion.
  await gotoApp(page, "/dashboard");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/FleetSync driver app/i)).toBeVisible();
});

/**
 * The regression that matters most: DISPATCHER is staff and belongs here, but
 * is absent from STAFF_ROLES (which names the *narrower* set allowed on
 * incidents/reports/staff). Guarding the layout with that list instead of
 * PORTAL_ROLES locks out every dispatcher in the company.
 */
for (const role of [ROLES.DISPATCHER, ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
  test(`${role} still reaches the dashboard`, async ({ page }) => {
    await seedSession(page, { role });
    await gotoApp(page, "/dashboard");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator(".sidebar-role-pill")).toHaveText(role);
  });
}
