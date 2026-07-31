import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius } from '../../constants/tokens';

/**
 * Skeleton placeholders.
 *
 * The app has 11 `ActivityIndicator`s and exactly one skeleton, so most loading
 * states are a spinner on an empty screen — which tells the driver nothing about
 * what's coming and makes the layout jump when data lands. A skeleton reserves
 * the real shape.
 *
 *     <Skeleton width={120} height={14} />
 *     <Skeleton.Text lines={3} />
 *     <Skeleton.Card />
 *
 * ── The pulse ────────────────────────────────────────────────────────────────
 * Opacity pulse, not a translating shimmer gradient. A shimmer needs either a
 * masked LinearGradient per placeholder or an overlay animation, and on a list
 * of 8 rows that's 8 concurrent gradient animations for decoration. Opacity is
 * one interpolation on the UI thread and reads just as clearly.
 *
 * Under `prefers reduced motion` it renders static at the midpoint — still
 * obviously a placeholder, just not moving.
 */
function Skeleton({ width = '100%', height = 14, style, radius: r = radius.sm }) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 0.5 : 0.35);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius: r }, animatedStyle, style]}
      // A placeholder has no content worth announcing. The screen that owns it
      // should expose the loading state once, not once per bar.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Paragraph placeholder. The last line is short, the way real text wraps. */
Skeleton.Text = function SkeletonText({ lines = 3, gap = space[2], lastLineWidth = '60%' }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? lastLineWidth : '100%'} height={12} />
      ))}
    </View>
  );
};

/** Matches the geometry of a `Card` with a title, two body lines and a meta row. */
Skeleton.Card = function SkeletonCard({ style }) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[styles.card, C.elevation?.sm, style]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} radius={radius.md} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="35%" height={11} />
        </View>
      </View>
      <Skeleton.Text lines={2} />
    </View>
  );
};

/** A list of `count` card skeletons — the usual "loading a screen" case. */
Skeleton.List = function SkeletonList({ count = 4, gap = space[3] }) {
  return (
    <View style={{ gap }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton.Card key={i} />
      ))}
    </View>
  );
};

const makeStyles = (C) =>
  StyleSheet.create({
    // Sits between the surface and the border colour so it reads as "content
    // shaped" rather than as an empty hole, in both themes.
    base: { backgroundColor: C.border },
    card: {
      backgroundColor: C.surface,
      borderRadius: radius.lg,
      padding: space[4],
      gap: space[3],
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
    cardHeaderText: { flex: 1, gap: space[2] },
  });

export default Skeleton;
