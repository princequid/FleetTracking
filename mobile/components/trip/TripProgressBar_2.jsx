import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, useReducedMotion, Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type, motion } from '../../constants/tokens';

/**
 * How far along a trip is.
 *
 * Fills a `// TODO` stub. `dashboard_2.jsx` animates a bare fill bar and
 * `trip/[id]/index.jsx` computes its own step index from the same statuses —
 * two representations of one idea, neither reusable.
 *
 *     <TripProgressBar status={trip.status} />
 *     <TripProgressBar status={trip.status} showSteps />
 *
 * ── Status drives it, not a percentage ───────────────────────────────────────
 * Progress comes from the trip's status, because that's the only thing the API
 * actually reports. Passing a made-up percentage would be inventing precision
 * the backend never gave us.
 *
 * ── Cancelled ────────────────────────────────────────────────────────────────
 * A cancelled trip shows a full red bar rather than freezing part-way. A stalled
 * amber bar reads as "still in progress", which is the opposite of true.
 */

/** The happy path, in order. Index = how many segments are complete. */
export const TRIP_STEPS = ['Assigned', 'On the way', 'Arrived', 'Delivered'];

const STEP_INDEX = {
  PENDING: 0,
  ASSIGNED: 0,
  STARTED: 1,
  EN_ROUTE: 1,
  REROUTED: 1,
  ARRIVED: 2,
  DELIVERED: 3,
};

export function progressForStatus(status) {
  if (status === 'CANCELLED') return 1;
  const i = STEP_INDEX[status];
  if (i == null) return 0;
  return i / (TRIP_STEPS.length - 1);
}

export default function TripProgressBar({
  status,
  /** Renders the step labels beneath the bar. */
  showSteps = false,
  height = 6,
  style,
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();

  const target = progressForStatus(status);
  const cancelled = status === 'CANCELLED';
  const done = status === 'DELIVERED';

  const fill = useSharedValue(target);

  useEffect(() => {
    fill.value = reduceMotion
      ? target
      : withTiming(target, { duration: motion.slow, easing: Easing.out(Easing.cubic) });
  }, [target, reduceMotion, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, fill.value)) * 100}%`,
  }));

  const tint = cancelled ? C.red : done ? C.green : C.amber;
  const activeIndex = cancelled ? -1 : (STEP_INDEX[status] ?? 0);

  return (
    <View
      style={style}
      accessible
      // `progressbar` with a text value: percentages mean nothing to a driver,
      // "Arrived, step 3 of 4" does.
      accessibilityRole="progressbar"
      accessibilityLabel={
        cancelled
          ? 'Trip cancelled'
          : `Trip progress: ${TRIP_STEPS[activeIndex] ?? 'Assigned'}, step ${activeIndex + 1} of ${TRIP_STEPS.length}`
      }
    >
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: tint, borderRadius: height / 2 }, fillStyle]}
        />
      </View>

      {showSteps && (
        <View style={styles.steps}>
          {TRIP_STEPS.map((label, i) => (
            <Text
              key={label}
              style={[
                styles.step,
                i <= activeIndex && { color: C.text1, fontFamily: type.bodyStrong.fontFamily },
                cancelled && { color: C.text3 },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    track: { width: '100%', backgroundColor: C.border, overflow: 'hidden' },
    fill: { height: '100%' },
    steps: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: space[2],
      gap: space[2],
    },
    step: { ...type.caption, letterSpacing: 0, color: C.text3, flexShrink: 1 },
  });
