import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence,
} from 'react-native-reanimated';
import { useAlertsStore } from '../../store/alertsStore';
import { useTabTransitionStore } from '../../store/tabTransitionStore';

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
  // Profile and its sub-pages (reached only from the Profile screen's menu) should all
  // keep the Profile tab highlighted, not silently fall through to Home.
  if (pathname.includes('profile'))        return 'profile';
  if (pathname.includes('privacy-policy')) return 'profile';
  if (pathname.includes('help-support'))   return 'profile';
  return 'home';
}

function TabButton({ tab, isActive, showDot, onPress }) {
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
    <Pressable
      style={ss.tabBtn}
      onPress={handlePress}
      // The whole primary navigation announced as four unlabelled buttons.
      // `tab` + selected state is what tells a screen-reader user where they
      // are; the dot is folded into the name because a red dot they can't see
      // is otherwise the only signal that an alert is waiting.
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={showDot ? `${tab.label}, new alerts` : tab.label}
    >
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
      {/* New-alert dot — full opacity (outside the dimmed content) */}
      {showDot && (
        <View style={ss.dotWrap} pointerEvents="none">
          <View style={ss.dot} />
        </View>
      )}
    </Pressable>
  );
}

export function FloatingTabBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const setTabDirection = useTabTransitionStore((s) => s.setDirection);

  const activeIds = useAlertsStore((s) => s.activeIds);
  const seenIds   = useAlertsStore((s) => s.seenIds);
  const hasUnseenAlert = activeIds.some((id) => !seenIds.includes(id));

  const shouldHide = HIDE_ON.some((r) => pathname.includes(r));
  if (shouldHide) return null;

  const activeKey = getActiveKey(pathname);

  // Ignore taps on the tab we're already on (no navigation, no re-mount, no state reset).
  // Otherwise use navigate() (not push) so the stack doesn't accumulate duplicate pages
  // and an existing screen instance is reused when possible.
  const handleTabPress = (tab) => {
    if (tab.key === activeKey) {
      if (__DEV__) console.log(`[Nav] ignored — already on "${tab.key}"`);
      return;
    }
    if (__DEV__) console.log(`[Nav] navigate → "${tab.key}"`);

    // Direction is driven by tab ORDER, not stack history: moving to a tab further
    // right in the bar feels forward (slide from right); moving to one further left
    // feels like going back (slide from left) — matching what the tab bar visually
    // implies, regardless of which screen was pushed when.
    const fromIndex = TABS.findIndex((t) => t.key === activeKey);
    const toIndex   = TABS.findIndex((t) => t.key === tab.key);
    setTabDirection(toIndex < fromIndex ? 'back' : 'forward');

    router.navigate(tab.route);

    // Revert to the default shortly after the transition starts, so any LATER,
    // unrelated push (e.g. tapping into a trip's details) isn't accidentally
    // affected by whichever direction the last tab switch happened to use.
    setTimeout(() => setTabDirection('forward'), 600);
  };

  return (
    <View style={ss.outer} pointerEvents="box-none">
      <View style={ss.bar}>
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={tab.key === activeKey}
            showDot={tab.key === 'alerts' && hasUnseenAlert}
            onPress={handleTabPress}
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
  dotWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#0F2347', // matches the bar so it reads as a clean dot on the icon
    transform: [{ translateX: 10 }], // nudge to the icon's top-right
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
