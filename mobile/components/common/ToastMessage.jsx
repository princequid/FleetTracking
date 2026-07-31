import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, {
  SlideInUp, SlideOutUp, FadeIn, FadeOut, useReducedMotion,
} from 'react-native-reanimated';
import PressableScale from './PressableScale';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type, motion } from '../../constants/tokens';
import { haptics } from '../../lib/haptics';

/**
 * Transient confirmation and failure messages.
 *
 * Fills a `// TODO` stub. `dashboard_2.jsx` had grown its own `showToastMsg`
 * that nothing else could use, so every other screen falls back to `Alert.alert`
 * — a blocking modal that needs a tap to dismiss, for information the driver
 * didn't ask to be interrupted by.
 *
 * Wrap the app once (Phase 3 will mount this in `app/_layout.jsx`):
 *
 *     <ToastProvider>…</ToastProvider>
 *
 * then anywhere below it:
 *
 *     const toast = useToast();
 *     toast.success('Photo uploaded');
 *     toast.error('Upload failed', 'We saved it to retry when you reconnect.');
 *
 * ── Why it's a provider, not a component ─────────────────────────────────────
 * A toast has to outlive the thing that triggered it. A screen that navigates
 * away after a successful submit would unmount its own toast mid-animation.
 * Hosting it above the navigator means the confirmation survives the transition.
 *
 * ── Restraint ────────────────────────────────────────────────────────────────
 * One toast at a time — a new one replaces the current rather than stacking, so
 * a burst of failures can't bury the screen. Toasts are for outcomes, not for
 * narrating every state change.
 */

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: 'check-circle', haptic: 'success' },
  error:   { icon: 'alert-circle', haptic: 'error' },
  warning: { icon: 'alert-triangle', haptic: 'warning' },
  info:    { icon: 'info', haptic: null },
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((variant, title, message, duration = 3200) => {
    clearTimeout(timer.current);
    // `id` forces a remount so the enter animation replays even when a second
    // toast of the same variant arrives while the first is still on screen.
    setToast({ id: Date.now(), variant, title, message });

    const h = VARIANTS[variant]?.haptic;
    if (h) haptics[h]();

    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (title, message, d) => show('success', title, message, d),
      error:   (title, message, d) => show('error', title, message, d),
      warning: (title, message, d) => show('warning', title, message, d),
      info:    (title, message, d) => show('info', title, message, d),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {!!toast && <ToastMessage key={toast.id} {...toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return ctx;
}

/**
 * The toast itself. Exported for the rare case a screen needs to place one
 * manually; prefer `useToast()`.
 */
export function ToastMessage({ variant = 'info', title, message, onDismiss }) {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();

  const tones = useMemo(() => TONES(C), [C]);
  const tone = tones[variant] ?? tones.info;
  const icon = VARIANTS[variant]?.icon ?? 'info';

  // Reduced motion still needs the toast to appear — it just shouldn't slide.
  const entering = reduceMotion ? FadeIn.duration(motion.fast) : SlideInUp.duration(motion.base).springify().damping(18);
  const exiting = reduceMotion ? FadeOut.duration(motion.fast) : SlideOutUp.duration(motion.fast);

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + space[2] }]}
    >
      <PressableScale
        onPress={onDismiss}
        haptic={false}
        activeScale={0.98}
        label={`${title}${message ? `. ${message}` : ''}`}
        hint="Dismisses this message"
        style={[styles.toast, { backgroundColor: tone.bg, borderColor: tone.border }]}
        // Announce as soon as it appears — the driver may be looking at the road,
        // not the screen.
        accessibilityLiveRegion="polite"
      >
        <Feather name={icon} size={20} color={tone.fg} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: tone.fg }]} numberOfLines={2}>
            {title}
          </Text>
          {!!message && (
            <Text style={styles.message} numberOfLines={3}>
              {message}
            </Text>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const TONES = (C) => ({
  success: { bg: C.greenLight, border: C.green, fg: C.green },
  error:   { bg: C.redLight,   border: C.red,   fg: C.red },
  warning: { bg: C.amberLight, border: C.amber, fg: C.amber },
  info:    { bg: C.accentSoft, border: C.navyMid, fg: C.navyPrimary },
});

const makeStyles = (C) =>
  StyleSheet.create({
    host: {
      position: 'absolute',
      left: space[4],
      right: space[4],
      // Above the floating tab bar (100) and any screen content.
      zIndex: 1000,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
      padding: space[4],
      borderRadius: radius.lg,
      borderWidth: 1,
      // Toasts float above everything, so they carry the heaviest elevation.
      ...(C.elevation?.xl ?? {}),
    },
    copy: { flex: 1, gap: 2 },
    title: { ...type.bodyStrong },
    message: { ...type.small, color: C.text2 },
  });

export default ToastMessage;
