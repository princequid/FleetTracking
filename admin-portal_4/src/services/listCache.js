// Short-lived in-memory cache for list endpoints.
//
// ── The problem it solves ─────────────────────────────────────────────────────────────
// Every page fetches on mount (`useEffect(() => load(), [])`). React Router unmounts a
// page when you navigate away, so returning to it remounts the component and re-runs that
// fetch — the list blanks to a skeleton and refills, even though you were looking at the
// same data two seconds ago. Worse, several pages fetch the SAME endpoints (Dashboard,
// Drivers, Trips and Dispatch all call getTrips), so a single tour of the app fires the
// same request repeatedly.
//
// ── Why the TTL is 15 seconds ─────────────────────────────────────────────────────────
// This is deliberately tuned BELOW the app's two polling intervals — DashboardPage polls
// at 30s and LiveMapPage's meta refresh at 20s. A cache entry is therefore always stale by
// the time a poller asks for it, so live-updating screens keep updating exactly as before
// and needed no changes. Raising this above 20s would silently break that: the pollers
// would start being served cached data and the dashboard would stop refreshing.
//
// It is comfortably longer than a navigation round-trip, which is the actual complaint.
//
// ── Deliberately NOT cached ───────────────────────────────────────────────────────────
// getActivePositions() — live vehicle coordinates, where staleness is the whole problem.
//
// ── Scope ─────────────────────────────────────────────────────────────────────────────
// Memory only, cleared on page reload. Nothing is persisted: this data is
// authorization-scoped, and putting it in localStorage would leave a copy of the fleet's
// driver/trip records readable by any script on the page (see the token-storage note in
// docs/AUDIT_REPORT_2026-07-31.md, S-1).

const TTL_MS = 15_000;

// key -> { at: epochMs, value: unknown }
const entries = new Map();
// key -> Promise, so concurrent callers share one request instead of racing.
// Two components mounting in the same tick (Dashboard's four parallel loads, say) would
// otherwise each fire their own.
const inFlight = new Map();

/**
 * Returns cached data when fresh, otherwise calls `fetcher` and caches the result.
 *
 * @param {string}   key      cache key — include any filter that changes the response
 * @param {Function} fetcher  () => Promise<T>, invoked only on a miss
 * @param {object}  [opts]
 * @param {boolean} [opts.force]  skip the cache and refetch (also refreshes the entry)
 * @returns {Promise<T>}
 */
export function cached(key, fetcher, { force = false } = {}) {
  if (!force) {
    const hit = entries.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return Promise.resolve(hit.value);
    }
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const request = fetcher()
    .then((value) => {
      entries.set(key, { at: Date.now(), value });
      return value;
    })
    // A failed request must not be cached — the next attempt should hit the network
    // again rather than replaying the error or, worse, resolving with undefined.
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/**
 * Synchronous cache read. Returns `undefined` on a miss or a stale entry.
 *
 * This exists because caching the *data* alone did not stop pages appearing to reload.
 * A page still mounts with `useState([])` + `useState(true)` for loading, paints that
 * empty skeleton, and only fills in when the cached promise resolves one microtask later
 * — visually identical to a real refetch despite zero network traffic.
 *
 * Reading synchronously during `useState`'s initialiser lets a page start already
 * populated, with `loading` false, so returning to it renders the list on the first paint.
 *
 * Callers MUST distinguish `undefined` (miss) from a legitimately empty list (`[]`),
 * hence `undefined` rather than `null` — an empty fleet is a cache hit, not a miss.
 *
 * @param {string} key
 * @returns {unknown | undefined}
 */
export function peek(key) {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  return undefined;
}

/**
 * Drops cache entries so the next read refetches. Call after any mutation.
 *
 * Matches by PREFIX, because filtered lists are cached under composite keys
 * (`trips:all`, `trips:DELIVERED`, …) and creating a trip invalidates every one of them,
 * not just the filter that happens to be on screen.
 *
 * @param {...string} prefixes
 */
export function invalidate(...prefixes) {
  for (const prefix of prefixes) {
    for (const key of entries.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) entries.delete(key);
    }
    for (const key of inFlight.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) inFlight.delete(key);
    }
  }
}

/** Wipe everything — used on sign-out so the next admin never sees the previous one's data. */
export function clearListCache() {
  entries.clear();
  inFlight.clear();
}
