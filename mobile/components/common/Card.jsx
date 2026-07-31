import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import PressableScale from './PressableScale';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius } from '../../constants/tokens';

/**
 * The standard surface. One radius, one padding, one elevation scale.
 *
 * Replaces ad-hoc card styling across the app, where the audit measured 27
 * distinct border radii and 98 shadow/elevation declarations with no shared
 * scale.
 *
 *     <Card>…</Card>
 *     <Card elevation="lg" padding={0}>…</Card>
 *     <Card onPress={open} label="Trip 4821, en route">…</Card>
 *
 * ── Interactive vs. static ───────────────────────────────────────────────────
 * Passing `onPress` is what makes a card a button: it gains press feedback, a
 * haptic, and a `button` role. Without it the card renders as a plain `View`
 * with no role at all. That split is deliberate — a static card that scales
 * under the finger promises an interaction that doesn't exist, and a
 * screen-reader user shouldn't be told a read-only panel is tappable.
 */
export default function Card({
  children,
  onPress,
  /** 'none' | 'sm' | 'md' | 'lg' | 'xl' — see constants/theme.js */
  elevation = 'sm',
  padding = space[4],
  style,
  label,
  hint,
  ...rest
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const composed = [styles.card, { padding }, C.elevation?.[elevation], style];

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        style={composed}
        label={label}
        hint={hint}
        // Cards are large, so they need less scale than a button to read as
        // pressed — 0.97 on a full-width card looks like a glitch.
        activeScale={0.985}
        {...rest}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View style={composed} {...rest}>
      {children}
    </View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: radius.lg,
      // Dark mode's elevation levels supply their own border; in light mode the
      // shadow does the work and this stays invisible.
      overflow: 'hidden',
    },
  });
