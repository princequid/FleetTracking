import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import Button from './Button';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type } from '../../constants/tokens';

/**
 * Confirmation before something irreversible.
 *
 * Fills a `// TODO` stub. The app currently uses `Alert.alert` for this, which
 * is the OS dialog — unthemed, unstyleable, and visually unrelated to the rest
 * of the product. It also can't show a destructive action in the app's own red.
 *
 *     <ConfirmDialog
 *       visible={confirming}
 *       title="Cancel this trip?"
 *       message="The dispatcher will be notified and the trip can't be restarted."
 *       confirmLabel="Cancel trip"
 *       destructive
 *       onConfirm={cancelTrip}
 *       onCancel={() => setConfirming(false)}
 *     />
 *
 * ── Dismissal ────────────────────────────────────────────────────────────────
 * Backdrop tap and Android hardware back both cancel — never confirm. A
 * destructive action should require deliberate contact with the confirm button,
 * and `onRequestClose` is what stops the back gesture trapping the driver.
 *
 * ── Wording ──────────────────────────────────────────────────────────────────
 * Label the confirm button with the verb ("Cancel trip", "Delete photo"), not
 * "OK". "Cancel this trip?" answered by "Cancel" is genuinely ambiguous about
 * which cancel is which.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep',
  onConfirm,
  onCancel,
  /** Red confirm button and a warning glyph. */
  destructive = false,
  /** Disables both buttons and spins the confirm — for an in-flight request. */
  loading = false,
  icon,
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const reduceMotion = useReducedMotion();

  const tint = destructive ? C.red : C.navyPrimary;
  const tintSoft = destructive ? C.redLight : C.accentSoft;
  const glyph = icon ?? (destructive ? 'alert-triangle' : 'help-circle');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none" // Reanimated drives it, so RN's own fade would double up.
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(120)}
        style={styles.backdrop}
      >
        {/* Backdrop press cancels. Not a PressableScale — a full-screen scrim
            that scales would look like the whole app moved. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          accessibilityHint="Closes this dialog without confirming"
        />

        <Animated.View
          entering={reduceMotion ? FadeIn.duration(140) : ZoomIn.duration(200).springify().damping(18)}
          style={[styles.card, C.elevation?.xl]}
          accessibilityViewIsModal
          accessible={false}
        >
          <View style={[styles.iconRing, { backgroundColor: tintSoft }]}>
            <Feather name={glyph} size={24} color={tint} />
          </View>

          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
          </View>

          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              disabled={loading}
              style={styles.action}
            />
            <Button
              title={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              style={styles.action}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(9, 16, 33, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: space[6],
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: C.surface,
      borderRadius: radius.xl,
      padding: space[6],
      alignItems: 'center',
      gap: space[4],
    },
    iconRing: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { alignItems: 'center', gap: space[2] },
    title: { ...type.h3, color: C.text1, textAlign: 'center' },
    message: { ...type.body, color: C.text3, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: space[3], width: '100%' },
    action: { flex: 1 },
  });
