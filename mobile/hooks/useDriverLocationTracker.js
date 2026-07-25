import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useNavStore } from '../store/navStore_2';

// Module-level singleton so there is only ever ONE location subscription for the whole
// driver session, regardless of how many screens mount this hook or how often they
// re-render. This keeps GPS flowing as the driver moves between screens and avoids the
// "multiple listeners / memory leak" problem.
let subscription = null;
let starting = false;

async function ensureTracking() {
  if (subscription || starting) return;
  starting = true;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') { starting = false; return; }

    // Seed immediately with the last-known fix so consumers have a position at once.
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
        useNavStore.getState().setLocation({ ...last.coords, timestamp: last.timestamp });
      }
    } catch { /* ignore */ }

    subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 8 },
      (loc) => useNavStore.getState().setLocation({ ...loc.coords, timestamp: loc.timestamp }),
    );
  } catch { /* ignore — will retry on next mount */ }
  starting = false;
}

export function stopDriverLocationTracker() {
  subscription?.remove?.();
  subscription = null;
}

/**
 * Mount ONCE high in the driver navigation tree (the driver layout). The single shared
 * watch then survives navigation between driver screens (Map, Earnings, etc.). It's only
 * torn down when the driver layout itself unmounts (e.g. logout / leaving the driver area).
 */
export function useDriverLocationTracker() {
  useEffect(() => {
    ensureTracking();
    return () => { stopDriverLocationTracker(); };
  }, []);
}

export default useDriverLocationTracker;
