import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore_1';
import { useDriverStore } from '../store/driverStore_1';

// After the app has been backgrounded for this long, require the driver to sign in
// again. This is the standard mobile "session timeout" — it protects a lost/left
// device without disrupting active use (a foregrounded, in-use app never times out).
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

export function useInactivityLogout() {
  const backgroundedAt = useRef(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      // Only count a real background transition. iOS 'inactive' (app-switcher
      // preview, incoming call, Control Center) is transient — ignore it so we
      // never sign the user out for momentarily leaving the foreground.
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }

      if (state === 'active' && backgroundedAt.current != null) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (elapsed >= INACTIVITY_LIMIT_MS) {
          try { await SecureStore.deleteItemAsync('ft_access_token'); } catch {}
          try { await SecureStore.deleteItemAsync('ft_refresh_token'); } catch {}
          try { useAuthStore.getState().clearAuth(); } catch {}
          try { useDriverStore.getState().clearDriver(); } catch {}
          router.replace('/(auth)/login_1');
        }
      }
    });

    return () => sub.remove();
  }, []);
}

export default useInactivityLogout;
