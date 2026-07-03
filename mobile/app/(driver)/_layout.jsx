import { Stack } from 'expo-router';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';

export default function DriverLayout() {
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
