import { useSyncExternalStore } from "react";

const state = {
  email: "",
  role: "",
  authenticated: false,
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

const authStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getAuth() {
    return { ...state };
  },
  setAuth(auth) {
    state.email = auth.email || "";
    state.role = auth.role || "";
    state.authenticated = Boolean(auth.authenticated);
    notify();
  },
  clearAuth() {
    state.email = "";
    state.role = "";
    state.authenticated = false;
    notify();
  },
};

export function useAuthStore() {
  return useSyncExternalStore(authStore.subscribe, authStore.getAuth);
}

export { authStore };

