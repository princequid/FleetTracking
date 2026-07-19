import { create } from 'zustand';
import api from '../services/api_1';
import { useAuthStore } from './authStore_1';

const PROFILE_TTL_MS = 60_000; // driver profile rarely changes minute-to-minute
const STATS_TTL_MS   = 30_000; // trip counters move faster

// Module-level (not store state) so concurrent callers — splash prefetch,
// dashboard, profile — share one network call instead of firing three.
// inFlightProfileUserId records WHICH user that shared call is for, so a fresh
// login for a different userId never piggybacks on it (see fetchProfile below) —
// e.g. splash prefetching a stale hydrated userId's profile, then a driver logging
// in as someone else before that prefetch resolves.
let inFlightProfile = null;
let inFlightProfileUserId = null;
let inFlightStats   = null;

export const useDriverStore = create((set, get) => ({
  driver: null,
  stats: null,
  driverUserId: null,
  profileFetchedAt: null,
  statsFetchedAt: null,

  // Resolves with the cached driver if still fresh AND for this same userId,
  // otherwise fetches once and shares the in-flight promise with any other caller
  // that asks meanwhile. The userId check matters even though every known logout
  // path clears this store: it's a second line of defense so a cached profile can
  // never be served to a different driver if some future logout path forgets to
  // (this is exactly how a stale profile from a timed-out session was briefly
  // showing up for the next login before this was added).
  fetchProfile: (userId, { force = false } = {}) => {
    if (!userId) return Promise.resolve(null);
    const { driver, driverUserId, profileFetchedAt } = get();
    const isFresh = profileFetchedAt && Date.now() - profileFetchedAt < PROFILE_TTL_MS;
    if (driver && driverUserId === userId && isFresh && !force) return Promise.resolve(driver);
    if (inFlightProfile && inFlightProfileUserId === userId) return inFlightProfile;

    inFlightProfileUserId = userId;
    inFlightProfile = api.get(`/drivers/user/${userId}`)
      .then((r) => {
        // Guard against a slow, superseded request (e.g. splash's prefetch for a
        // stale hydrated userId) resolving AFTER a newer login's own fetch and
        // clobbering the correct, already-committed profile — network responses
        // aren't guaranteed to resolve in the order they were sent. Only commit if
        // this response is still for whoever is actually logged in right now.
        if (useAuthStore.getState().userId === userId) {
          set({ driver: r.data, driverUserId: userId, profileFetchedAt: Date.now() });
        }
        return r.data;
      })
      .finally(() => {
        inFlightProfile = null;
        inFlightProfileUserId = null;
      });
    return inFlightProfile;
  },

  fetchStats: (driverId, { force = false } = {}) => {
    if (!driverId) return Promise.resolve(null);
    const { stats, statsFetchedAt } = get();
    const isFresh = statsFetchedAt && Date.now() - statsFetchedAt < STATS_TTL_MS;
    if (stats && isFresh && !force) return Promise.resolve(stats);
    if (inFlightStats) return inFlightStats;

    inFlightStats = api.get(`/drivers/${driverId}/stats`)
      .then((r) => {
        set({ stats: r.data, statsFetchedAt: Date.now() });
        return r.data;
      })
      .finally(() => { inFlightStats = null; });
    return inFlightStats;
  },

  clearDriver: () => set({ driver: null, stats: null, driverUserId: null, profileFetchedAt: null, statsFetchedAt: null }),
}));

export default useDriverStore;
