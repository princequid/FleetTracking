import { Stack } from 'expo-router';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useDriverLocationTracker } from '../../hooks/useDriverLocationTracker';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAlertsPoller } from '../../hooks/useAlertsPoller';

export default function DriverLayout() {
  // Single shared GPS watch for the whole driver session — keeps location updating as
  // the driver moves between screens (Map, Earnings, …), not just while the map is open.
  useDriverLocationTracker();
  // Register this device for push + handle notification taps (deep linking).
  usePushNotifications();
  // Keep the active-trip count fresh so the Alerts tab can show a new-alert dot.
  useAlertsPoller();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen
          name="trip/[id]/map"
          options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="delivery/pre-dispatch/[id]_3"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen
          name="delivery/pod/[id]_3"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
      </Stack>
      <FloatingTabBar />
    </View>
  );
}
