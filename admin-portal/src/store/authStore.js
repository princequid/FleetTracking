import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  isLoggedIn: false,
  userId: null,
  role: null,
  accessToken: null,
  refreshToken: null,
  setAuth: (data) => set({
    isLoggedIn: true,
    userId: data.userId || null,
    role: data.role || null,
    accessToken: data.accessToken || null,
    refreshToken: data.refreshToken || null,
  }),
  clearAuth: () => set({
    isLoggedIn: false,
    userId: null,
    role: null,
    accessToken: null,
    refreshToken: null,
  }),
}));

export const getAuthStore = () => {
  const state = useAuthStore.getState();
  return {
    ...state,
    setAuth: state.setAuth,
    clearAuth: state.clearAuth,
  };
};
