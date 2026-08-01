import { create } from 'zustand';
import api from '../services/api_1';
import { TRIP_PAGE_SIZE } from '../constants/config';

/**
 * One cached copy of the driver's trip list, shared by every screen that needs it.
 *
 * ## Why
 *
 * Home, Trips and Alerts each called `GET /trips?size=…` from their own
 * `useEffect`/`useFocusEffect` and kept their own `useState` copy of the result.
 * Three screens, three requests, three slightly-different derivations of the
 * same payload — and because each one owned its data, arriving on a screen
 * always meant a spinner even when an identical response had come back two
 * seconds earlier on the tab next door.
 *
 * They now read from here. The endpoint, the params and the response-shape
 * handling are unchanged; only the ownership moved.
 *
 * ## Stale-while-revalidate
 *
 * `ensureFresh()` is what screens call when they appear. It:
 *
 *   - returns immediately if the cache is younger than `STALE_AFTER_MS`;
 *   - otherwise refreshes **in the background**, leaving the existing trips in
 *     place so the screen renders instantly with slightly-old data rather than
 *     flashing a skeleton it already has the content for;
 *   - de-duplicates concurrent callers, so three tabs waking at once still make
 *     one request.
 *
 * `loading` is therefore only ever true on the very first load, when there is
 * genuinely nothing to show. A background refresh sets `refreshing`, which the
 * screens deliberately do not use to blank themselves.
 */

/** How long a response is considered current. Matches the Alerts poll interval. */
const STALE_AFTER_MS = 15_000;

/** Normalises the three response shapes the API has been observed to return. */
function toArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.content)) return raw.content;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

/**
 * Cheap identity check so an unchanged poll doesn't publish a new array and
 * re-render every subscriber. Trips are compared on the fields the list views
 * actually render — a GPS ping that only moved `updatedAt` should not repaint
 * three screens.
 */
function sameTrips(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.eta !== y.eta ||
      x.destination !== y.destination ||
      x.origin !== y.origin ||
      x.completedAt !== y.completedAt ||
      x.cancelledAt !== y.cancelledAt
    ) {
      return false;
    }
  }
  return true;
}

export const useTripsCacheStore = create((set, get) => ({
  trips: [],
  loading: true,
  refreshing: false,
  error: '',
  lastFetchedAt: 0,
  /** In-flight request, so concurrent callers share one round trip. */
  _inflight: null,

  /**
   * Fetches unconditionally. Use for pull-to-refresh, or after an action that
   * changed a trip server-side.
   */
  refresh: async () => {
    const existing = get()._inflight;
    if (existing) return existing;

    const isFirstLoad = get().lastFetchedAt === 0;
    set(isFirstLoad ? { loading: true, error: '' } : { refreshing: true, error: '' });

    const request = api
      .get('/trips', { params: { size: TRIP_PAGE_SIZE } })
      .then((res) => {
        const next = toArray(res.data);
        const prev = get().trips;
        set({
          // Keep the previous array identity when nothing meaningful changed, so
          // `useMemo`/`React.memo` downstream can bail out of re-rendering.
          trips: sameTrips(prev, next) ? prev : next,
          loading: false,
          refreshing: false,
          error: '',
          lastFetchedAt: Date.now(),
          _inflight: null,
        });
        return next;
      })
      .catch((err) => {
        // A failed refresh must not wipe trips the driver can still usefully see;
        // it reports the failure and leaves the last good data on screen.
        set({
          loading: false,
          refreshing: false,
          error: 'Could not load trips.',
          _inflight: null,
        });
        throw err;
      });

    set({ _inflight: request });
    // Swallow here so a caller that doesn't await never triggers an unhandled
    // rejection; `error` in the store is the reporting channel.
    return request.catch(() => get().trips);
  },

  /** Refreshes only if the cache has gone stale. Safe to call on every focus. */
  ensureFresh: async () => {
    const { lastFetchedAt, _inflight } = get();
    if (_inflight) return _inflight;
    if (lastFetchedAt && Date.now() - lastFetchedAt < STALE_AFTER_MS) return get().trips;
    return get().refresh();
  },

  /**
   * Applies a local change to one trip without a round trip, so a screen that
   * just performed an action reflects it immediately and every other tab agrees.
   */
  patchTrip: (id, patch) =>
    set((s) => ({
      trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  /** Called on sign-out — the next driver must not see the previous one's trips. */
  reset: () =>
    set({ trips: [], loading: true, refreshing: false, error: '', lastFetchedAt: 0, _inflight: null }),
}));

export default useTripsCacheStore;
