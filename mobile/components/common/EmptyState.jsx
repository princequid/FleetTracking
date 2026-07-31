import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Button from './Button';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type } from '../../constants/tokens';

/**
 * "There's nothing here yet" — the intentional, non-error absence of content.
 *
 * The app's current empty states are an icon and a line of text, repeated with
 * slightly different spacing on five screens ("No trips today", "No photos yet",
 * "No drivers registered"), and none offers a way forward. This gives them the
 * three parts an empty state needs: a visual, an explanation, and an action.
 *
 *     <EmptyState
 *       icon="inbox"
 *       title="No trips today"
 *       message="Your dispatcher will assign your next trip here."
 *       action={{ label: 'Refresh', onPress: reload }}
 *     />
 *
 * ── Illustration slot ────────────────────────────────────────────────────────
 * `illustration` takes a React node and wins over `icon`. Phase 5 replaces the
 * Feather glyphs with a set of purpose-drawn SVGs sharing one visual language;
 * this prop is the seam so that swap doesn't touch any call site.
 *
 * ── Not for failures ─────────────────────────────────────────────────────────
 * Use `ErrorState` when a request failed. Rendering "No trips today" because a
 * fetch rejected tells the driver their day is clear when it isn't — the exact
 * bug the admin portal had on its incidents page.
 */
export default function EmptyState({
  icon = 'inbox',
  illustration,
  title,
  message,
  action,
  /** Secondary, lower-emphasis action — e.g. "Contact dispatch". */
  secondaryAction,
  compact = false,
  style,
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();

  const Wrapper = reduceMotion ? View : Animated.View;
  const entering = reduceMotion ? undefined : FadeInDown.duration(260).springify().damping(16);

  return (
    <Wrapper
      entering={entering}
      style={[styles.wrap, compact && styles.wrapCompact, style]}
      // One announcement for the whole block, so a screen reader reads
      // "No trips today. Your dispatcher will assign your next trip here."
      // rather than walking an icon, a heading and a paragraph separately.
      accessible
      accessibilityRole="text"
      accessibilityLabel={[title, message].filter(Boolean).join('. ')}
    >
      {illustration ?? (
        <View style={styles.iconRing}>
          <Feather name={icon} size={compact ? 26 : 32} color={C.text3} />
        </View>
      )}

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
      </View>

      {(action || secondaryAction) && (
        <View style={styles.actions}>
          {!!action && (
            <Button
              title={action.label}
              onPress={action.onPress}
              icon={action.icon}
              size="md"
              variant="primary"
            />
          )}
          {!!secondaryAction && (
            <Button
              title={secondaryAction.label}
              onPress={secondaryAction.onPress}
              icon={secondaryAction.icon}
              size="md"
              variant="ghost"
            />
          )}
        </View>
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
    // A tinted disc rather than a bare glyph: it gives the icon a deliberate
    // footprint instead of leaving it floating in whitespace.
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: radius.pill,
      backgroundColor: C.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { alignItems: 'center', gap: space[2] },
    title: { ...type.h3, color: C.text1, textAlign: 'center' },
    message: {
      ...type.body,
      color: C.text3,
      textAlign: 'center',
      maxWidth: 280, // keeps the line length readable on large phones
    },
    actions: { flexDirection: 'row', gap: space[3], marginTop: space[1] },
  });
