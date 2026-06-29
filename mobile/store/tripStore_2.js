import { create } from 'zustand';

export const useTripStore = create((set) => ({
  podUploaded: false,
  activeTrip: null,

  setPodUploaded: (uploaded) => set({ podUploaded: uploaded }),

  setActiveTrip: (trip) => set({ activeTrip: trip }),
}));

export default useTripStore;
