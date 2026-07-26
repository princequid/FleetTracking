import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Rect, Circle, G, Line, Defs, LinearGradient, Stop,
} from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { useAuthStore } from '../store/authStore_1';
import { useDriverStore } from '../store/driverStore_1';

const { width: SW, height: SH } = Dimensions.get('window');
const TW = 120;
const TH = 55;
const TX = (SW - TW) / 2;   // left offset so truck is centered when translateX=0

const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Truck SVG ────────────────────────────────────────────────────────────────
function TruckSvg({ wheelAngle, C }) {
  // Use react-native-svg's numeric rotation/origin props rather than a `transform`
  // string. Android's Fabric renderer expects transform as an array and crashes on a
  // string ("String cannot be cast to ReadableArray"); iOS tolerates it. This is
  // cross-platform safe.
  const rearAP = useAnimatedProps(() => ({
    rotation: wheelAngle.value,
    originX: 18,
    originY: 44,
  }));
  const frontAP = useAnimatedProps(() => ({
    rotation: wheelAngle.value,
    originX: 100,
    originY: 44,
  }));

  return (
    <Svg width={TW} height={TH} viewBox="0 0 120 55">
      {/* ── cargo box ─────── */}
      <Rect x="1"  y="9"  width="75" height="34" rx="3" fill={C.teal} />
      <Rect x="1"  y="9"  width="75" height="5"  rx="3" fill="rgba(255,255,255,0.1)" />
      <Rect x="38" y="9"  width="1"  height="34"        fill="rgba(0,0,0,0.12)" />
      <Rect x="1"  y="27" width="75" height="1"         fill="rgba(0,0,0,0.08)" />
      {/* tail light */}
      <Rect x="1"  y="15" width="3"  height="9"  rx="1" fill="#EF4444" />
      <Rect x="1"  y="15" width="2"  height="9"  rx="1" fill="#FCA5A5" />

      {/* ── cab ─────────────── */}
      <Rect x="76" y="9"  width="43" height="34" rx="3" fill="#0A6B63" />
      <Rect x="76" y="9"  width="43" height="5"  rx="3" fill="rgba(255,255,255,0.08)" />
      {/* windshield */}
      <Rect x="80" y="13" width="27" height="19" rx="2" fill="rgba(186,230,253,0.88)" />
      <Rect x="80" y="13" width="27" height="5"  rx="2" fill="rgba(0,60,120,0.2)" />
      {/* door seam */}
      <Rect x="109" y="16" width="9" height="24" rx="1" fill="rgba(0,0,0,0.1)" />
      <Rect x="110" y="25" width="5" height="2"  rx="1" fill="rgba(255,255,255,0.35)" />
      {/* headlight */}
      <Rect x="116" y="19" width="4" height="10" rx="1" fill="#FDE68A" />
      <Rect x="117" y="20" width="2" height="8"  rx="1" fill="#FEF9C3" />

      {/* ── wheel arches ───── */}
      <Rect x="8"  y="37" width="20" height="7" rx="3.5" fill={C.navyDark} />
      <Rect x="90" y="37" width="20" height="7" rx="3.5" fill={C.navyDark} />

      {/* ── rear wheel ──────── */}
      <Circle cx="18" cy="44" r="10" fill="#0F172A" />
      <Circle cx="18" cy="44" r="7"  fill="#1E293B" />
      <AnimatedG animatedProps={rearAP}>
        <Line x1="18" y1="37" x2="18" y2="44" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="12" y1="49" x2="18" y2="44" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="24" y1="49" x2="18" y2="44" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
      </AnimatedG>
      <Circle cx="18" cy="44" r="3" fill="#94A3B8" />

      {/* ── front wheel ─────── */}
      <Circle cx="100" cy="44" r="10" fill="#0F172A" />
      <Circle cx="100" cy="44" r="7"  fill="#1E293B" />
      <AnimatedG animatedProps={frontAP}>
        <Line x1="100" y1="37" x2="100" y2="44" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="94"  y1="49" x2="100" y2="44" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="106" y1="49" x2="100" y2="44" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
      </AnimatedG>
      <Circle cx="100" cy="44" r="3" fill="#94A3B8" />
    </Svg>
  );
}

// ─── Track line (gradient fade at ends) ───────────────────────────────────────
function TrackLine({ ty, C, styles }) {
  return (
    <View style={[styles.trackWrap, { top: ty + TH - 3 }]} pointerEvents="none">
      <Svg width={SW} height={4}>
        <Defs>
          <LinearGradient id="tg" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0"    stopColor={C.navyDark} stopOpacity="1" />
            <Stop offset="0.1"  stopColor={C.teal}     stopOpacity="0.5" />
            <Stop offset="0.9"  stopColor={C.teal}     stopOpacity="0.5" />
            <Stop offset="1"    stopColor={C.navyDark} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="1" width={SW} height="2" fill="url(#tg)" />
      </Svg>
    </View>
  );
}

// ─── Speed lines ──────────────────────────────────────────────────────────────
const SPEED_LINES = [
  { y: 10, w: 44, op: 0.40 },
  { y: 18, w: 66, op: 0.60 },
  { y: 26, w: 38, op: 0.30 },
  { y: 34, w: 56, op: 0.50 },
  { y: 42, w: 30, op: 0.25 },
];

// ─── Main splash ──────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  // Truck sits at ~33% of the safe-area height, shifted down by the top inset
  const TY = insets.top + (SH - insets.top - insets.bottom) * 0.30;

  const truckX         = useSharedValue(-SW * 0.65);
  const wheelAngle     = useSharedValue(0);
  const trailOp        = useSharedValue(0);
  const speedOp        = useSharedValue(0);
  const nameOp         = useSharedValue(0);
  const nameY          = useSharedValue(18);
  const underlineScaleX = useSharedValue(0);
  const taglineOp      = useSharedValue(0);
  const progressW      = useSharedValue(0);

  const navigate = () => {
    try {
      SecureStore.getItemAsync('ft_access_token')
        .then(async (token) => {
          if (token) {
            // Cold start (app was killed, not just backgrounded): authStore is
            // in-memory only, so userId is gone even though the token is still
            // valid. Restore it before landing on the dashboard so the profile
            // fetch there doesn't silently hit /drivers/user/undefined.
            const userId = await useAuthStore.getState().hydrate();
            // Fire-and-forget so it's already in flight (or resolved) by the
            // time the dashboard/profile screens mount and ask for it.
            if (userId) useDriverStore.getState().fetchProfile(userId).catch(() => {});
            router.replace('/(driver)/dashboard_2');
          } else {
            router.replace('/(auth)/login_1');
          }
        })
        .catch(() => router.replace('/(auth)/login_1'));
    } catch {
      router.replace('/(auth)/login_1');
    }
  };

  useEffect(() => {
    // Wheels spin continuously
    wheelAngle.value = withRepeat(
      withTiming(360, { duration: 500, easing: Easing.linear }), -1, false,
    );

    // Motion blur trail: enter, hide mid, re-show during the exit (~1400ms)
    trailOp.value = withSequence(
      withTiming(1, { duration: 240 }),
      withDelay(500, withTiming(0, { duration: 300 })),
      withDelay(380, withTiming(1, { duration: 180 })),
    );

    // Speed lines: same cadence
    speedOp.value = withSequence(
      withTiming(0.85, { duration: 200 }),
      withDelay(500, withTiming(0, { duration: 300 })),
      withDelay(380, withTiming(0.85, { duration: 180 })),
    );

    // Truck: glide into centre with a spring-like overshoot, pause, then launch off the
    // right. Uses a DETERMINISTIC timing (not withSpring) for the entry so the chained
    // exit fires at the same moment on iOS and Android — a spring's settle time varies by
    // platform, which previously left the truck stranded (no exit) on iOS.
    truckX.value = withSequence(
      withTiming(0, { duration: 720, easing: Easing.out(Easing.back(1.3)) }),
      withDelay(680, withTiming(SW + TW, {
        duration: 440,
        easing: Easing.in(Easing.quad),
      })),
    );

    // Name reveal when the truck settles (+20% timeline)
    nameOp.value = withDelay(660, withTiming(1, { duration: 360 }));
    nameY.value  = withDelay(660, withTiming(0, { duration: 360, easing: Easing.out(Easing.back(1.2)) }));

    // Underline + tagline
    underlineScaleX.value = withDelay(900,  withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.5)) }));
    taglineOp.value       = withDelay(1140, withTiming(1, { duration: 420 }));

    // Progress bar fills over the full display duration
    progressW.value = withTiming(SW - 48, {
      duration: 1980,
      easing: Easing.out(Easing.cubic),
    });

    // Display time increased by 20% (1700ms → 2040ms). The truck exit finishes (~1840ms)
    // before we navigate, so the launch is fully visible on both platforms.
    const t = setTimeout(navigate, 2040);
    return () => clearTimeout(t);
  }, []);

  // ── Animated styles ──────────────────────────────────────────────────────
  const mainTruckStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: truckX.value }],
  }));

  const ghost1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: truckX.value - 18 }],
    opacity: trailOp.value * 0.15,
  }));

  const ghost2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: truckX.value - 36 }],
    opacity: trailOp.value * 0.07,
  }));

  // Wind/speed lines trail the truck: translate them by the same truckX so they move
  // WITH the car instead of staying stuck in the middle.
  const speedLineStyle = useAnimatedStyle(() => ({
    opacity: speedOp.value,
    transform: [{ translateX: truckX.value }],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOp.value,
    transform: [{ translateY: nameY.value }],
  }));

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: underlineScaleX.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOp.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: progressW.value,
  }));

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Track line */}
      <TrackLine ty={TY} C={C} styles={styles} />

      {/* Speed lines — static position, opacity animated */}
      <Animated.View
        style={[styles.speedWrap, { top: TY + 4 }, speedLineStyle]}
        pointerEvents="none"
      >
        <Svg width={TX} height={TH - 8}>
          {SPEED_LINES.map(({ y, w, op }, i) => (
            <Line
              key={i}
              x1={TX - w} y1={y} x2={TX} y2={y}
              stroke={C.tealLight}
              strokeWidth={i === 1 ? 1.5 : 1}
              strokeOpacity={op}
              strokeLinecap="round"
            />
          ))}
        </Svg>
      </Animated.View>

      {/* Ghost (motion blur) copies */}
      <Animated.View style={[styles.truckBase, { top: TY }, ghost2Style]} pointerEvents="none">
        <TruckSvg wheelAngle={wheelAngle} C={C} />
      </Animated.View>
      <Animated.View style={[styles.truckBase, { top: TY }, ghost1Style]} pointerEvents="none">
        <TruckSvg wheelAngle={wheelAngle} C={C} />
      </Animated.View>

      {/* Main truck */}
      <Animated.View style={[styles.truckBase, { top: TY }, mainTruckStyle]} pointerEvents="none">
        <TruckSvg wheelAngle={wheelAngle} C={C} />
      </Animated.View>

      {/* Brand text */}
      <Animated.View style={[styles.textSection, { top: TY + TH + 36 }, nameStyle]} pointerEvents="none">
        <View style={styles.nameRow}>
          <Text style={styles.appName}>FleetSync</Text>
        </View>

        <Animated.View style={[styles.underline, underlineStyle]} />

        <Animated.Text style={[styles.tagline, taglineStyle]}>
          Your deliveries. Your routes. Your proof.
        </Animated.Text>
      </Animated.View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { bottom: Math.max(52, insets.bottom + 24) }]}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.navyDark,
  },
  trackWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  speedWrap: {
    position: 'absolute',
    left: 0,
  },
  truckBase: {
    position: 'absolute',
    left: TX,
    width: TW,
    height: TH,
  },
  textSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  appName: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 34,
    color: '#fff',
    letterSpacing: -0.8,
  },
  underline: {
    width: 200,
    height: 2,
    backgroundColor: C.teal,
    borderRadius: 1,
    alignSelf: 'center',
  },
  tagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 52,
    left: 24,
    right: 24,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: C.teal,
    borderRadius: 2,
  },
});
