import { create } from 'zustand';

export const useTripStore = create((set) => ({
  podUploaded: false,
  preDispatchUploaded: false,
  activeTrip:  null,
  // Ids of intermediate stops that already have an (optional) STOP_POD captured this
  // trip — used by the map to hide the "Deliver POD" button once done for a stop.
  // Kept separate from podUploaded so a stop POD never unlocks final trip completion.
  stopPods: [],

  setPodUploaded:          (val)  => set({ podUploaded: val }),
  setPreDispatchUploaded:  (val)  => set({ preDispatchUploaded: val }),
  setActiveTrip:  (trip) => set({ activeTrip: trip }),
  addStopPod: (stopId) => set((s) => (
    stopId == null || s.stopPods.includes(stopId)
      ? s
      : { stopPods: [...s.stopPods, stopId] }
  )),
  resetTripStore: ()     => set({ podUploaded: false, preDispatchUploaded: false, activeTrip: null, stopPods: [] }),
}));

export default useTripStore;
