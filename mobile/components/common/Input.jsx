import React, { forwardRef, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming, useReducedMotion,
} from 'react-native-reanimated';
import PressableScale from './PressableScale';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type, touch, motion } from '../../constants/tokens';

/**
 * Labelled text field.
 *
 * Every `TextInput` in the app today is bare — the a11y baseline flagged **8**
 * of them with no accessible name, and eslint's autofix would have written
 * `accessibilityLabel="Text input field"` on all eight, which is worse than
 * nothing. Giving the field a real `label` fixes the announcement properly and
 * gives the driver a visible one at the same time.
 *
 *     <Input label="Email" value={email} onChangeText={setEmail}
 *            keyboardType="email-address" autoComplete="username" />
 *
 *     <Input label="Password" secureTextEntry value={pw} onChangeText={setPw}
 *            error={pwError} />
 *
 *     <Input label="Notes" multiline numberOfLines={4} />
 *
 * ── Errors ───────────────────────────────────────────────────────────────────
 * An error shows a red border, an icon AND text — never colour alone, which is
 * invisible to a driver with a colour-vision deficiency.
 *
 * RN has no `accessibilityErrorMessage` to bind the message to the field, so
 * the error row is an `accessibilityLiveRegion="polite"` instead: it gets
 * announced when it appears rather than only when the user happens to swipe
 * onto it.
 */
const Input = forwardRef(function Input(
  {
    label,
    value,
    onChangeText,
    placeholder,
    error,
    /** Muted text under the field, hidden while an error shows. */
    helper,
    /** Feather glyph at the leading edge. */
    icon,
    secureTextEntry = false,
    disabled = false,
    required = false,
    multiline = false,
    style,
    inputStyle,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();

  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const focus = useSharedValue(0);

  const handleFocus = (e) => {
    setFocused(true);
    focus.value = reduceMotion ? 1 : withTiming(1, { duration: motion.fast });
    onFocus?.(e);
  };
  const handleBlur = (e) => {
    setFocused(false);
    focus.value = reduceMotion ? 0 : withTiming(0, { duration: motion.fast });
    onBlur?.(e);
  };

  // Border colour is animated rather than swapped, so focus feels like a
  // transition instead of a flicker. Error always wins over focus.
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: error
      ? C.red
      : focus.value > 0.5
        ? C.navyMid
        : C.border,
  }));

  const isSecure = secureTextEntry && !revealed;

  return (
    <View style={[styles.wrap, style]}>
      {!!label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <Animated.View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          disabled && styles.fieldDisabled,
          borderStyle,
        ]}
      >
        {!!icon && (
          <Feather
            name={icon}
            size={18}
            color={focused ? C.navyMid : C.text3}
            // Decorative: the label already names the field.
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        )}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.text3}
          secureTextEntry={isSecure}
          editable={!disabled}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          // The visible label IS the accessible name — no generic placeholder text.
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          {...rest}
        />

        {secureTextEntry && (
          <PressableScale
            onPress={() => setRevealed((r) => !r)}
            haptic="selection"
            activeScale={0.9}
            label={revealed ? 'Hide password' : 'Show password'}
            style={styles.reveal}
          >
            <Feather name={revealed ? 'eye-off' : 'eye'} size={18} color={C.text3} />
          </PressableScale>
        )}
      </Animated.View>

      {!!error && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.fast)}
          exiting={reduceMotion ? undefined : FadeOut.duration(motion.fast)}
          style={styles.errorRow}
          accessibilityLiveRegion="polite"
        >
          <Feather name="alert-circle" size={13} color={C.red} />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}

      {!error && !!helper && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
});

const makeStyles = (C) =>
  StyleSheet.create({
    wrap: { gap: space[2] },
    label: { ...type.small, fontFamily: type.bodyStrong.fontFamily, color: C.text2 },
    required: { color: C.red },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      minHeight: touch.min,
      paddingHorizontal: space[4],
      backgroundColor: C.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
    },
    fieldMultiline: { alignItems: 'flex-start', paddingVertical: space[3], minHeight: 96 },
    fieldDisabled: { opacity: 0.55 },
    input: {
      flex: 1,
      ...type.body,
      color: C.text1,
      // Android adds its own vertical padding that misaligns against the icon.
      paddingVertical: 0,
    },
    inputMultiline: { textAlignVertical: 'top', minHeight: 72 },
    reveal: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] - 2 },
    errorText: { ...type.small, color: C.red, flex: 1 },
    helper: { ...type.small, color: C.text3 },
  });

export default Input;
