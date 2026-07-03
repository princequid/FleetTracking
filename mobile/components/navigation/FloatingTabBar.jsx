import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence,
} from 'react-native-reanimated';

const TABS = [
  { key: 'home',    icon: 'home', label: 'Home',    route: '/(driver)/dashboard_2' },
  { key: 'trips',   icon: 'list', label: 'Trips',   route: '/(driver)/trip/history_2' },
  { key: 'alerts',  icon: 'bell', label: 'Alerts',  route: '/(driver)/notifications_5' },
  { key: 'profile', icon: 'user', label: 'Profile', route: '/(driver)/profile' },
];

const HIDE_ON = ['/map', 'pre-dispatch', '/pod'];

function getActiveKey(pathname) {
  if (pathname.includes('dashboard'))      return 'home';
  if (pathname.includes('history'))        return 'trips';
  if (pathname.includes('notification'))   return 'alerts';
  if (pathname.includes('profile'))        return 'profile';
  return 'home';
}

function TabButton({ tab, isActive, onPress }) {
  const bgOpacity   = useSharedValue(isActive ? 1 : 0);
  const itemOpacity = useSharedValue(isActive ? 1 : 0.4);
  const iconScale   = useSharedValue(1);

  useEffect(() => {
    bgOpacity.value   = withTiming(isActive ? 1 : 0,   { duration: 200 });
    itemOpacity.value = withTiming(isActive ? 1 : 0.4, { duration: 150 });
  }, [isActive]);

  const bgStyle   = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const itemStyle = useAnimatedStyle(() => ({
    opacity:   itemOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const handlePress = () => {
    iconScale.value = withSequence(
      withSpring(1.15, { damping: 10, stiffness: 300 }),
      withSpring(1,    { damping: 12, stiffness: 200 })
    );
    Haptics.selectionAsync();
    onPress(tab);
  };

  return (
    <Pressable style={ss.tabBtn} onPress={handlePress}>
      <Animated.View style={[ss.tabActiveBg, bgStyle]} />
      <Animated.View style={[ss.tabContent, itemStyle]}>
        <Feather
          name={tab.icon}
          size={22}
          color={isActive ? '#14B8A6' : 'rgba(255,255,255,0.40)'}
        />
        <Text style={[ss.tabLabel, isActive && ss.tabLabelActive]}>
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function FloatingTabBar() {
  const router   = useRouter();
  const pathname = usePathname();

  const shouldHide = HIDE_ON.some((r) => pathname.includes(r));
  if (shouldHide) return null;

  const activeKey = getActiveKey(pathname);

  return (
    <View style={ss.outer} pointerEvents="box-none">
      <View style={ss.bar}>
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={tab.key === activeKey}
            onPress={(t) => router.push(t.route)}
          />
        ))}
      </View>
    </View>
  );
}

export default FloatingTabBar;

const ss = StyleSheet.create({
  outer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  bar: {
    height: 64,
    borderRadius: 24,
    backgroundColor: '#0F2347',
    shadowColor: '#000',
    shadowOpacity: 0.20,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActiveBg: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(13,148,136,0.20)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.30)',
  },
  tabContent: {
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
  },
  tabLabelActive: {
    fontFamily: 'Inter-SemiBold',
    color: '#14B8A6',
  },
});
