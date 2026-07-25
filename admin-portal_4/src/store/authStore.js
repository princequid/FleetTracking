import { create } from "zustand";

export const useAuthStore = create((set) => ({
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
}));

// Compatibility shim for non-component callers (Sidebar logout, etc.)
export const authStore = {
  getAuth: () => useAuthStore.getState(),
  setAuth: (data) => useAuthStore.getState().setAuth(data),
  clearAuth: () => useAuthStore.getState().clearAuth(),
};
