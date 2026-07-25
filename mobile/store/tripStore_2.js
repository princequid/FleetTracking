import { create } from 'zustand';

export const useTripStore = create((set) => ({
  podUploaded: false,
  activeTrip:  null,

  setPodUploaded: (val)  => set({ podUploaded: val }),
  setActiveTrip:  (trip) => set({ activeTrip: trip }),
  resetTripStore: ()     => set({ podUploaded: false, activeTrip: null }),
}));

export default useTripStore;
