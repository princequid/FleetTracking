import { Stack } from 'expo-router';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useDriverLocationTracker } from '../../hooks/useDriverLocationTracker';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAlertsPoller } from '../../hooks/useAlertsPoller';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';
import { useTabTransitionStore } from '../../store/tabTransitionStore';

export default function DriverLayout() {
  // Direction of the next screen transition — flipped by the tab bar right before it
  // navigates, based on relative tab order (see tabTransitionStore for the full story).
  const tabDirection = useTabTransitionStore((s) => s.direction);

  // Sign the driver out after a prolonged background period (lost/left-device protection).
  useInactivityLogout();
  // Single shared GPS watch for the whole driver session — keeps location updating as
  // the driver moves between screens (Map, Earnings, …), not just while the map is open.
  useDriverLocationTracker();
  // Register this device for push + handle notification taps (deep linking).
  usePushNotifications();
  // Keep the active-trip count fresh so the Alerts tab can show a new-alert dot.
  useAlertsPoller();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: tabDirection === 'back' ? 'slide_from_left' : 'slide_from_right' }}>
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
