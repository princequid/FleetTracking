import { create } from 'zustand';
import api from '../services/api_1';

const PROFILE_TTL_MS = 60_000; // driver profile rarely changes minute-to-minute
const STATS_TTL_MS   = 30_000; // trip counters move faster

// Module-level (not store state) so concurrent callers — splash prefetch,
// dashboard, profile — share one network call instead of firing three.
let inFlightProfile = null;
let inFlightStats   = null;

export const useDriverStore = create((set, get) => ({
  driver: null,
  stats: null,
  profileFetchedAt: null,
  statsFetchedAt: null,

  // Resolves with the cached driver if still fresh, otherwise fetches once and
  // shares the in-flight promise with any other caller that asks meanwhile.
  fetchProfile: (userId, { force = false } = {}) => {
    if (!userId) return Promise.resolve(null);
    const { driver, profileFetchedAt } = get();
    const isFresh = profileFetchedAt && Date.now() - profileFetchedAt < PROFILE_TTL_MS;
    if (driver && isFresh && !force) return Promise.resolve(driver);
    if (inFlightProfile) return inFlightProfile;

    inFlightProfile = api.get(`/drivers/user/${userId}`)
      .then((r) => {
        set({ driver: r.data, profileFetchedAt: Date.now() });
        return r.data;
      })
      .finally(() => { inFlightProfile = null; });
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

  clearDriver: () => set({ driver: null, stats: null, profileFetchedAt: null, statsFetchedAt: null }),
}));

export default useDriverStore;
