import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type } from '../../constants/tokens';

/**
 * Trip status pill.
 *
 * Fills a `// TODO` stub. The mapping below is lifted verbatim from
 * `dashboard_2.jsx`, which already had the most complete version — this moves it
 * somewhere the other screens can reach.
 *
 *     <StatusBadge status={trip.status} />
 *     <StatusBadge status="EN_ROUTE" size="sm" />
 *
 * ── A known inconsistency, deliberately resolved ─────────────────────────────
 * `dashboard_2.jsx` tints in-progress trips **amber**; `notifications_5.jsx`
 * tints the same statuses **teal**. Both can't be right. This keeps amber,
 * because amber→green reads as "in flight → done" while teal is the brand
 * accent and carries no progress meaning. When notifications adopts this
 * component its trips will shift to amber — intended, not a regression.
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 * The label is always rendered, so status never depends on colour alone. The
 * dot is decorative reinforcement, not the signal.
 */

/** Wire values → human labels. Unknown statuses fall back to title-case. */
export const STATUS_LABELS = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  STARTED: 'Started',
  EN_ROUTE: 'En route',
  REROUTED: 'Rerouted',
  ARRIVED: 'Arrived',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function statusLabel(status) {
  if (!status) return 'Unknown';
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

const PALETTE = (C) => ({
  PENDING:   { bg: C.accentSoft, fg: C.navyPrimary },
  ASSIGNED:  { bg: C.accentSoft, fg: C.navyPrimary },
  STARTED:   { bg: C.amberLight, fg: C.amber },
  EN_ROUTE:  { bg: C.amberLight, fg: C.amber },
  REROUTED:  { bg: C.amberLight, fg: C.amber },
  ARRIVED:   { bg: C.greenLight, fg: C.green },
  DELIVERED: { bg: C.greenLight, fg: C.green },
  CANCELLED: { bg: C.redLight,   fg: C.red },
});

export default function StatusBadge({ status, size = 'md', showDot = true, style }) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const palette = useMemo(() => PALETTE(C), [C]);

  const tone = palette[status] ?? { bg: C.border, fg: C.text3 };
  const label = statusLabel(status);
  const s = size === 'sm' ? SIZES.sm : SIZES.md;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: tone.bg, paddingVertical: s.padY, paddingHorizontal: s.padX },
        style,
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      {showDot && <View style={[styles.dot, { backgroundColor: tone.fg }]} />}
      <Text style={[styles.label, { color: tone.fg, fontSize: s.font }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const SIZES = {
  sm: { padY: 3, padX: space[2], font: 11 },
  md: { padY: 5, padX: space[3], font: 12 },
};

const makeStyles = () =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      borderRadius: radius.pill,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    label: { fontFamily: type.caption.fontFamily, letterSpacing: 0.2 },
  });
