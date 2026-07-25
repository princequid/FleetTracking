import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../store/authStore_1';
import api from '../../services/api_1';
import { C } from '../../constants/colors';

const MENU = [
  { key: 'notif',   icon: 'bell',        label: 'Notifications', sub: 'Manage alerts & push settings',    route: '/(driver)/notifications_5' },
  { key: 'history', icon: 'clock',       label: 'Trip history',  sub: 'View all completed deliveries',    route: '/(driver)/trip/history_2' },
  { key: 'support', icon: 'help-circle', label: 'Help & Support',sub: 'FAQs, contact fleet manager',      route: null },
  { key: 'privacy', icon: 'shield',      label: 'Privacy policy',sub: 'Data usage and permissions',       route: null },
];

function MenuItem({ item, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 14, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    damping: 14, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <View style={styles.menuIcon}>
          <Feather name={item.icon} size={18} color={C.navyPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Text style={styles.menuSub}>{item.sub}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={C.text3} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function initials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const { userId, email: authEmail, clearAuth } = useAuthStore((s) => ({ userId: s.userId, email: s.email, clearAuth: s.clearAuth }));

  const [driver, setDriver] = useState(null);
  const [stats,  setStats]  = useState({ trips: 0, onTime: 100 });

  const avatarScale   = useRef(new Animated.Value(0.8)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
      Animated.timing(avatarOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    if (!userId) return;
    api.get(`/drivers/user/${userId}`)
      .then((r) => {
        setDriver(r.data);
        return api.get(`/drivers/${r.data.id}/stats`);
      })
      .then((r) => setStats(r.data))
      .catch(() => {});
  }, [userId]);

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await SecureStore.deleteItemAsync('ft_access_token');
    await SecureStore.deleteItemAsync('ft_refresh_token');
    clearAuth();
    router.replace('/(auth)/login_1');
  };

  const driverName = driver?.fullName || 'Driver';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.avatar, { transform: [{ scale: avatarScale }], opacity: avatarOpacity }]}>
            <Text style={styles.avatarText}>{initials(driverName)}</Text>
          </Animated.View>
          <Text style={styles.driverName}>{driverName}</Text>
          {driver?.licenceNo && <Text style={styles.employeeId}>Licence: {driver.licenceNo}</Text>}
          <View style={styles.roleBadge}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>Driver</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          {[
            { icon: 'mail',  label: 'Email',   val: authEmail || '–' },
            { icon: 'phone', label: 'Phone',   val: driver?.phone || '–' },
            { icon: 'truck', label: 'Vehicle', val: driver?.vehicle?.plateNumber || 'Not assigned' },
          ].map((row, i) => (
            <React.Fragment key={row.label}>
              {i > 0 && <View style={styles.infoDivider} />}
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Feather name={row.icon} size={14} color={C.navyPrimary} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoVal}>{row.val}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.sectionLabel}>PERFORMANCE</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Trips done', val: String(stats.trips || driver?.tripsCompleted || '–'), icon: 'check-circle', color: C.green },
            { label: 'On time',    val: `${stats.onTime ?? 100}%`,                            icon: 'clock',        color: C.teal },
            { label: 'Rating',     val: driver?.rating ? `${driver.rating}/5` : '–',          icon: 'star',         color: C.amber },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Feather name={s.icon} size={18} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>SETTINGS</Text>
        <View style={styles.menuList}>
          {MENU.map((item) => (
            <MenuItem
              key={item.key}
              item={item}
              onPress={() => {
                Haptics.selectionAsync();
                if (item.route) router.push(item.route);
              }}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={16} color={C.red} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>FleetTrack Driver App v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  content: { padding: 20, gap: 0, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', gap: 6, paddingVertical: 20 },
  avatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: C.navyPrimary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.navyPrimary, shadowOpacity: 0.25,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6, marginBottom: 4,
  },
  avatarText: { fontFamily: 'Inter-ExtraBold', fontSize: 28, color: '#fff' },
  driverName: { fontFamily: 'Inter-Bold', fontSize: 20, color: C.text1 },
  employeeId: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2,
    backgroundColor: C.tealPale, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal },
  roleText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: C.teal },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EEF3FB', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3 },
  infoVal:   { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1 },
  infoDivider: { height: 1, backgroundColor: C.border, marginVertical: 2 },
  sectionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statVal:   { fontFamily: 'Inter-ExtraBold', fontSize: 18 },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3 },
  menuList: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF3FB', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1 },
  menuSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, height: 52, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FFF8F8',
  },
  logoutText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.red },
  version: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, textAlign: 'center', marginTop: 16 },
});
