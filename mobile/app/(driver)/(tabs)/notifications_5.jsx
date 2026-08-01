import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTripsCacheStore } from '../../../store/tripsCacheStore';
import { useAlertsStore } from '../../../store/alertsStore';
import { useTheme } from '../../../theme/ThemeContext';
import AppHeader from '../../../components/common/AppHeader';
import PressableScale from '../../../components/common/PressableScale';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import Skeleton from '../../../components/common/Skeleton';
import { NoAlertsIllustration, OfflineIllustration } from '../../../components/common/Illustrations';

// The Alerts page is a live view of the driver's ACTIVE trips. Assigned trips (from the
// admin) and started trips show here; once a trip is DELIVERED or CANCELLED it drops off
// this list and appears in Trip History instead.
const ACTIVE_STATUSES = ['ASSIGNED', 'STARTED', 'EN_ROUTE', 'ARRIVED'];

const statusMeta = (C) => ({
  ASSIGNED: { title: 'New trip assigned',      icon: 'briefcase',  color: C.navyMid, bg: C.accentSoft, tag: 'Assigned' },
  STARTED:  { title: 'Trip started',           icon: 'navigation', color: C.teal,    bg: C.tealPale,   tag: 'Started' },
  EN_ROUTE: { title: 'Trip in progress',       icon: 'navigation', color: C.teal,    bg: C.tealPale,   tag: 'En route' },
  ARRIVED:  { title: 'Arrived at destination', icon: 'map-pin',    color: C.green,   bg: C.greenLight, tag: 'Arrived' },
});

function shortLocation(name) {
  if (!name) return '—';
  const words = name.trim().split(/\s+/);
  return words.length <= 3 ? name : words.slice(0, 3).join(' ') + '…';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Most relevant timestamp for ordering/age of an active trip
function tripStamp(t) {
  return t.startedAt || t.createdAt || 0;
}

const AlertCard = React.memo(function AlertCard({ trip, onPress, C, styles }) {
  const meta = statusMeta(C)[trip.status] || statusMeta(C).ASSIGNED;
  return (
    // Was a hand-rolled scale on the legacy `Animated` API, which runs the
    // spring on the JS thread. PressableScale runs it on the UI thread, adds a
    // haptic, and supplies the accessible name this card never had.
    <PressableScale
      style={styles.card}
      onPress={() => onPress(trip)}
      activeScale={0.985}
      label={`${meta.title}. From ${trip.origin || 'unknown'} to ${trip.destination || 'unknown'}. ${meta.tag}`}
      hint="Opens trip details"
    >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Feather name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{meta.title}</Text>
            <View style={[styles.tag, { backgroundColor: meta.bg }]}>
              <Text style={[styles.tagText, { color: meta.color }]}>{meta.tag}</Text>
            </View>
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.routeText} numberOfLines={1}>{shortLocation(trip.origin)}</Text>
            <Feather name="arrow-right" size={11} color={C.text3} />
            <Text style={styles.routeText} numberOfLines={1}>{shortLocation(trip.destination)}</Text>
          </View>
          <Text style={styles.metaText}>Trip #{trip.id} · {timeAgo(tripStamp(trip))}</Text>
        </View>
    </PressableScale>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [refreshing, setRef] = useState(false);

  const allTrips  = useTripsCacheStore((s) => s.trips);
  const loading   = useTripsCacheStore((s) => s.loading);
  const error     = useTripsCacheStore((s) => s.error);
  const refresh   = useTripsCacheStore((s) => s.refresh);
  const ensureFresh = useTripsCacheStore((s) => s.ensureFresh);

  const trips = useMemo(
    () => allTrips
      .filter((t) => ACTIVE_STATUSES.includes(t.status))
      .sort((a, b) => new Date(tripStamp(b)) - new Date(tripStamp(a))),
    [allTrips],
  );

  // Poll every 15s while focused so admin actions (cancel a trip, assign a new
  // one) appear on their own. `ensureFresh` on entry rather than an unconditional
  // reload: if another tab fetched moments ago the cached list is already right,
  // and re-requesting it only to render the same rows is what used to make this
  // screen flash a skeleton every single time it was opened.
  useFocusEffect(useCallback(() => {
    ensureFresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [ensureFresh, refresh]));

  // Opening Alerts clears the tab's red dot. Runs off the derived list rather
  // than inside the fetch, so it still happens when the data came from cache.
  useFocusEffect(useCallback(() => {
    const store = useAlertsStore.getState();
    store.setActiveIds(trips.map((t) => t.id));
    store.markAllSeen();
  }, [trips]));

  const onRefresh = async () => { setRef(true); await refresh(); setRef(false); };

  // Assigned → trip detail (review/start); already-started → straight to the map.
  // useCallback keeps the reference stable so React.memo'd rows don't re-render.
  const openTrip = useCallback((trip) => {
    if (trip.status === 'ASSIGNED') router.push(`/(driver)/trip/${trip.id}`);
    else router.push({ pathname: '/(driver)/trip/[id]/map', params: { id: trip.id } });
  }, [router]);

  const renderItem = useCallback(
    ({ item }) => <AlertCard trip={item} onPress={openTrip} C={C} styles={styles} />,
    [openTrip, C, styles],
  );

  // A failed request and a genuinely quiet day are different things. Previously
  // both rendered through the same block; an outage could read as "No active
  // trips", which tells the driver they have nothing to do when we simply
  // couldn't reach the server.
  const renderEmpty = () =>
    error ? (
      <ErrorState
        variant="offline"
        illustration={<OfflineIllustration />}
        title="Couldn't load alerts"
        message="Check your connection and pull down to retry."
        onRetry={() => refresh()}
      />
    ) : (
      <EmptyState
        illustration={<NoAlertsIllustration />}
        title="No active trips"
        message="New trips assigned by dispatch will appear here. You'll also get a push notification."
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        title="Alerts"
        subtitle={
          trips.length > 0
            ? `${trips.length} active trip${trips.length !== 1 ? 's' : ''}`
            : undefined
        }
      />

      {loading ? (
        <View style={styles.skeletonWrap}>
          <Skeleton.List count={3} />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1, paddingBottom: 110 }}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  // header / backBtn / headerTitle / headerSub removed — AppHeader owns them.
  skeletonWrap: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1, flexShrink: 1 },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontFamily: 'Inter-SemiBold', fontSize: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.text2, flexShrink: 1 },
  metaText: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3 },

  // empty / emptyTitle / emptySub removed — EmptyState and ErrorState own these,
  // and unlike the old shared block they can't be confused for each other.
});
