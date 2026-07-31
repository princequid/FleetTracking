import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type, motion } from '../../constants/tokens';

/**
 * "You're offline, and here's what that means for your work."
 *
 * Fills a `// TODO` stub.
 *
 * ── Controlled on purpose ────────────────────────────────────────────────────
 * This takes `visible` rather than detecting connectivity itself, because the
 * app has **no connectivity library installed** — neither `expo-network` nor
 * `@react-native-community/netinfo`. It infers offline from failed requests, and
 * it already maintains offline queues for photo uploads (`mediaService_3`) and
 * GPS pings (`tripService_2`).
 *
 * So the honest signal available today is "a request just failed" or "the queue
 * is non-empty", both of which the caller knows and this component doesn't.
 * Adding live detection means adding `expo-network` — a decision, not an
 * assumption, so it isn't made here.
 *
 *     <OfflineBanner visible={!!queuedUploads} queuedCount={queuedUploads} />
 *
 * ── Why it reassures rather than warns ───────────────────────────────────────
 * A driver in a yard or on a rural route is offline constantly; that's normal,
 * not an error. The app keeps working and syncs later, so the copy says so.
 * Amber, not red — red implies something broke.
 */
export default function OfflineBanner({
  visible,
  /** Number of items waiting to sync. Shown when > 0 so the wait feels finite. */
  queuedCount = 0,
  message,
  /** 'top' sits under a header; 'bottom' floats above the tab bar. */
  position = 'bottom',
  style,
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();

  if (!visible) return null;

  const copy =
    message ??
    (queuedCount > 0
      ? `${queuedCount} ${queuedCount === 1 ? 'item' : 'items'} will sync when you're back online.`
      : "You're offline — work is saved and will sync automatically.");

  const entering = reduceMotion ? FadeIn.duration(motion.fast) : SlideInDown.duration(motion.base);
  const exiting = reduceMotion ? FadeOut.duration(motion.fast) : SlideOutDown.duration(motion.fast);

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      style={[styles.banner, position === 'top' ? styles.top : styles.bottom, style]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Offline. ${copy}`}
    >
      <Feather name="wifi-off" size={16} color={C.amber} />
      <Text style={styles.text} numberOfLines={2}>
        {copy}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingVertical: space[3],
      paddingHorizontal: space[4],
      backgroundColor: C.amberLight,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: C.amber,
    },
    top: { marginHorizontal: space[5], marginTop: space[3] },
    // Clears the floating tab bar rather than hiding behind it.
    bottom: { marginHorizontal: space[5], marginBottom: space[3] },
    text: { ...type.small, color: C.text1, flex: 1 },
  });
