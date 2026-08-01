import { create } from "zustand";
import { persist } from "zustand/middleware";
// Safe to import here: listCache has no imports of its own, so this can't form a cycle
// with services/api.js (which imports this store).
import { clearListCache } from "../services/listCache";

// Persisted to localStorage so a page reload restores the session instead of silently
// logging the admin out (PrivateRoute redirects to /login whenever isLoggedIn is false,
// and without persistence a reload always reset it to that default).
export const useAuthStore = create(
  persist(
    (set) => ({
      isLoggedIn: false,
      userId: null,
      email: null,
      role: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (data) =>
        set({
          isLoggedIn: true,
          userId: data.userId ?? null,
          email: data.email ?? null,
          role: data.role ?? null,
          accessToken: data.accessToken ?? null,
          refreshToken: data.refreshToken ?? null,
        }),

      clearAuth: () => {
        // Drop every cached list on sign-out / forced logout. Without this the cache
        // outlives the session (it's module state, and a logout is a client-side route
        // change, not a page load), so the next admin to sign in on the same tab could
        // be served the previous one's driver and trip records for up to the TTL.
        clearListCache();
        set({
          isLoggedIn: false,
          userId: null,
          email: null,
          role: null,
          accessToken: null,
          refreshToken: null,
        });
      },
    }),
    { name: "fleettrack-auth" },
  ),
);

// Compatibility shim for non-component callers (Sidebar logout, etc.)
export const authStore = {
  getAuth: () => useAuthStore.getState(),
  setAuth: (data) => useAuthStore.getState().setAuth(data),
  clearAuth: () => useAuthStore.getState().clearAuth(),
};
