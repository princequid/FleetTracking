import { create } from 'zustand';

/**
 * Global navigation/map state — lives outside the Map screen so it survives navigation
 * and the map never resets when reopened.
 *
 *  - location : latest live GPS fix, written by the shared tracker in the driver layout.
 *               Updating this does NOT move the camera; the marker reads it directly.
 *  - camera   : the last map camera (centre/zoom/heading/pitch), keyed by trip so
 *               returning to the map restores the exact view the driver left.
 */
export const useNavStore = create((set, get) => ({
  // ── Live GPS ────────────────────────────────────────────────────────────────
  location: null,          // { latitude, longitude, heading, speed, accuracy, timestamp }
  setLocation: (loc) => set({ location: loc }),

  // ── Persisted map camera (per trip) ──────────────────────────────────────────
  camera: null,            // { latitude, longitude, zoom, heading, pitch }
  cameraTripId: null,
  setCamera: (tripId, cam) => set({ camera: cam, cameraTripId: tripId }),
  getCamera: (tripId) => {
    const s = get();
    return s.cameraTripId != null && String(s.cameraTripId) === String(tripId) ? s.camera : null;
  },

  // Clear camera when a trip ends so a new trip starts fresh
  clearCamera: (tripId) => {
    if (String(get().cameraTripId) === String(tripId)) set({ camera: null, cameraTripId: null });
  },

  reset: () => set({ location: null, camera: null, cameraTripId: null }),
}));

export default useNavStore;
