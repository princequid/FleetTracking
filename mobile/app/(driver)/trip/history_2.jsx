import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../services/api_1';
import { C } from '../../../constants/colors';

// Only finished trips belong in history
const HISTORY_STATUSES = ['DELIVERED', 'CANCELLED'];

const STATUS_META = {
  DELIVERED: { label: 'Completed', color: C.green, bg: '#ECFDF5', icon: 'check-circle' },
  CANCELLED: { label: 'Cancelled', color: C.red,   bg: '#FEF2F2', icon: 'x-circle' },
};

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'DELIVERED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

// Trim long location names to the first 3 words so rows stay tidy
function shortLocation(name) {
  if (!name) return '—';
  const words = name.trim().split(/\s+/);
  return words.length <= 3 ? name : words.slice(0, 3).join(' ') + '…';
}

function tripDate(trip) {
  const d = trip.completedAt || trip.cancelledAt || trip.arrivedAt || trip.createdAt;
  if (!d) return '';
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
       + ' · ' + new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const HistoryRow = React.memo(function HistoryRow({ trip, onPress }) {
  const meta = STATUS_META[trip.status] || STATUS_META.DELIVERED;
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(trip)} activeOpacity={0.85}>
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Feather name={meta.icon} size={18} color={meta.color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.routeRow}>
          <Text style={styles.routeText} numberOfLines={1}>{shortLocation(trip.origin)}</Text>
          <Feather name="arrow-right" size={12} color={C.text3} />
          <Text style={styles.routeText} numberOfLines={1}>{shortLocation(trip.destination)}</Text>
        </View>
        <Text style={styles.metaText}>Trip #{trip.id} · {tripDate(trip)}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function TripHistoryScreen() {
  const router = useRouter();
  const [trips, setTrips]       = useState([]);
  const [tab, setTab]           = useState('all');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRef]    = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/trips');
      const raw = res.data;
      const all = Array.isArray(raw) ? raw
        : Array.isArray(raw?.content) ? raw.content
        : Array.isArray(raw?.data) ? raw.data
        : [];
      // Keep only finished trips, newest first
      const finished = all
        .filter((t) => HISTORY_STATUSES.includes(t.status))
        .sort((a, b) => new Date(b.completedAt || b.cancelledAt || b.createdAt || 0)
                      - new Date(a.completedAt || a.cancelledAt || a.createdAt || 0));
      setTrips(finished);
    } catch {
      setError('Could not load trip history. Pull to retry.');
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

  const openTrip = useCallback((trip) => router.push(`/(driver)/trip/${trip.id}_2`), [router]);
  const renderItem = useCallback(({ item }) => <HistoryRow trip={item} onPress={openTrip} />, [openTrip]);

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Feather name={error ? 'wifi-off' : 'clock'} size={44} color={C.border} />
      <Text style={styles.emptyTitle}>
        {error ? 'Couldn’t load history' : 'No trips yet'}
      </Text>
      <Text style={styles.emptySub}>
        {error ? error : 'Completed and cancelled trips will appear here'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Trip History</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const count = t.key === 'all' ? trips.length : t.key === 'DELIVERED' ? completedCount : cancelledCount;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={styles.emptySub}>Loading your trips…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1, paddingBottom: 110 }}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },

  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 12, gap: 2 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.navyPrimary },
  tabText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.text3 },
  tabTextActive: { color: C.navyPrimary, fontFamily: 'Inter-SemiBold' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1, flexShrink: 1 },
  metaText: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: C.text1 },
  emptySub: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
});
