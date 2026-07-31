import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { motion, touch } from '../../constants/tokens';
import { haptics } from '../../lib/haptics';

/**
 * The app's single press primitive. Everything tappable should go through this
 * or through `Button`, which wraps it.
 *
 * Why it exists: the audit found 41 `Pressable` and 42 `TouchableOpacity` — a
 * near-perfect 50/50 split. Those two give *different* feedback (a spring scale
 * vs. an opacity fade), so the app felt inconsistent by construction depending
 * on which screen you were on. A good version of this already existed, but only
 * inside `dashboard_2.jsx` where nothing else could reach it.
 *
 * What it adds over the dashboard's local copy:
 *   - haptics on press, opt-out via `haptic={false}`
 *   - `useReducedMotion` — the scale collapses to a static view for users who
 *     asked the OS to stop animating things
 *   - a real disabled state (dims, blocks press, announces as disabled)
 *   - a11y props required rather than optional (see below)
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 * `accessibilityRole` defaults to "button" and `label` maps to
 * `accessibilityLabel`. Pass a `label` for anything whose visible content is an
 * icon — the a11y lint (`npm run a11y`) will flag it if you don't, and the whole
 * point of that gate is that 75 touchables in this app currently announce as
 * nothing at all.
 */
export default function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  /** Accessible name. Required when the child is an icon with no visible text. */
  label,
  hint,
  accessibilityRole = 'button',
  accessibilityState,
  /** false to suppress, or the name of any intent on `haptics`. */
  haptic = 'buttonPress',
  /** How far the press scales down. Subtle by default; cards can go smaller. */
  activeScale = 0.97,
  /** Expands the touch target without changing layout. */
  hitSlop = touch.slop,
  ...rest
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (reduceMotion || disabled) return;
    scale.value = withSpring(activeScale, motion.spring.press);
  }, [reduceMotion, disabled, activeScale, scale]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion || disabled) return;
    scale.value = withSpring(1, motion.spring.press);
  }, [reduceMotion, disabled, scale]);

  const handlePress = useCallback(
    (event) => {
      if (disabled) return;
      // Fire before the callback: the tap should feel acknowledged immediately,
      // not after whatever async work onPress kicks off.
      if (haptic && haptics[haptic]) haptics[haptic]();
      onPress?.(event);
    },
    [disabled, haptic, onPress],
  );

  const handleLongPress = useCallback(
    (event) => {
      if (disabled || !onLongPress) return;
      haptics.longPress();
      onLongPress(event);
    },
    [disabled, onLongPress],
  );

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        hitSlop={hitSlop}
        style={[style, disabled && styles.disabled]}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled, ...accessibilityState }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Opacity rather than a grey colour, so it works on every variant and in
  // both themes without needing to know what's underneath.
  disabled: { opacity: 0.45 },
});
