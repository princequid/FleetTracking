import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Button from './Button';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type } from '../../constants/tokens';

/**
 * Something failed and the driver can do something about it.
 *
 * The app's current failure copy is five variants of "Something went wrong —
 * please try again", which tells the driver nothing and offers no way out. An
 * error state needs to say what failed, why it plausibly failed, and give a
 * retry.
 *
 *     <ErrorState
 *       title="Couldn't load your trips"
 *       message="Check your connection and try again."
 *       onRetry={reload}
 *     />
 *
 * ── Offline is not a crash ───────────────────────────────────────────────────
 * `variant="offline"` reframes the same failure as a connectivity problem
 * rather than a fault, which is the common case for a driver in a yard or on a
 * rural route. Same layout, calmer colour, honest cause.
 *
 * ── Never show this for "no results" ─────────────────────────────────────────
 * An empty list is `EmptyState`. Conflating the two is how an outage ends up
 * reading as "you have no trips today".
 */
export default function ErrorState({
  title = "Something didn't load",
  message = 'Check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  /**
   * A drawing from components/common/Illustrations, which wins over the icon
   * ring. Same seam as EmptyState so the two stay interchangeable.
   */
  illustration,
  /** 'error' | 'offline' */
  variant = 'error',
  /** Technical detail — shown small and muted, for support calls. */
  detail,
  compact = false,
  style,
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();

  const isOffline = variant === 'offline';
  const tint = isOffline ? C.amber : C.red;
  const tintSoft = isOffline ? C.amberLight : C.redLight;
  const icon = isOffline ? 'wifi-off' : 'alert-circle';

  const Wrapper = reduceMotion ? View : Animated.View;
  const entering = reduceMotion ? undefined : FadeInDown.duration(260).springify().damping(16);

  return (
    <Wrapper
      entering={entering}
      style={[styles.wrap, compact && styles.wrapCompact, style]}
      accessible
      // `alert` so assistive tech announces the failure when it appears, rather
      // than leaving the driver to discover it by exploring the screen.
      accessibilityRole="alert"
      accessibilityLabel={[title, message].filter(Boolean).join('. ')}
    >
      {illustration ?? (
        <View style={[styles.iconRing, { backgroundColor: tintSoft }]}>
          <Feather name={icon} size={compact ? 26 : 32} color={tint} />
        </View>
      )}

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
        {!!detail && (
          <Text style={styles.detail} numberOfLines={3}>
            {detail}
          </Text>
        )}
      </View>

      {!!onRetry && (
        <Button
          title={retryLabel}
          onPress={onRetry}
          icon="refresh-cw"
          variant="secondary"
          size="md"
        />
      )}
    </Wrapper>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: space[10],
      paddingHorizontal: space[6],
      gap: space[4],
    },
    wrapCompact: { paddingVertical: space[6], gap: space[3] },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { alignItems: 'center', gap: space[2] },
    title: { ...type.h3, color: C.text1, textAlign: 'center' },
    message: { ...type.body, color: C.text3, textAlign: 'center', maxWidth: 280 },
    detail: {
      ...type.caption,
      letterSpacing: 0,
      color: C.text3,
      textAlign: 'center',
      opacity: 0.8,
      marginTop: space[1],
    },
  });
