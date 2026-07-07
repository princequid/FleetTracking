import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import api from './api_1';

// ── Foreground behaviour ──
// When the app is OPEN, still surface a banner + sound so the user sees the push
// (the OS shows it automatically only when the app is backgrounded/closed).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    // Back-compat with older expo-notifications
    shouldShowAlert:  true,
  }),
});

// Android must have a channel for heads-up notifications, sound and lock-screen display.
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FleetTrack Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D9488',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch { /* ignore */ }
}

/**
 * Request permission, get the device's native push token (FCM on Android / APNs on iOS)
 * and register it with the backend so notifications can be pushed to this device.
 *
 * Returns the token string, or null if unavailable/denied (handled gracefully — the app
 * keeps working, just without push).
 *
 * NOTE: requires a development/production build with Firebase configured. In Expo Go this
 * returns null (remote push isn't supported there) without crashing.
 */
export async function registerForPushNotifications(recipientId) {
  try {
    if (!Device.isDevice) return null; // no push on simulators/emulators without Play services

    await ensureAndroidChannel();

    // Permission (graceful if denied)
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    // Native device token (FCM registration token on Android; APNs token on iOS).
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp?.data;
    if (!token) return null;

    // Register with the backend (behind the authenticated gateway). recipientId is the
    // driver profile id so pushes target the same recipient as in-app notifications.
    if (recipientId != null) {
      await api.post('/notifications/devices', {
        recipientId,
        token,
        platform: Platform.OS,
      }).catch(() => { /* offline / not-yet-available — will retry on next launch */ });
    }
    return token;
  } catch {
    return null; // e.g. running in Expo Go — degrade gracefully
  }
}

// Called on logout to stop this device receiving pushes for the previous user.
export async function unregisterPushToken() {
  try {
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp?.data;
    if (token) await api.delete(`/notifications/devices/${encodeURIComponent(token)}`).catch(() => {});
  } catch { /* ignore */ }
}
