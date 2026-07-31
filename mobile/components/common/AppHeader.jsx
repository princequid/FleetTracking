import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type, touch } from '../../constants/tokens';

/**
 * The navy screen header with a back chevron and a title.
 *
 * This exact block is hand-written in **15 files**, each repeating the same
 * `paddingTop: Math.max(16, insets.top + 12)` inset maths and its own 36×36
 * back button. They had already drifted — different paddings, different chevron
 * sizes, and none of them gave the back button an accessible name, so all 15
 * announce as an unlabelled button today.
 *
 *     <AppHeader title="Trip details" />
 *     <AppHeader title="Report incident" subtitle="Trip #4821" />
 *     <AppHeader title="Profile" showBack={false} right={<Bell />} />
 *
 * The header is an always-navy surface in both themes (like the tab bar and the
 * login panel), so its foreground is white regardless of light/dark — the same
 * "text on a constant brand fill" rule the admin portal learned the hard way.
 */
export default function AppHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  /** Rendered at the trailing edge — a bell, an overflow menu, an action. */
  right,
  /** Omit the safe-area inset when the header sits inside an already-inset view. */
  useInsets = true,
  style,
}) {
  const C = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(C), [C]);

  const handleBack = () => {
    if (onBack) return onBack();
    // `canGoBack` guards the deep-link case: opening a trip straight from a push
    // notification leaves nothing to pop, and calling back() there is a no-op
    // that strands the driver on the screen.
    if (router.canGoBack()) router.back();
    else router.replace('/(driver)/dashboard_2');
  };

  return (
    <View
      style={[
        styles.header,
        { paddingTop: useInsets ? Math.max(space[4], insets.top + space[3]) : space[4] },
        style,
      ]}
    >
      {showBack ? (
        <PressableScale
          onPress={handleBack}
          style={styles.backBtn}
          label="Go back"
          haptic="selection"
          activeScale={0.92}
        >
          <Feather name="chevron-left" size={22} color="#FFFFFF" />
        </PressableScale>
      ) : (
        // Keeps the title optically centred against a trailing action even when
        // there's no back button.
        <View style={styles.backSpacer} />
      )}

      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    header: {
      backgroundColor: C.navyDark,
      paddingHorizontal: space[5],
      paddingBottom: space[4],
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
    },
    backBtn: {
      width: touch.min,
      height: touch.min,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      // Faint scrim so the chevron stays legible over the navy at any brightness.
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    // Same footprint as backBtn so the title doesn't shift between screens that
    // have a back button and screens that don't.
    backSpacer: { width: touch.min, height: touch.min },
    titleWrap: { flex: 1, justifyContent: 'center' },
    title: { ...type.h2, color: '#FFFFFF' },
    subtitle: { ...type.small, color: 'rgba(255,255,255,0.68)', marginTop: 2 },
    right: { minWidth: touch.min, alignItems: 'flex-end', justifyContent: 'center' },
  });
