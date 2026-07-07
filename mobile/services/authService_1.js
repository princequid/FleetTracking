import * as SecureStore from 'expo-secure-store';
import api from './api_1';

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

const TOKEN_KEYS = {
  ACCESS: 'ft_access_token',
  REFRESH: 'ft_refresh_token',
};

export const authService = {
  async login(emailAddr, password) {
    try {
      const response = await api.post('/auth/login', { email: emailAddr, password });
      const { accessToken, refreshToken, userId, role } = response.data;

      await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, accessToken);
      await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refreshToken);

      const payload = decodeJwtPayload(accessToken);
      const email = payload.sub || payload.email || emailAddr;

      return { userId, role, email };
    } catch (error) {
      if (__DEV__) console.error('Login failed:', error);
      throw error;
    }
  },

  async logout() {
    // Fire server-side logout best-effort — never let a network failure block sign-out
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
      if (token) await api.post('/auth/logout');
    } catch {}
    await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH);
  },

  async getAccessToken() {
    return await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
  },

  async getRefreshToken() {
    return await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
  },

  async isAuthenticated() {
    const token = await this.getAccessToken();
    return !!token;
  },
};

export default authService;
