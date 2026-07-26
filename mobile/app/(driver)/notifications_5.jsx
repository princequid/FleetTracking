import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api_1';
import { useAlertsStore } from '../../store/alertsStore';
import { useTheme } from '../../theme/ThemeContext';

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
  const meta  = statusMeta(C)[trip.status] || statusMeta(C).ASSIGNED;
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={1}
        onPress={() => onPress(trip)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 14, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 14, useNativeDriver: true }).start()}
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
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [trips, setTrips]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRef]  = useState(false);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/trips');
      const raw = res.data;
      const all = Array.isArray(raw) ? raw
        : Array.isArray(raw?.content) ? raw.content
        : Array.isArray(raw?.data) ? raw.data
        : [];
      const active = all
        .filter((t) => ACTIVE_STATUSES.includes(t.status))
        .sort((a, b) => new Date(tripStamp(b)) - new Date(tripStamp(a)));
      setTrips(active);
      // Keep the badge store in sync and mark everything here as seen — viewing the
      // Alerts page clears the red dot on the tab.
      const store = useAlertsStore.getState();
      store.setActiveIds(active.map((t) => t.id));
      store.markAllSeen();
    } catch {
      setError('Could not load alerts. Pull to retry.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on focus AND poll every 15s while focused, so admin actions (cancel a trip,
  // assign a new one) show up on their own within ~15s without a manual refresh.
  // The interval is cleared on blur so it never runs off-screen.
  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]));

  const onRefresh = async () => { setRef(true); await load(); setRef(false); };

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

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Feather name={error ? 'wifi-off' : 'bell-off'} size={44} color={C.border} />
      <Text style={styles.emptyTitle}>{error ? 'Couldn’t load alerts' : 'No active trips'}</Text>
      <Text style={styles.emptySub}>
        {error ? error : 'New trips assigned by dispatch will appear here'}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top + 12) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Alerts</Text>
          {trips.length > 0 && (
            <Text style={styles.headerSub}>{trips.length} active trip{trips.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={styles.emptySub}>Loading alerts…</Text>
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
  header: {
    backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: C.text1 },
  emptySub: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
});
