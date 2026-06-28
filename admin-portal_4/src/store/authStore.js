import { useSyncExternalStore } from "react";

const STORAGE_KEY = "fleettrack_admin_auth";

const state = {
  email: "",
  role: "",
  token: "",
  authenticated: false,
};

function loadState() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.email = parsed.email || "";
    state.role = parsed.role || "";
    state.token = parsed.token || "";
    state.authenticated = Boolean(parsed.authenticated);
  } catch {
    // ignore load errors
  }
}

function saveState() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      email: state.email,
      role: state.role,
      token: state.token,
      authenticated: state.authenticated,
    })
  );
}

loadState();

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
    return state;
  },
  setAuth(auth) {
    state.email = auth.email || "";
    state.role = auth.role || "";
    state.token = auth.token || "";
    state.authenticated = Boolean(auth.authenticated);
    saveState();
    notify();
  },
  clearAuth() {
    state.email = "";
    state.role = "";
    state.token = "";
    state.authenticated = false;
    saveState();
    notify();
  },
};

export function useAuthStore() {
  return useSyncExternalStore(authStore.subscribe, authStore.getAuth);
}

export { authStore };

