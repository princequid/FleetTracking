import { create } from "zustand";
import { persist } from "zustand/middleware";

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

      clearAuth: () =>
        set({
          isLoggedIn: false,
          userId: null,
          email: null,
          role: null,
          accessToken: null,
          refreshToken: null,
        }),
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
