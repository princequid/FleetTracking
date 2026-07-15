import { create } from 'zustand';

/**
 * Drives the direction of the driver stack's screen-transition animation for
 * tab-bar navigation (Home/Trips/Alerts/Profile).
 *
 *  - 'forward' : slide in from the right — moving to a tab further right in the bar.
 *  - 'back'    : slide in from the left — moving to a tab further left in the bar.
 *
 * Defaults to 'forward' so any navigation NOT triggered by the tab bar (e.g. pushing
 * into a trip's details from a card) keeps the normal forward feel.
 */
export const useTabTransitionStore = create((set) => ({
  direction: 'forward',
  setDirection: (dir) => set({ direction: dir }),
}));

export default useTabTransitionStore;
