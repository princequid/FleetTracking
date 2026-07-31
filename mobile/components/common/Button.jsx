import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import PressableScale from './PressableScale';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type, touch } from '../../constants/tokens';

/**
 * The app's button.
 *
 * Replaces a `// TODO` stub that had been sitting here while every screen
 * hand-rolled its own — `login-button`, `dispatch-submit-btn`, `trips-empty-cta`
 * and a dozen others, each with its own padding, radius and press behaviour.
 *
 *     <Button title="Start trip" onPress={go} />
 *     <Button title="Cancel" variant="secondary" onPress={back} />
 *     <Button title="Report issue" variant="danger" icon="alert-triangle" />
 *     <Button title="Submitting…" loading />
 *
 * ── Loading ──────────────────────────────────────────────────────────────────
 * `loading` swaps the label for a spinner AND blocks press. Double-submission is
 * a real bug class in this app — several screens fire a POST on every tap with
 * no guard — so the guard lives in the component rather than in each caller.
 *
 * ── Haptics ──────────────────────────────────────────────────────────────────
 * `primary` and `danger` default to the medium `action` intent because they
 * carry consequence; the quieter variants use a light `buttonPress`. Override
 * with `haptic`, or pass `haptic={false}` inside an already-confirmed flow so
 * the driver doesn't get two buzzes for one decision.
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  label,
  hint,
  haptic,
  ...rest
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const variants = useMemo(() => VARIANTS(C), [C]);

  const v = variants[variant] ?? variants.primary;
  const s = SIZES[size] ?? SIZES.md;
  const isInert = disabled || loading;

  const defaultHaptic = variant === 'primary' || variant === 'danger' ? 'action' : 'buttonPress';

  return (
    <PressableScale
      onPress={onPress}
      disabled={isInert}
      haptic={haptic === undefined ? defaultHaptic : haptic}
      // The label is the button's text; only fall back to `label` when there
      // isn't any (icon-only usage).
      label={label ?? title}
      hint={hint}
      // Announces as busy while a request is in flight, so a screen-reader user
      // isn't left tapping a control that silently ignores them.
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: s.padY,
          paddingHorizontal: s.padX,
          minHeight: s.minHeight,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <Animated.View entering={FadeIn.duration(120)} style={styles.row}>
          <ActivityIndicator size="small" color={v.fg} />
          {!!title && <Text style={[styles.label, { color: v.fg, fontSize: s.font }]}>{title}</Text>}
        </Animated.View>
      ) : (
        <View style={styles.row}>
          {!!icon && iconPosition === 'left' && <Feather name={icon} size={s.icon} color={v.fg} />}
          {!!title && (
            <Text style={[styles.label, { color: v.fg, fontSize: s.font }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {!!icon && iconPosition === 'right' && <Feather name={icon} size={s.icon} color={v.fg} />}
        </View>
      )}
    </PressableScale>
  );
}

/**
 * Sizes share geometry so variants stay interchangeable. `md` clears the 44pt
 * touch minimum on its own; `sm` relies on PressableScale's hitSlop.
 */
const SIZES = {
  sm: { padY: space[2], padX: space[3], font: 13, icon: 15, minHeight: 36 },
  md: { padY: space[3], padX: space[4], font: type.button.fontSize, icon: 18, minHeight: touch.min },
  lg: { padY: space[4], padX: space[5], font: 16, icon: 20, minHeight: 52 },
};

/**
 * Colours come from the theme, so every variant flips with dark mode without a
 * second definition. `secondary` and `ghost` intentionally carry no fill — a
 * screen should have exactly one filled primary action.
 */
const VARIANTS = (C) => ({
  primary:    { bg: C.navyPrimary, border: C.navyPrimary, fg: '#FFFFFF' },
  secondary:  { bg: C.surface,     border: C.border,      fg: C.text1 },
  ghost:      { bg: 'transparent', border: 'transparent', fg: C.navyPrimary },
  success:    { bg: C.green,       border: C.green,       fg: '#FFFFFF' },
  danger:     { bg: C.red,         border: C.red,         fg: '#FFFFFF' },
  // Tinted, not filled: for destructive actions that shouldn't dominate the
  // screen the way a solid red block does.
  dangerSoft: { bg: C.redLight,    border: C.redLight,    fg: C.red },
});

const makeStyles = () =>
  StyleSheet.create({
    base: {
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullWidth: { width: '100%' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
    label: { fontFamily: type.button.fontFamily, textAlign: 'center' },
  });
