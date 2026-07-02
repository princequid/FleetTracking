import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
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
import { C } from '../constants/colors';

const { width: SW, height: SH } = Dimensions.get('window');
const TW = 120;
const TH = 55;
const TX = (SW - TW) / 2;   // left offset so truck is centered when translateX=0
const TY = SH * 0.33;        // truck vertical position

const AnimatedG = Animated.createAnimatedComponent(G);

// ─── Truck SVG ────────────────────────────────────────────────────────────────
function TruckSvg({ wheelAngle }) {
  const rearAP = useAnimatedProps(() => ({
    transform: `rotate(${wheelAngle.value}, 18, 44)`,
  }));
  const frontAP = useAnimatedProps(() => ({
    transform: `rotate(${wheelAngle.value}, 100, 44)`,
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
function TrackLine() {
  return (
    <View style={[styles.trackWrap, { top: TY + TH - 3 }]} pointerEvents="none">
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
  const router = useRouter();

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
        .then((token) => {
          if (token) router.replace('/(driver)/dashboard_2');
          else        router.replace('/(auth)/login_1');
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

    // Motion blur trail: show during enter (0–200ms), hide on stop (800–1100ms),
    //                     show during exit (2250–2400ms)
    trailOp.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(600, withTiming(0, { duration: 300 })),
      withDelay(1150, withTiming(1, { duration: 150 })),
    );

    // Speed lines: same cadence
    speedOp.value = withSequence(
      withTiming(0.85, { duration: 150 }),
      withDelay(650, withTiming(0, { duration: 300 })),
      withDelay(1150, withTiming(0.85, { duration: 150 })),
    );

    // Truck: spring into center, pause 1400ms, then launch right
    truckX.value = withSequence(
      withSpring(0, { damping: 12, stiffness: 70, mass: 0.8 }),
      withDelay(1400, withTiming(SW * 0.6 + TW, {
        duration: 450,
        easing: Easing.in(Easing.quad),
      })),
    );

    // Name reveal at ~900ms (when spring settles)
    nameOp.value = withDelay(900, withTiming(1, { duration: 350 }));
    nameY.value  = withDelay(900, withSpring(0, { damping: 14, stiffness: 120 }));

    // Underline expand at 1150ms
    underlineScaleX.value = withDelay(1150, withSpring(1, { damping: 10, stiffness: 100 }));

    // Tagline fade at 1400ms
    taglineOp.value = withDelay(1400, withTiming(1, { duration: 450 }));

    // Progress bar fills over the full duration
    progressW.value = withTiming(SW - 48, {
      duration: 2700,
      easing: Easing.out(Easing.cubic),
    });

    const t = setTimeout(navigate, 2750);
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

  const speedLineStyle = useAnimatedStyle(() => ({
    opacity: speedOp.value,
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
      <TrackLine />

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
      <Animated.View style={[styles.truckBase, ghost2Style]} pointerEvents="none">
        <TruckSvg wheelAngle={wheelAngle} />
      </Animated.View>
      <Animated.View style={[styles.truckBase, ghost1Style]} pointerEvents="none">
        <TruckSvg wheelAngle={wheelAngle} />
      </Animated.View>

      {/* Main truck */}
      <Animated.View style={[styles.truckBase, mainTruckStyle]} pointerEvents="none">
        <TruckSvg wheelAngle={wheelAngle} />
      </Animated.View>

      {/* Brand text */}
      <Animated.View style={[styles.textSection, nameStyle]} pointerEvents="none">
        <View style={styles.nameRow}>
          <Text style={styles.appName}>FleetTrack</Text>
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>

        <Animated.View style={[styles.underline, underlineStyle]} />

        <Animated.Text style={[styles.tagline, taglineStyle]}>
          Your deliveries. Your routes. Your proof.
        </Animated.Text>
      </Animated.View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    top: TY,
    left: TX,
    width: TW,
    height: TH,
  },
  textSection: {
    position: 'absolute',
    top: TY + TH + 36,
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
  proBadge: {
    backgroundColor: C.teal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    marginBottom: 4,
  },
  proText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#fff',
    letterSpacing: 1.5,
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
