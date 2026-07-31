import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { API_BASE_URL } from "../constants/config";

const BASE_URL = API_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * Single-flight refresh.
 *
 * Refresh tokens rotate server-side, so the token is consumed by the first
 * request that redeems it. Without this guard, a page that fires several
 * requests at once (the dashboard fires four) would have all of them 401,
 * all of them POST /auth/refresh with the same token, and only the first
 * succeed — the rest failed into a hard redirect. The visible symptom was a
 * random full-page logout whenever a token expired with the dashboard open.
 *
 * Every concurrent 401 now awaits the same in-flight promise.
 */
let refreshPromise = null;

function refreshSession(refreshToken) {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, { refreshToken })
      .then(({ data }) => data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const { refreshToken, userId, email, role, setAuth, clearAuth } = useAuthStore.getState();

      if (!refreshToken) {
        clearAuth();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const data = await refreshSession(refreshToken);

        setAuth({
          userId: data.userId ?? userId,
          // Preserve the signed-in email — the refresh endpoint doesn't return it,
          // and setAuth() nulls out any field left unset.
          email: data.email ?? email,
          role: data.role ?? role,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? refreshToken,
        });

        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearAuth();
        // Flag the reason so the login screen can explain the bounce instead of
        // the session appearing to drop for no reason.
        try {
          sessionStorage.setItem("ft-session-expired", "1");
        } catch {
          // storage unavailable — the redirect still works, just without the notice
        }
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
