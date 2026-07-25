import { create } from 'zustand';

/**
 * Tracks the driver's active trips so the Alerts tab can show a red "unseen" dot.
 *  - activeIds : ids of currently-active trips (assigned/started/…), refreshed by a
 *                lightweight global poller in the driver layout.
 *  - seenIds   : ids the driver has already viewed (set when they open the Alerts page).
 * The dot shows when there's an active trip not yet seen.
 */
export const useAlertsStore = create((set, get) => ({
  activeIds: [],
  seenIds: [],
  setActiveIds: (ids) => set({ activeIds: Array.isArray(ids) ? ids : [] }),
  markAllSeen: () => set({ seenIds: [...get().activeIds] }),
  reset: () => set({ activeIds: [], seenIds: [] }),
}));

export default useAlertsStore;
