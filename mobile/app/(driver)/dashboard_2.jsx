import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Pressable, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore_1';
import { useTripStore } from '../../store/tripStore_2';
import { authService } from '../../services/authService_1';
import api from '../../services/api_1';
import { C } from '../../constants/colors';

const { width } = Dimensions.get('window');

const STATUS_COLORS = {
  ASSIGNED:  C.navyPrimary,
  STARTED:   C.amber,
  EN_ROUTE:  C.amber,
  ARRIVED:   C.green,
  DELIVERED: C.green,
  CANCELLED: C.red,
};

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || C.text3;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

function QuickActionBtn({ icon, label, bg, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.9,  damping: 10, stiffness: 300, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.05, damping: 10, stiffness: 300, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,    damping: 12, stiffness: 200, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };
  return (
    <Animated.View style={[styles.qaWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity style={styles.qaBtn} onPress={handlePress} activeOpacity={0.8}>
        <View style={[styles.qaIcon, { backgroundColor: bg }]}>
          <Feather name={icon} size={20} color={C.navyPrimary} />
        </View>
        <Text style={styles.qaLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { userId, clearAuth } = useAuthStore();
  const { activeTrip, setActiveTrip } = useTripStore();

  const [trips, setTrips]       = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [driverName, setDriverName] = useState('Driver');

  const cardTranslateY = useRef(new Animated.Value(20)).current;
  const cardOpacity    = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const [profileRes, tripsRes] = await Promise.allSettled([
        api.get(`/drivers/user/${userId}`),
        api.get('/trips'),
      ]);

      if (profileRes.status === 'fulfilled') {
        setDriverName(profileRes.value.data?.fullName || 'Driver');
      }

      if (tripsRes.status === 'fulfilled') {
        const raw = tripsRes.value.data;
        const all = Array.isArray(raw) ? raw
          : Array.isArray(raw?.content) ? raw.content
          : Array.isArray(raw?.data) ? raw.data : [];
        setTrips(all);
        const active = all.find((t) =>
          ['ASSIGNED', 'STARTED', 'EN_ROUTE', 'ARRIVED'].includes(t.status)
        );
        if (active) setActiveTrip(active);
      }
    } catch (err) {
      console.log('[Dashboard] loadData error:', err.message);
    }
  }, [userId]);

  useEffect(() => {
    loadData().then(() => {
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.spring(cardTranslateY, { toValue: 0, damping: 18, stiffness: 160, useNativeDriver: true }),
          Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    clearAuth();
    router.replace('/(auth)/login_1');
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.driverName}>{driverName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/(driver)/notifications_5')}>
                <Feather name="bell" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/(driver)/profile')}>
                <Text style={styles.avatarInitial}>{driverName ? driverName[0].toUpperCase() : 'D'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.shiftPill}>
            <View style={[styles.statusDot, { backgroundColor: C.green }]} />
            <Text style={styles.shiftText}>On shift · Started 08:00</Text>
            <TouchableOpacity style={styles.endShiftBtn}>
              <Text style={styles.endShiftText}>End shift</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={[styles.activeTripCard, { transform: [{ translateY: cardTranslateY }], opacity: cardOpacity }]}>
          {activeTrip ? (
            <TouchableOpacity activeOpacity={0.95} onPress={() => router.push(`/(driver)/trip/${activeTrip.id}_2`)}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardLabel}>ACTIVE TRIP</Text>
                <StatusBadge status={activeTrip.status} />
              </View>
              <Text style={styles.tripId}>Trip #{activeTrip.id}</Text>
              <Text style={styles.routeText}>
                {activeTrip.origin || 'Origin'}{' '}
                <Text style={{ color: C.teal, fontFamily: 'Inter-Bold' }}>→</Text>{' '}
                {activeTrip.destination || 'Destination'}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Feather name="clock" size={13} color={C.teal} />
                  <Text style={styles.metaText}>{activeTrip.eta ? new Date(activeTrip.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ETA –'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="map-pin" size={13} color={C.teal} />
                  <Text style={styles.metaText}>–– km</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="package" size={13} color={C.teal} />
                  <Text style={styles.metaText}>Cargo</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: '40%' }]} />
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.navBtn}>
                  <Feather name="navigation" size={15} color={C.navyPrimary} />
                  <Text style={styles.navBtnText}>Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.continueBtn} onPress={() => router.push(`/(driver)/trip/${activeTrip.id}_2`)}>
                  <Text style={styles.continueBtnText}>Continue trip</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.noTripBox}>
              <Feather name="inbox" size={32} color={C.border} />
              <Text style={styles.noTripTitle}>No active trip</Text>
              <Text style={styles.noTripSub}>Your next assigned trip will appear here</Text>
            </View>
          )}
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.qaRow}>
            <QuickActionBtn
              icon="camera" label="Take photo" bg={C.tealPale}
              onPress={() => activeTrip
                ? router.push(`/(driver)/delivery/pre-dispatch/${activeTrip.id}_3`)
                : router.push('/(driver)/notifications_5')}
            />
            <QuickActionBtn
              icon="alert-triangle" label="Report issue" bg={C.redLight}
              onPress={() => activeTrip
                ? router.push(`/(driver)/incident/report/${activeTrip.id}_3`)
                : null}
            />
            <QuickActionBtn
              icon="check-circle" label="Arrived" bg={C.greenLight}
              onPress={() => activeTrip
                ? router.push(`/(driver)/trip/${activeTrip.id}_2`)
                : null}
            />
            <QuickActionBtn
              icon="map-pin" label="Navigate" bg={C.amberLight}
              onPress={() => activeTrip
                ? router.push(`/(driver)/trip/${activeTrip.id}_2`)
                : null}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TODAY'S TRIPS</Text>
          <View style={styles.tripsCard}>
            {trips.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="truck" size={32} color={C.border} />
                <Text style={styles.emptyTitle}>No trips assigned</Text>
                <Text style={styles.emptySub}>Your trips will appear here once assigned</Text>
              </View>
            ) : (
              trips.slice(0, 8).map((trip, i) => (
                <Pressable
                  key={trip.id}
                  onPress={() => router.push(`/(driver)/trip/${trip.id}_2`)}
                  style={({ pressed }) => [
                    styles.tripRow,
                    i < trips.length - 1 && styles.tripRowBorder,
                    pressed && { backgroundColor: C.bg },
                  ]}
                >
                  <View style={[styles.tripRowIcon, { backgroundColor: trip.status === 'DELIVERED' ? C.greenLight : C.tealPale }]}>
                    <Feather name={trip.status === 'DELIVERED' ? 'check' : 'truck'} size={14} color={trip.status === 'DELIVERED' ? C.green : C.teal} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripRowRoute}>{trip.origin || '–'} → {trip.destination || '–'}</Text>
                    <Text style={styles.tripRowMeta}>Trip #{trip.id}</Text>
                  </View>
                  <StatusBadge status={trip.status} />
                </Pressable>
              ))
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={16} color={C.text3} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.navyDark, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 36, gap: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting:  { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  driverName:{ fontFamily: 'Inter-Bold', fontSize: 22, color: '#fff', marginTop: 2 },
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#fff' },
  shiftPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  shiftText: { fontFamily: 'Inter-Medium', fontSize: 13, color: 'rgba(255,255,255,0.8)', flex: 1 },
  endShiftBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(220,38,38,0.18)' },
  endShiftText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: '#FF8080' },
  activeTripCard: {
    marginHorizontal: 16, marginTop: -20,
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 8, marginBottom: 20,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardLabel: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3, gap: 5 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },
  tripId: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.text3, marginBottom: 4 },
  routeText: { fontFamily: 'Inter-Medium', fontSize: 15, color: C.text1, marginBottom: 14 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: 'Inter-Medium', fontSize: 12, color: C.text2 },
  progressTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.navyPrimary, borderRadius: 2 },
  cardActions: { flexDirection: 'row', gap: 10 },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: C.navyPrimary, borderRadius: 12, paddingVertical: 12,
  },
  navBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.navyPrimary },
  continueBtn: { flex: 1, backgroundColor: C.teal, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  continueBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },
  noTripBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noTripTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.text2 },
  noTripSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3, textAlign: 'center' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8, marginBottom: 12 },
  qaRow: { flexDirection: 'row', gap: 12 },
  qaWrap: { flex: 1 },
  qaBtn: { alignItems: 'center', gap: 8 },
  qaIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontFamily: 'Inter-Medium', fontSize: 11, color: C.text2, textAlign: 'center' },
  tripsCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  tripRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  tripRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  tripRowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tripRowRoute: { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text1 },
  tripRowMeta: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.text2 },
  emptySub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3, textAlign: 'center', paddingHorizontal: 20 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16 },
  logoutText: { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text3 },
});
