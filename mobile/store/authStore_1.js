import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const AUTH_KEY = 'ft_auth_identity';

export const useAuthStore = create((set) => ({
  isLoggedIn: false,
  userId: null,
  role: null,
  email: null,

  setLoggedIn: (userId, role, email) => {
    set({ isLoggedIn: true, userId, role, email });
    // Fire-and-forget: lets a later cold start (app killed, token still valid)
    // restore userId/role/email via hydrate() instead of losing them, since this
    // store itself is in-memory only and resets on every JS engine restart.
    SecureStore.setItemAsync(AUTH_KEY, JSON.stringify({ userId, role, email })).catch(() => {});
  },

  // Restores identity from a prior session when the access token in SecureStore
  // is still valid but the app process was killed and relaunched (splash skips
  // the login screen in that case, so setLoggedIn never runs again).
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(AUTH_KEY);
      if (!raw) return null;
      const { userId, role, email } = JSON.parse(raw);
      set({ isLoggedIn: true, userId, role, email });
      return userId;
    } catch {
      return null;
    }
  },

  clearAuth: () => {
    set({ isLoggedIn: false, userId: null, role: null, email: null });
    SecureStore.deleteItemAsync(AUTH_KEY).catch(() => {});
  },
}));

export default useAuthStore;
