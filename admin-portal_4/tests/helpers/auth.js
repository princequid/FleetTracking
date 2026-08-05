/**
 * Session seeding for UI audits.
 *
 * The portal guards every internal route with `PrivateRoute`, which reads
 * `isLoggedIn` from the zustand store persisted to localStorage under
 * `fleettrack-auth`. Writing that key directly lets a UI/UX spec reach
 * /dashboard, /trips, /map etc. without a running auth backend.
 *
 * This is deliberately NOT a login-flow test — it bypasses login on purpose so
 * layout and accessibility can be audited on the real page shells. The login
 * flow itself is covered against the live API separately, by hand.
 */

const STORAGE_KEY = "fleettrack-auth";

/** Roles the route guards branch on (mirrors constants/roles.js). */
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  DISPATCHER: "DISPATCHER",
  // Not a portal role — present so role-access.spec.js can seed the session the
  // layout guard is meant to reject. Don't seed it in a UI/UX audit spec; those
  // expect to land on a page, and this one gets bounced to /login.
  DRIVER: "DRIVER",
};

/**
 * Seeds a persisted session before the app boots.
 *
 * Must run via `addInitScript` rather than after `goto`, because zustand reads
 * localStorage once at module evaluation — setting it post-load would need a
 * reload to take effect.
 */
export async function seedSession(page, { role = ROLES.SUPER_ADMIN } = {}) {
  const payload = JSON.stringify({
    state: {
      isLoggedIn: true,
      userId: 1,
      email: "ui-audit@fleetsync.test",
      role,
      accessToken: "ui-audit-token",
      refreshToken: "ui-audit-refresh",
    },
    version: 0,
  });

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, payload],
  );
}

/**
 * Forces a theme preference before first paint so dark-mode audits are
 * deterministic instead of following whatever the CI machine's OS reports.
 * The key and accepted values match ThemeContext.jsx / the inline script in
 * index.html — "system" is the app's default.
 */
export async function seedTheme(page, theme /* "light" | "dark" | "system" */) {
  await page.addInitScript(
    ([value]) => window.localStorage.setItem("ft-admin-theme", value),
    [theme],
  );
}

/**
 * Navigates and waits for the inline boot loader to hand off to React.
 *
 * index.html paints #boot-loader on every route and main.jsx removes it ~450ms
 * after the first real frame. Without waiting for that, a spec can assert
 * against the loading splash instead of the page underneath it.
 */
export async function gotoApp(page, path) {
  await page.goto(path);
  await page
    .locator("#boot-loader")
    .waitFor({ state: "detached", timeout: 15_000 });
}

/**
 * Waits for a page to stop changing before measuring or auditing it.
 *
 * Replaces a fixed `waitForTimeout`, which was the source of the only flake in
 * this suite: with three viewport projects running fully parallel, a dozen
 * contexts compete for CPU and a heavy page (/dispatch mounts a Leaflet picker
 * and an autocomplete) can still be mid-render after an arbitrary 600ms — so axe
 * would scan a transient state and report violations that don't exist once
 * settled.
 *
 * `networkidle` is reliable here precisely *because* the API is stubbed: every
 * request resolves immediately from the route handler, so idle means "the page
 * finished reacting to its data", not "the backend is slow".
 */
export async function settle(page) {
  await page.waitForLoadState("networkidle");
  // Two frames after idle: lets React flush the state update the last response
  // triggered, and lets any CSS transition on the newly-mounted content finish
  // its first paint before contrast is sampled.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
