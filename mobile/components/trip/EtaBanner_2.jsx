import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { space, radius, type } from '../../constants/tokens';

/**
 * Arrival estimate, distance and remaining time.
 *
 * Fills a `// TODO` stub. The map screen formats these three values inline
 * (`formatDistance`, `formatEtaMins`, `formatArrivalTime` in `map.jsx`) and the
 * dashboard prints its own `formatEta`, so the same numbers appear in different
 * units and shapes depending on the screen.
 *
 *     <EtaBanner etaSeconds={1260} distanceMetres={8400} />
 *     <EtaBanner etaSeconds={null} placeholder="Calculating route…" />
 *
 * ── Missing data is a state, not a zero ──────────────────────────────────────
 * A null ETA renders the placeholder, never "0 min". The map genuinely doesn't
 * know the ETA until OSRM answers, and showing zero would be a lie the driver
 * might act on.
 *
 * ── Tabular figures ──────────────────────────────────────────────────────────
 * These values tick every few seconds. `fontVariant: ['tabular-nums']` stops the
 * digits jittering as they change width — the same rule the admin portal applies
 * to its KPI values.
 */

/** 8400 → "8.4 km"; 640 → "640 m". */
export function formatDistance(metres) {
  if (metres == null || Number.isNaN(metres)) return null;
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km`;
}

/** 1260 → "21 min"; 5400 → "1 h 30 m". */
export function formatEta(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const mins = Math.max(0, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** Clock time of arrival, e.g. "14:32". */
export function formatArrivalTime(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  try {
    const at = new Date(Date.now() + seconds * 1000);
    return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

export default function EtaBanner({
  etaSeconds,
  distanceMetres,
  placeholder = 'Calculating…',
  /** Shows the clock arrival time alongside the countdown. */
  showArrival = true,
  style,
}) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const eta = formatEta(etaSeconds);
  const distance = formatDistance(distanceMetres);
  const arrival = showArrival ? formatArrivalTime(etaSeconds) : null;

  const hasData = !!eta || !!distance;

  return (
    <View
      style={[styles.banner, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        hasData
          ? `${eta ? `${eta} remaining. ` : ''}${distance ? `${distance} to go. ` : ''}${arrival ? `Arriving around ${arrival}.` : ''}`
          : placeholder
      }
    >
      {hasData ? (
        <>
          <View style={styles.primary}>
            <Feather name="clock" size={16} color={C.teal} />
            <Text style={styles.eta}>{eta ?? '—'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.secondary}>
            {!!distance && <Text style={styles.meta}>{distance}</Text>}
            {!!arrival && <Text style={styles.meta}>ETA {arrival}</Text>}
          </View>
        </>
      ) : (
        <View style={styles.primary}>
          <Feather name="loader" size={16} color={C.text3} />
          <Text style={styles.placeholder}>{placeholder}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingVertical: space[3],
      paddingHorizontal: space[4],
      backgroundColor: C.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: C.border,
    },
    primary: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
    eta: {
      ...type.h3,
      color: C.text1,
      fontVariant: ['tabular-nums'],
    },
    divider: { width: 1, alignSelf: 'stretch', backgroundColor: C.border },
    secondary: { flex: 1, gap: 2 },
    meta: { ...type.small, color: C.text3, fontVariant: ['tabular-nums'] },
    placeholder: { ...type.body, color: C.text3 },
  });
