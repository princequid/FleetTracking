import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import PressableScale from '../common/PressableScale';
import StatusBadge, { statusLabel } from './StatusBadge_2';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type } from '../../constants/tokens';

/**
 * A trip, as a row or a card.
 *
 * Fills a `// TODO` stub. `dashboard_2.jsx` has a local `TripRow` and
 * `trip/history_2.jsx` has its own near-identical version; both render the same
 * origin → destination, time and status, with different spacing.
 *
 *     <TripCard trip={trip} onPress={open} />
 *     <TripCard trip={trip} variant="card" onPress={open} />
 *
 * ── Two variants, one component ──────────────────────────────────────────────
 * `row` is the dense list form (dashboard, history). `card` is the standalone
 * form with its own surface, for when a trip is the subject rather than one of
 * many. They share the same data mapping so the two can never drift again.
 *
 * ── Route direction ──────────────────────────────────────────────────────────
 * The arrow between origin and destination is drawn as an icon rather than the
 * "→" character the current screens use: a screen reader reads that glyph as
 * "rightwards arrow" mid-sentence. Here the accessible name says "from X to Y".
 */
export default function TripCard({
  trip,
  onPress,
  /** 'row' | 'card' */
  variant = 'row',
  /** Hides the bottom hairline on the final row of a list. */
  isLast = false,
  style,
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const origin = trip?.origin || '—';
  const destination = trip?.destination || '—';

  // Prefer completion time, fall back to start. Guarded because these arrive
  // from the API as strings and a malformed one shouldn't take the row down.
  const timeStr = useMemo(() => {
    const raw = trip?.completedAt || trip?.startedAt || trip?.createdAt;
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [trip?.completedAt, trip?.startedAt, trip?.createdAt]);

  const meta = [timeStr, trip?.id != null ? `#${trip.id}` : null, trip?.distanceKm ? `${trip.distanceKm} km` : null]
    .filter(Boolean)
    .join('  ·  ');

  const isCard = variant === 'card';

  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      activeScale={isCard ? 0.985 : 0.995}
      label={`Trip ${trip?.id ?? ''}, from ${origin} to ${destination}. ${statusLabel(trip?.status)}`}
      hint={onPress ? 'Opens trip details' : undefined}
      style={[
        isCard ? styles.card : styles.row,
        isCard && C.elevation?.sm,
        !isCard && !isLast && styles.rowBorder,
        style,
      ]}
    >
      <View style={styles.routeLine}>
        <View style={styles.routeIcons}>
          <View style={[styles.dot, { backgroundColor: C.navyMid }]} />
          <View style={styles.dotConnector} />
          <Feather name="map-pin" size={12} color={C.teal} />
        </View>

        <View style={styles.routeText}>
          <Text style={styles.place} numberOfLines={1}>
            {origin}
          </Text>
          <Text style={styles.place} numberOfLines={1}>
            {destination}
          </Text>
        </View>

        {!isCard && <StatusBadge status={trip?.status} size="sm" />}
      </View>

      <View style={styles.footer}>
        {!!meta && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {isCard && <StatusBadge status={trip?.status} size="sm" />}
      </View>
    </PressableScale>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    row: {
      paddingVertical: space[3],
      paddingHorizontal: space[4],
      gap: space[2],
      backgroundColor: C.surface,
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    card: {
      padding: space[4],
      gap: space[3],
      backgroundColor: C.surface,
      borderRadius: radius.lg,
    },
    routeLine: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
    // A two-stop rail: origin dot, connector, destination pin. Communicates
    // direction without relying on an arrow character.
    routeIcons: { alignItems: 'center', width: 14, gap: 2 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotConnector: { width: 1.5, height: 10, backgroundColor: C.border },
    routeText: { flex: 1, gap: 2 },
    place: { ...type.small, fontFamily: type.bodyStrong.fontFamily, color: C.text1 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
    meta: { ...type.caption, letterSpacing: 0, color: C.text3, flex: 1 },
  });
