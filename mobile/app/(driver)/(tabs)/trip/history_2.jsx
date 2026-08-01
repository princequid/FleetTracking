import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTripsCacheStore } from '../../../../store/tripsCacheStore';
import { useTheme } from '../../../../theme/ThemeContext';
import AppHeader from '../../../../components/common/AppHeader';
import PressableScale from '../../../../components/common/PressableScale';
import TripCard from '../../../../components/trip/TripCard_2';
import EmptyState from '../../../../components/common/EmptyState';
import ErrorState from '../../../../components/common/ErrorState';
import Skeleton from '../../../../components/common/Skeleton';
import { NoTripsIllustration, NoResultsIllustration, OfflineIllustration } from '../../../../components/common/Illustrations';
import { space, radius, type } from '../../../../constants/tokens';

// Only finished trips belong in history
const HISTORY_STATUSES = ['DELIVERED', 'CANCELLED'];

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'DELIVERED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function TripHistoryScreen() {
  const router = useRouter();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  // `tab` is local, and now survives leaving the screen: the tab navigator keeps
  // this component mounted, so the driver's chosen filter (and the list's scroll
  // position) is exactly where they left it when they come back.
  const [tab, setTab]        = useState('all');
  const [refreshing, setRef] = useState(false);

  // Trips come from the shared cache rather than a per-screen fetch — same
  // endpoint and same response handling as before, just owned in one place so
  // Home, Trips and Alerts don't each request the identical payload.
  const allTrips  = useTripsCacheStore((s) => s.trips);
  const loading   = useTripsCacheStore((s) => s.loading);
  const error     = useTripsCacheStore((s) => s.error);
  const refresh   = useTripsCacheStore((s) => s.refresh);
  const ensureFresh = useTripsCacheStore((s) => s.ensureFresh);

  // Revalidates only when the cache has actually gone stale, and never blanks
  // what is already on screen. Returning to this tab is therefore instant.
  useFocusEffect(useCallback(() => { ensureFresh(); }, [ensureFresh]));

  const trips = useMemo(
    () => allTrips
      .filter((t) => HISTORY_STATUSES.includes(t.status))
      .sort((a, b) => new Date(b.completedAt || b.cancelledAt || b.createdAt || 0)
                    - new Date(a.completedAt || a.cancelledAt || a.createdAt || 0)),
    [allTrips],
  );

  const onRefresh = async () => { setRef(true); await refresh(); setRef(false); };

  const { completedCount, cancelledCount } = useMemo(() => ({
    completedCount: trips.filter((t) => t.status === 'DELIVERED').length,
    cancelledCount: trips.filter((t) => t.status === 'CANCELLED').length,
  }), [trips]);

  const filtered = useMemo(
    () => (tab === 'all' ? trips : trips.filter((t) => t.status === tab)),
    [trips, tab],
  );

  const openTrip = useCallback((trip) => router.push(`/(driver)/trip/${trip.id}`), [router]);

  const renderItem = useCallback(
    ({ item }) => <TripCard trip={item} variant="card" onPress={() => openTrip(item)} />,
    [openTrip],
  );

  /**
   * A failed request and an empty history are different situations and now
   * render differently. Previously both went through one block, so an outage
   * could read as "No trips yet" — telling the driver their history is empty
   * when we simply couldn't reach the server.
   */
  const renderEmpty = () =>
    error ? (
      <ErrorState
        variant="offline"
        illustration={<OfflineIllustration />}
        title="Couldn't load history"
        message="Check your connection and pull down to retry."
        onRetry={() => refresh()}
      />
    ) : (
      <EmptyState
        // "No trips at all" and "no trips matching this filter" are different
        // situations, so they get different drawings.
        illustration={tab === 'all' ? <NoTripsIllustration /> : <NoResultsIllustration />}
        title={tab === 'all' ? 'No trips yet' : `No ${tab === 'DELIVERED' ? 'completed' : 'cancelled'} trips`}
        message={
          tab === 'all'
            ? 'Completed and cancelled trips will appear here once you finish your first delivery.'
            : 'Try a different filter to see your other trips.'
        }
        action={tab !== 'all' ? { label: 'Show all trips', onPress: () => setTab('all') } : undefined}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader title="Trip History" />

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const count = t.key === 'all' ? trips.length : t.key === 'DELIVERED' ? completedCount : cancelledCount;
          const active = tab === t.key;
          return (
            <PressableScale
              key={t.key}
              onPress={() => setTab(t.key)}
              haptic="selection"
              activeScale={0.96}
              label={`${t.label}, ${count} trips`}
              // Announces which filter is on, rather than leaving a screen-reader
              // user to infer it from an underline they can't see.
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label} ({count})
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {loading ? (
        // A skeleton list rather than a centred spinner: it reserves the shape
        // the rows will take, so nothing jumps when the data lands.
        <View style={styles.skeletonWrap}>
          <Skeleton.List count={5} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: space[3],
    gap: 2,
  },
  tabBtn: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: C.navyPrimary },
  tabText: { ...type.small, color: C.text3 },
  tabTextActive: { color: C.navyPrimary, fontFamily: type.bodyStrong.fontFamily },

  // 110 clears the floating tab bar (see layout.tabBarClearance).
  listContent: { padding: space[4], gap: space[3], flexGrow: 1, paddingBottom: 110 },
  skeletonWrap: { padding: space[4], gap: space[3] },
});
