import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore_1';
import api from '../services/api_1';
import { registerForPushNotifications } from '../services/pushNotifications';

// ── Deep linking ──
// Maps a notification's payload to the screen that should open when it's tapped.
// The backend attaches { type, tripId, notificationId } as data on every push.
function routeForNotification(data) {
  if (!data) return null; // no notification payload → do NOT navigate (stay on home)
  const tripId = data.tripId;
  switch (data.type) {
    case 'TRIP_ASSIGNED':
      return tripId ? `/(driver)/trip/${tripId}_2` : '/(driver)/notifications_5';
    case 'TRIP_STARTED':
    case 'NAVIGATION':
      return tripId ? { pathname: '/(driver)/trip/[id]/map', params: { id: tripId } } : '/(driver)/notifications_5';
    case 'TRIP_CANCELLED':
    case 'TRIP_DELIVERED':
      return '/(driver)/trip/history_2';
    case 'EMERGENCY':
    case 'DISPATCH_MESSAGE':
    case 'ANNOUNCEMENT':
    default:
      return '/(driver)/notifications_5';
  }
}

/**
 * Wires push notifications for the signed-in driver:
 *   1. Registers this device's push token with the backend (keyed to the driver id).
 *   2. Handles taps → deep-links to the right screen for: app open, background resume,
 *      and cold start (app was fully closed).
 *
 * Mount ONCE in the driver layout. Safe in Expo Go (registration no-ops gracefully).
 */
export function usePushNotifications() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const receivedSub = useRef(null);
  const responseSub = useRef(null);
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    // Resolve the driver profile id so the token targets the same recipient used for
    // in-app notifications, then register this device.
    (async () => {
      let recipientId = null;
      try {
        const d = await api.get(`/drivers/user/${userId}`);
        recipientId = d.data?.id ?? null;
      } catch { /* ignore */ }
      if (mounted) registerForPushNotifications(recipientId);
    })();

    // Foreground receipt — the handler already shows a banner; nothing extra needed here.
    receivedSub.current = Notifications.addNotificationReceivedListener(() => {});

    // Tap while app is open or backgrounded → deep-link
    responseSub.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp?.notification?.request?.content?.data;
      const route = routeForNotification(data);
      if (route) router.push(route);
    });

    // Cold start: ONLY deep-link if the app was actually launched by tapping a
    // notification. If not (normal launch), do nothing so the app stays on home.
    (async () => {
      if (handledColdStart.current) return;
      handledColdStart.current = true;
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (!last) return; // not launched from a notification → don't redirect
        const data = last?.notification?.request?.content?.data;
        const route = routeForNotification(data);
        if (route) setTimeout(() => router.push(route), 400); // let navigation settle
      } catch { /* ignore */ }
    })();

    return () => {
      mounted = false;
      receivedSub.current?.remove?.();
      responseSub.current?.remove?.();
    };
  }, [userId]);
}

export default usePushNotifications;
