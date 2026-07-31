import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../../services/api_1';
import { useTheme } from '../../../theme/ThemeContext';
import AppHeader from '../../../components/common/AppHeader';
import PressableScale from '../../../components/common/PressableScale';
import TripCard from '../../../components/trip/TripCard_2';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import Skeleton from '../../../components/common/Skeleton';
import { NoTripsIllustration, NoResultsIllustration, OfflineIllustration } from '../../../components/common/Illustrations';
import { space, radius, type } from '../../../constants/tokens';
import { TRIP_PAGE_SIZE } from '../../../constants/config';

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

  const [trips, setTrips]     = useState([]);
  const [tab, setTab]         = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRef]  = useState(false);
  const [error, setError]     = useState('');

  // Unchanged from the original — same endpoint, same response-shape handling,
  // same filter and sort. Only the presentation below it was rebuilt.
  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/trips', { params: { size: TRIP_PAGE_SIZE } });
      const raw = res.data;
      const all = Array.isArray(raw) ? raw
        : Array.isArray(raw?.content) ? raw.content
        : Array.isArray(raw?.data) ? raw.data
        : [];
      const finished = all
        .filter((t) => HISTORY_STATUSES.includes(t.status))
        .sort((a, b) => new Date(b.completedAt || b.cancelledAt || b.createdAt || 0)
                      - new Date(a.completedAt || a.cancelledAt || a.createdAt || 0));
      setTrips(finished);
    } catch {
      setError('Could not load trip history.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRef(true); await load(); setRef(false); };

  const completedCount = trips.filter((t) => t.status === 'DELIVERED').length;
  const cancelledCount = trips.filter((t) => t.status === 'CANCELLED').length;
  const filtered = tab === 'all' ? trips : trips.filter((t) => t.status === tab);

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
        onRetry={() => { setLoading(true); load(); }}
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
