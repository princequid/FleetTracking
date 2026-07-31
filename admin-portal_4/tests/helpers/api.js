/**
 * Network isolation for UI audits.
 *
 * `.env` points local dev at the **live production backend**
 * (`VITE_API_BASE_URL=https://fleettrack.duckdns.org`). Left alone, every audit
 * run would fire authenticated requests at production with the fake token from
 * `seedSession`, get real 401s, and then `api.js`'s response interceptor does
 * `window.location.href = "/login"` — a hard navigation that rips the page out
 * from under axe mid-scan ("Execution context was destroyed").
 *
 * So audits stub the API at the network layer. Three things that buys us:
 *   1. No test traffic ever reaches production.
 *   2. Deterministic pages — the same audit result on every run and offline.
 *   3. Deliberate control of empty vs. populated vs. error states, which is the
 *      surface a UI audit most needs to reach.
 */

import { populatedBodyFor } from "./fleet-data.js";

/** Paths whose contract is a bare array. Everything else gets an object. */
const COLLECTION_PATTERNS = [
  /\/trips$/,
  /\/drivers$/,
  /\/drivers\/available$/,
  /\/vehicles$/,
  /\/vehicles\/available$/,
  /\/incidents$/,
  /\/auth\/staff$/,
  /\/gps\/trips\/active$/,
  /\/analytics\/deliveries\/daily$/,
  /\/analytics\/drivers\/leaderboard$/,
  /\/trips\/\d+\/history$/,
  /\/incidents\/trips\/\d+$/,
  /\/media\/photos\/trips\/\d+$/,
];

/**
 * Fleet summary is the one endpoint with a shape the dashboard reads field by
 * field, so an empty object would render "undefined" tiles. Zeroes keep the KPI
 * cards honest — the page is genuinely showing "no data", not inventing numbers.
 */
const FLEET_SUMMARY = {
  totalVehicles: 0,
  activeVehicles: 0,
  totalDrivers: 0,
  activeDrivers: 0,
  totalTrips: 0,
  activeTrips: 0,
  completedTrips: 0,
  pendingTrips: 0,
};

function bodyFor(pathname) {
  if (/\/analytics\/fleet\/summary$/.test(pathname)) return FLEET_SUMMARY;
  if (COLLECTION_PATTERNS.some((re) => re.test(pathname))) return [];
  return {};
}

/**
 * Stubs the backend and blocks third-party traffic.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ mode?: "empty" | "populated" | "error" }} options
 *   "empty" (default) — 200s with empty collections, so pages render their
 *   populated-but-empty state. "populated" — 200s with the fleet fixtures, so
 *   table rows, badges, avatars and row actions actually render. "error" —
 *   500s, so pages render error states.
 *   No mode returns 401: that path deliberately triggers a hard redirect, which
 *   is app behaviour worth keeping and not something to audit through.
 *
 * "populated" exists because the empty-only stub was hiding real defects: a
 * contrast sweep over `[]` collections scans no table cells at all, so every
 * badge, avatar and row-action button went unaudited and passed by absence.
 */
export async function stubApi(page, { mode = "empty" } = {}) {
  // Both the configured production origin and the localhost fallback, so this
  // keeps working whichever way .env is pointed.
  await page.route(
    (url) =>
      /fleettrack\.duckdns\.org$/.test(url.hostname) ||
      (url.hostname === "localhost" && url.port === "8080"),
    async (route) => {
      const { pathname } = new URL(route.request().url());

      if (mode === "error") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Stubbed failure for UI audit" }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          mode === "populated" ? populatedBodyFor(pathname) : bodyFor(pathname),
        ),
      });
    },
  );

  // Map tiles, OSRM routing and Google Maps: real network calls that make audits
  // slow and flaky, and that we neither control nor are auditing. Tiles resolve
  // as a 1×1 transparent PNG so Leaflet still lays out its grid normally.
  await page.route(
    (url) =>
      /tile\.openstreetmap\.org$/.test(url.hostname) ||
      // LiveMapPage's basemap. Was reaching the real CDN on every audit run.
      /basemaps\.cartocdn\.com$/.test(url.hostname) ||
      /router\.project-osrm\.org$/.test(url.hostname) ||
      /(^|\.)googleapis\.com$/.test(url.hostname) ||
      /(^|\.)gstatic\.com$/.test(url.hostname),
    async (route) => {
      if (route.request().resourceType() === "image") {
        return route.fulfill({
          status: 200,
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AABAAA//8AAgABYQAAAAAASUVORK5CYII=",
            "base64",
          ),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    },
  );

  // Google Fonts must NOT be stubbed — the design system asserts both faces
  // load, and blocking them would silently fall back to system fonts and change
  // every screenshot.
}
