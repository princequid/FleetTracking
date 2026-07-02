import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  isLoggedIn: false,
  userId: null,
  role: null,
  email: null,

  setLoggedIn: (userId, role, email) => set({ isLoggedIn: true, userId, role, email }),

  clearAuth: () => set({ isLoggedIn: false, userId: null, role: null, email: null }),
}));

export default useAuthStore;
