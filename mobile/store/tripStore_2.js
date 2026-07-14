import { create } from 'zustand';

export const useTripStore = create((set) => ({
  podUploaded: false,
  preDispatchUploaded: false,
  activeTrip:  null,

  setPodUploaded:          (val)  => set({ podUploaded: val }),
  setPreDispatchUploaded:  (val)  => set({ preDispatchUploaded: val }),
  setActiveTrip:  (trip) => set({ activeTrip: trip }),
  resetTripStore: ()     => set({ podUploaded: false, preDispatchUploaded: false, activeTrip: null }),
}));

export default useTripStore;
