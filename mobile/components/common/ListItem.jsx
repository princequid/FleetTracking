import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type, touch } from '../../constants/tokens';

/**
 * A row: leading icon, title, optional subtitle, trailing content or chevron.
 *
 * The profile, help and settings screens are each built from a dozen of these
 * written by hand, which is why their row heights and icon treatments don't
 * quite match. Menu rows, settings toggles and simple list entries all fit here.
 *
 *     <ListItem icon="user" title="Profile" onPress={go} />
 *     <ListItem icon="bell" title="Notifications" subtitle="Push and in-app"
 *               trailing={<Switch …/>} />
 *     <ListItem icon="log-out" title="Sign out" destructive onPress={out} />
 *
 * ── Chevron ──────────────────────────────────────────────────────────────────
 * Shown only when the row navigates AND has no other trailing content — a
 * chevron next to a switch implies the row goes somewhere when it doesn't.
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 * Title and subtitle are combined into one accessible name, so the row is
 * announced as a single control rather than three fragments the user has to
 * assemble. `trailing` interactive content should carry its own label.
 */
export default function ListItem({
  icon,
  title,
  subtitle,
  onPress,
  /** Rendered at the trailing edge — a Switch, a badge, a value. */
  trailing,
  /** Force the chevron on or off. Defaults to "on if pressable and no trailing". */
  showChevron,
  destructive = false,
  disabled = false,
  /** Tint for the leading icon chip. Defaults to the brand accent. */
  tint,
  style,
  hint,
  ...rest
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const fg = destructive ? C.red : C.text1;
  const chipTint = destructive ? C.redLight : (tint ?? C.accentSoft);
  const iconColor = destructive ? C.red : (tint ? C.text1 : C.navyPrimary);

  const chevron = showChevron ?? (!!onPress && !trailing);

  const body = (
    <>
      {!!icon && (
        <View style={[styles.chip, { backgroundColor: chipTint }]}>
          <Feather name={icon} size={18} color={iconColor} />
        </View>
      )}

      <View style={styles.copy}>
        <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      {trailing}

      {chevron && <Feather name="chevron-right" size={20} color={C.text3} />}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, style]} {...rest}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      label={[title, subtitle].filter(Boolean).join('. ')}
      hint={hint}
      // Rows are wide; a full 0.97 makes the whole screen look like it shifted.
      activeScale={0.99}
      style={[styles.row, style]}
      {...rest}
    >
      {body}
    </PressableScale>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      minHeight: 56, // comfortably clears the 44pt minimum with room for a subtitle
      paddingVertical: space[3],
      paddingHorizontal: space[4],
      backgroundColor: C.surface,
    },
    chip: {
      width: touch.min - 4,
      height: touch.min - 4,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, gap: 2 },
    title: { ...type.body, fontFamily: type.bodyStrong.fontFamily },
    subtitle: { ...type.small, color: C.text3 },
  });
