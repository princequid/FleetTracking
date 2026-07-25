import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {/* Map and camera screens slide up from bottom like modals */}
      <Stack.Screen
        name="trip/[id]/map"
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
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
  );
}
