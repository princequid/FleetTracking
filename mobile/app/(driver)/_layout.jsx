import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { View, AppState } from 'react-native';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useDriverLocationTracker } from '../../hooks/useDriverLocationTracker';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAlertsPoller } from '../../hooks/useAlertsPoller';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';
import mediaService from '../../services/mediaService_3';

export default function DriverLayout() {
  // Sign the driver out after a prolonged background period (lost/left-device protection).
  useInactivityLogout();
  // Single shared GPS watch for the whole driver session — keeps location updating as
  // the driver moves between screens (Map, Earnings, …), not just while the map is open.
  useDriverLocationTracker();
  // Register this device for push + handle notification taps (deep linking).
  usePushNotifications();
  // Keep the active-trip count fresh so the Alerts tab can show a new-alert dot.
  useAlertsPoller();

  // Retry any photo uploads that failed and were queued offline — once on mount, and
  // again every time the app comes back to the foreground (the driver likely regained
  // signal while backgrounded).
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    mediaService.retryFailedUploads().catch(() => {});
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        mediaService.retryFailedUploads().catch(() => {});
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Pushed screens (trip detail, incident, help…) keep the standard
          push-from-the-right motion. Tab-to-tab sliding is the tabs
          navigator's job now, and it derives direction from tab order. */}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {/* The four primary tabs live inside this one stack entry, in a Tabs
            navigator — see (tabs)/_layout for why. `(tabs)` is a group, so none
            of the app's route paths changed: /(driver)/dashboard_2 and friends
            still resolve exactly as before. */}
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen
          name="trip/[id]/map"
          options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="delivery/pre-dispatch/[id]"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen
          name="delivery/pod/[id]"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
      </Stack>
      <FloatingTabBar />
    </View>
  );
}
