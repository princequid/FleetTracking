import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';

/**
 * The four primary tabs — Home, Trips, Alerts, Profile.
 *
 * ## Why this navigator exists
 *
 * These four screens used to be plain `<Stack>` entries in `(driver)/_layout`,
 * navigated with `router.navigate()` from the floating tab bar. That is what
 * made every screen reload when you came back to it, and the reason is in
 * React Navigation v7's `StackRouter`:
 *
 *     case 'NAVIGATE':
 *       if (action.payload.name === currentRoute.name) route = currentRoute;
 *       else if (action.payload.pop) route = state.routes.findLast(...);
 *       ...
 *       if (!route) routes = [...state.routes, { key: `${name}-${nanoid()}`, ... }]
 *
 * A stack only reuses an existing screen when the target *is* the current route,
 * or when the action carries `pop: true`. `expo-router`'s `router.navigate()`
 * does not set `pop`. So every tab switch fell through to the last branch and
 * pushed a **brand-new route with a fresh key** — a full remount, fresh effects,
 * fresh network calls, and every piece of local state (scroll offset, filter
 * tab, form input) thrown away. The stack also grew without bound: Home → Trips
 * → Home left two live Home screens behind it.
 *
 * A `Tabs` navigator jumps to an existing screen instead of pushing, so each tab
 * mounts once and is simply hidden when you leave it.
 *
 * ## Keeping the slide
 *
 * The old Stack slid horizontally, with the direction picked by
 * `tabTransitionStore` from the relative order of the two tabs. Bottom tabs give
 * that for free: `BottomTabView` drives each scene's progress with
 *
 *     const toValue = index === state.index ? 0 : index >= state.index ? 1 : -1;
 *
 * so a tab to the *right* of the focused one parks at +1 and one to the *left*
 * at -1. Interpolating `translateX` across `[-1, 0, 1]` by a full screen width
 * therefore reproduces the original behaviour exactly — moving rightward along
 * the bar slides in from the right, moving leftward slides in from the left —
 * and it reads the real tab order rather than a flag set on a 600ms timer.
 *
 * The built-in `animation: 'shift'` was not used because it only nudges 50px and
 * cross-fades, which is a noticeably different motion from the old full slide.
 *
 * ## Why the tab bar is rendered elsewhere
 *
 * `tabBar` returns null on purpose. The app's `FloatingTabBar` is an
 * absolutely-positioned overlay mounted once in `(driver)/_layout`, so it stays
 * visible over pushed screens like a trip's detail page — the existing
 * behaviour. Rendering it here as well would give you two bars.
 */
export default function TabsLayout() {
  const { width } = useWindowDimensions();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      // Mounted-but-hidden tabs stop committing renders until focused again, so
      // a poll landing on Alerts costs nothing on Home. They stay in memory —
      // that is the whole point — they just go quiet.
      freezeOnBlur: true,
      lazy: true,
      // Full-width horizontal slide. Read from `useWindowDimensions` rather than
      // a module-level `Dimensions.get` so the distance stays correct after a
      // rotation or a foldable unfolding.
      sceneStyleInterpolator: ({ current }) => ({
        sceneStyle: {
          transform: [
            {
              translateX: current.progress.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [-width, 0, width],
              }),
            },
          ],
        },
      }),
      transitionSpec: {
        animation: 'timing',
        config: { duration: 260, useNativeDriver: true },
      },
    }),
    [width],
  );

  return (
    <Tabs tabBar={() => null} backBehavior="history" screenOptions={screenOptions}>
      <Tabs.Screen name="dashboard_2" />
      <Tabs.Screen name="trip/history_2" />
      <Tabs.Screen name="notifications_5" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
