import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  isLoggedIn: false,
  userId: null,
  role: null,

  setLoggedIn: (userId, role) => set({ isLoggedIn: true, userId, role }),

  clearAuth: () => set({ isLoggedIn: false, userId: null, role: null }),
}));

export default useAuthStore;
