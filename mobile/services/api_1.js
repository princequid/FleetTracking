import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

// Backend gateway URL. Override per-device/network without editing code by setting
// EXPO_PUBLIC_API_URL in a .env file (e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:8080).
// The phone MUST be on the same network as the machine running the backend, and that
// IP must be reachable from the phone. 172.20.10.x is an iPhone hotspot subnet.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.137.1:8080';

// Auth endpoints that must never trigger the refresh interceptor
const AUTH_PATHS = ['/auth/login', '/auth/logout', '/auth/refresh'];
const isAuthEndpoint = (url = '') => AUTH_PATHS.some((p) => url.includes(p));

// Shared in-flight refresh call — when several requests 401 concurrently, they all
// await this ONE /auth/refresh call instead of each firing their own. With rotating
// refresh tokens, concurrent independent refresh calls can race and invalidate a
// sibling's just-issued token, causing spurious forced logouts.
let refreshPromise = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach access token ──────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('ft_access_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response: refresh on 401, skip for auth endpoints ─────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    const is401       = error.response?.status === 401;
    const alreadyTried = original?._retry;
    const skipRefresh  = isAuthEndpoint(original?.url);

    if (is401 && !alreadyTried && !skipRefresh) {
      original._retry = true;
      try {
        // If a refresh is already in flight (triggered by a sibling request that
        // 401'd first), await that ONE call instead of starting a new /auth/refresh —
        // otherwise two concurrent refreshes can race and invalidate each other's
        // rotated token.
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = await SecureStore.getItemAsync('ft_refresh_token');
            if (!refreshToken) throw new Error('no_refresh_token');

            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });

            await SecureStore.setItemAsync('ft_access_token',  data.accessToken);
            await SecureStore.setItemAsync('ft_refresh_token', data.refreshToken);
            return data;
          })().finally(() => { refreshPromise = null; });
        }

        const data = await refreshPromise;
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Tokens are invalid — clear everything and send user to login
        await SecureStore.deleteItemAsync('ft_access_token');
        await SecureStore.deleteItemAsync('ft_refresh_token');
        try {
          // Lazy-import to avoid circular dep at module load time
          const { useAuthStore } = await import('../store/authStore_1');
          const { useDriverStore } = await import('../store/driverStore_1');
          useAuthStore.getState().clearAuth();
          useDriverStore.getState().clearDriver();
        } catch {}
        router.replace('/(auth)/login_1');
      }
    }

    return Promise.reject(error);
  },
);

export default api;
