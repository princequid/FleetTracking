import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, SafeAreaView, RefreshControl, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api from '../../services/api_1';
import { C } from '../../constants/colors';

const TYPE_META = {
  TRIP_ASSIGNED:  { icon: 'briefcase',    color: C.navyMid, bg: '#EEF3FB' },
  TRIP_CANCELLED: { icon: 'x-circle',     color: C.red,     bg: '#FEE2E2' },
  TRIP_STARTED:   { icon: 'play-circle',  color: C.teal,    bg: C.tealPale },
  TRIP_DELIVERED: { icon: 'check-circle', color: C.green,   bg: '#D1FAE5' },
  ALERT:          { icon: 'alert-triangle', color: C.amber, bg: '#FEF3C7' },
  INFO:           { icon: 'info',          color: C.navyMid, bg: '#EEF3FB' },
};

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

function NotifItem({ item, onPress }) {
  const meta  = TYPE_META[item.type] || TYPE_META.INFO;
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.notifUnread]}
        onPress={() => onPress(item)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, damping: 14, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 14, useNativeDriver: true }).start()}
        activeOpacity={1}
      >
        <View style={[styles.notifIcon, { backgroundColor: meta.bg }]}>
          <Feather name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.notifTitle} numberOfLines={1}>{item.title || item.type}</Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.message || item.body || '–'}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const MOCK = [
  { id: '1', type: 'TRIP_ASSIGNED',  title: 'New trip assigned',    message: 'Trip #1042 — Accra → Tema. Departs 08:00',                 isRead: false, createdAt: new Date(Date.now() - 12 * 60000).toISOString() },
  { id: '2', type: 'ALERT',          title: 'Traffic on N1 Highway', message: 'Heavy traffic reported near Tema Motorway toll booth',     isRead: false, createdAt: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: '3', type: 'TRIP_DELIVERED', title: 'Trip #1040 completed',  message: 'Proof of delivery confirmed. Great job!',                  isRead: true,  createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '4', type: 'INFO',           title: 'Schedule updated',      message: 'Your Monday schedule has been revised by fleet manager',  isRead: true,  createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: '5', type: 'TRIP_CANCELLED', title: 'Trip #1038 cancelled',  message: 'This trip was cancelled by fleet management.',            isRead: true,  createdAt: new Date(Date.now() - 24 * 3600000).toISOString() },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems]    = useState([]);
  const [tab, setTab]        = useState('all');
  const [refreshing, setRef] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      setItems(r.data?.length ? r.data : MOCK);
    } catch (_) {
      setItems(MOCK);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRef(true);
    await load();
    setRef(false);
  };

  const markAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    api.put('/notifications/read-all').catch(() => {});
  };

  const handlePress = (item) => {
    setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, isRead: true } : n));
    api.put(`/notifications/${item.id}/read`).catch(() => {});
  };

  const filtered  = tab === 'unread' ? items.filter((n) => !n.isRead) : items;
  const unreadCnt = items.filter((n) => !n.isRead).length;

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Feather name="bell-off" size={44} color={C.border} />
      <Text style={styles.emptyTitle}>{tab === 'unread' ? 'All caught up!' : 'No notifications yet'}</Text>
      <Text style={styles.emptySub}>{tab === 'unread' ? 'You have no unread notifications' : 'Notifications will appear here'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCnt > 0 && <Text style={styles.headerSub}>{unreadCnt} unread</Text>}
        </View>
        {unreadCnt > 0 && (
          <TouchableOpacity style={styles.markBtn} onPress={markAllRead}>
            <Text style={styles.markBtnText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabRow}>
        {['all', 'unread'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'all' ? `All (${items.length})` : `Unread (${unreadCnt})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
        renderItem={({ item }) => <NotifItem item={item} onPress={handlePress} />}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  headerSub: { fontFamily: 'Inter-Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  markBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  markBtnText: { fontFamily: 'Inter-Medium', fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, gap: 4 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.navyPrimary },
  tabText: { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text3 },
  tabTextActive: { color: C.navyPrimary, fontFamily: 'Inter-SemiBold' },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: C.navyPrimary },
  notifIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1 },
  notifBody:  { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3, lineHeight: 18 },
  notifTime:  { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.navyPrimary, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 60 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: 18, color: C.text1 },
  emptySub:   { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
});
