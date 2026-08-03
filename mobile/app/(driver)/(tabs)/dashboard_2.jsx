import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, Linking, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withDelay, withRepeat, withSequence, Easing, runOnJS, interpolate,
} from 'react-native-reanimated';
import { useAuthStore } from '../../../store/authStore_1';
import { useTripStore } from '../../../store/tripStore_2';
import { useDriverStore } from '../../../store/driverStore_1';
import { useTripsCacheStore } from '../../../store/tripsCacheStore';
import { useTheme } from '../../../theme/ThemeContext';
import { DISPATCH_PHONE } from '../../../constants/config';
import PressableScale from '../../../components/common/PressableScale';
import EmptyState from '../../../components/common/EmptyState';
import { NoTripsIllustration } from '../../../components/common/Illustrations';

/* Trim a location name to its first 3 words (+ …) so long addresses stay
   readable on the card instead of being shrunk to a tiny font. */
function shortLocation(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length <= 3) return name;
  return words.slice(0, 3).join(' ') + '…';
}

/* ─── theme-aware status configs ─────────────────────────────────── */

const statusConfig = (C) => ({
  ASSIGNED:  { bg: C.accentSoft, text: C.navyPrimary, dot: C.navyPrimary },
  STARTED:   { bg: C.amberLight, text: C.amber,       dot: C.amber },
  EN_ROUTE:  { bg: C.amberLight, text: C.amber,       dot: C.amber },
  ARRIVED:   { bg: C.greenLight, text: C.green,       dot: C.green },
  DELIVERED: { bg: C.greenLight, text: C.green,       dot: C.green },
  CANCELLED: { bg: C.redLight,   text: C.red,         dot: C.red },
});

const rowConfig = (C) => ({
  DELIVERED: { bg: C.greenLight, icon: 'check',      color: C.green },
  STARTED:   { bg: C.accentSoft, icon: 'navigation', color: C.navyPrimary },
  EN_ROUTE:  { bg: C.accentSoft, icon: 'navigation', color: C.navyPrimary },
  ASSIGNED:  { bg: C.accentSoft, icon: 'clock',      color: C.navyPrimary },
  CANCELLED: { bg: C.redLight,   icon: 'x',          color: C.red },
});

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getProgress(trip) {
  if (!trip?.startedAt || !trip?.eta) return 0.3;
  const start = new Date(trip.startedAt).getTime();
  const end   = new Date(trip.eta).getTime();
  if (end <= start) return 0.5;
  return Math.min(Math.max((Date.now() - start) / (end - start), 0), 1);
}

function formatEta(val) {
  if (!val) return '--';
  try { return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return '--'; }
}

/* ─── SkeletonBox ────────────────────────────────────────────────── */

function SkeletonBox({ width, height, borderRadius = 6, style, shimmerStyle, C }) {
  return (
    <View style={[{ width, height, borderRadius, backgroundColor: C.border, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/* ─── StatusBadge ────────────────────────────────────────────────── */

function StatusBadge({ status, ss, C }) {
  const scale = useSharedValue(0.8);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [status]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cfg = statusConfig(C)[status] || { bg: C.bg, text: C.text3, dot: C.text3 };
  return (
    <Animated.View style={[ss.badge, { backgroundColor: cfg.bg }, animStyle]}>
      <View style={[ss.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[ss.badgeText, { color: cfg.text }]}>{status}</Text>
    </Animated.View>
  );
}

/* PressableScale used to be defined here — a good component that no other screen
   could reach, which is why 41 Pressables and 42 TouchableOpacities elsewhere
   never got press feedback. It now lives in components/common/PressableScale and
   adds haptics, reduced-motion support and an accessible name. */

/* ─── QuickActionTile ────────────────────────────────────────────── */

/**
 * A quick action.
 *
 * Two changes from the original:
 *
 * 1. The tile no longer takes a `bg`. All four used to be filled with a
 *    different saturated tint — blue, red, green, amber — which read as a
 *    rainbow strip where every action shouted equally loudly. The surface is now
 *    uniform and the ICON carries the meaning, so "Report issue" still reads as
 *    destructive without four competing blocks fighting for attention.
 *
 * 2. Press feedback and haptics come from the shared PressableScale instead of a
 *    local three-stage spring, so a quick action feels like every other control
 *    in the app rather than uniquely bouncy.
 */
function QuickActionTile({ icon, label, iconColor, onPress, hint, ss }) {
  return (
    <PressableScale
      onPress={onPress}
      label={label}
      hint={hint}
      activeScale={0.94}
      style={{ flex: 1, alignItems: 'center', gap: 8 }}
    >
      <View style={ss.qaTile}>
        <Feather name={icon} size={22} color={iconColor} />
      </View>
      <Text style={ss.qaLabel} numberOfLines={2}>{label}</Text>
    </PressableScale>
  );
}

/* ─── TripRow ────────────────────────────────────────────────────── */

function TripRow({ trip, isLast, onPress, ss, C }) {
  const cfg = rowConfig(C)[trip.status] || { bg: C.bg, icon: 'circle', color: C.text3 };

  const timeStr = (() => {
    const d = trip.completedAt || trip.startedAt;
    if (!d) return null;
    try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return null; }
  })();

  return (
    <Pressable
      onPress={onPress}
      style={[ss.tripRow, !isLast && ss.tripRowBorder]}
      android_ripple={{ color: 'rgba(27,58,107,0.04)' }}
      accessibilityRole="button"
      // Reads as one row rather than three separate fragments, and spells out
      // the route instead of announcing the "→" glyph mid-sentence.
      accessibilityLabel={`Trip ${trip.id}, from ${trip.origin || 'unknown'} to ${trip.destination || 'unknown'}`}
      accessibilityHint="Opens trip details"
    >
      <View style={[ss.tripRowIconWrap, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ss.tripRowRoute} numberOfLines={1}>
          {trip.origin || '–'} → {trip.destination || '–'}
        </Text>
        <Text style={ss.tripRowMeta}>
          {[timeStr, `#${trip.id}`].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <StatusBadge status={trip.status} ss={ss} C={C} />
    </Pressable>
  );
}

/* ─── HomeScreen ─────────────────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const ss = useMemo(() => makeStyles(C), [C]);

  const { userId }   = useAuthStore();
  // Only the setter: `activeTrip` is derived from the shared trips cache below
  // and pushed into the store, so there is one source of truth for it.
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);

  // Read straight from the shared driver cache so a name already fetched by
  // splash (prefetch) or a prior visit renders instantly, with no local-state
  // hop needed once loadData's fetchProfile call resolves.
  const fetchDriverProfile = useDriverStore((s) => s.fetchProfile);

  // Derived from the store, NOT copied into local state.
  //
  // It was `useState(cachedDriverName || 'Driver')`, and useState only reads its
  // argument on the first render — so whenever the profile wasn't already cached
  // at mount (a fresh login, or any launch where the fetch hadn't resolved yet)
  // the greeting stayed the literal "Driver" no matter what landed later.
  // Reading the store directly means the name appears the moment any caller
  // resolves the profile, whoever fetched it.
  const driverName = useDriverStore((s) => s.driver?.fullName)?.trim() || 'Driver';
  const [refreshing, setRefreshing] = useState(false);

  // Trips are shared with the Trips and Alerts tabs — one request, one copy.
  const trips       = useTripsCacheStore((s) => s.trips);
  const loading     = useTripsCacheStore((s) => s.loading);
  const refreshCache = useTripsCacheStore((s) => s.refresh);
  const ensureFresh = useTripsCacheStore((s) => s.ensureFresh);
  const [trackWidth, setTrackWidth] = useState(0);
  const [showEndShift, setShowEndShift] = useState(false);
  const [toast, setToast]           = useState(null);

  /* shimmer */
  const shimmer = useSharedValue(-300);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value }],
  }));
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(300, { duration: 1200, easing: Easing.linear }),
      -1, false
    );
  }, []);

  /* stagger entrance */
  const headerAnim  = useSharedValue(0);
  const cardAnim    = useSharedValue(0);
  const actionsAnim = useSharedValue(0);
  const tripsAnim   = useSharedValue(0);

  const headerStyle  = useAnimatedStyle(() => ({
    opacity:   headerAnim.value,
    transform: [{ translateY: interpolate(headerAnim.value, [0, 1], [-8, 0]) }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity:   cardAnim.value,
    transform: [{ translateY: interpolate(cardAnim.value, [0, 1], [20, 0]) }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity:   actionsAnim.value,
    transform: [{ translateY: interpolate(actionsAnim.value, [0, 1], [12, 0]) }],
  }));
  const tripsStyle = useAnimatedStyle(() => ({
    opacity:   tripsAnim.value,
    transform: [{ translateY: interpolate(tripsAnim.value, [0, 1], [12, 0]) }],
  }));

  /* progress bar */
  const progressAnim = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: progressAnim.value * trackWidth,
  }));

  /* toast */
  const toastOpacity = useSharedValue(0);
  const toastAnimStyle = useAnimatedStyle(() => ({
    opacity:   toastOpacity.value,
    transform: [{ translateY: interpolate(toastOpacity.value, [0, 1], [-20, 0]) }],
  }));

  const showToastMsg = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    toastOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(2000, withTiming(0, { duration: 300 }))
    );
    setTimeout(() => setToast(null), 2600);
  }, []);

  /* end-shift sheet */
  const sheetY       = useSharedValue(300);
  const backdropOpac = useSharedValue(0);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpac.value }));
  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const openEndShift = useCallback(() => {
    setShowEndShift(true);
    backdropOpac.value = withTiming(1, { duration: 250 });
    sheetY.value = withSpring(0, { damping: 18, stiffness: 180 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const closeEndShift = useCallback(() => {
    backdropOpac.value = withTiming(0, { duration: 200 });
    sheetY.value = withSpring(300, { damping: 18, stiffness: 180 }, () => {
      runOnJS(setShowEndShift)(false);
    });
  }, []);

  /* data */
  const loadData = useCallback(async (force = false) => {
    try {
      const [profileResult] = await Promise.allSettled([
        // fetchProfile commits to the driver store itself, and the greeting reads
        // straight from there — nothing to copy into local state here.
        fetchDriverProfile(userId, { force }),
        force ? refreshCache() : ensureFresh(),
      ]);

      // A failed profile fetch used to be indistinguishable from a driver
      // genuinely called "Driver". Surface it in dev at least, so the next time
      // the name is missing there's a reason in the log rather than silence.
      if (__DEV__ && profileResult.status === 'rejected') {
        console.log('[Home] driver profile fetch failed:', profileResult.reason?.message);
      }
    } catch (err) {
      if (__DEV__) console.log('[Home] loadData error:', err.message);
    }
  }, [userId, fetchDriverProfile, refreshCache, ensureFresh]);

  // Derived, not stored. Previously the active trip was picked inside the fetch,
  // so it only updated when *this* screen re-fetched; now it tracks the shared
  // cache, which means an action taken on another tab is reflected here without
  // Home having to reload.
  const activeTrip = useMemo(
    () => trips.find((t) => ['ASSIGNED', 'STARTED', 'EN_ROUTE', 'ARRIVED'].includes(t.status)),
    [trips],
  );

  useEffect(() => {
    if (!activeTrip) return;
    setActiveTrip(activeTrip);
    progressAnim.value = withTiming(getProgress(activeTrip), { duration: 600 });
  }, [activeTrip, setActiveTrip]);

  useEffect(() => {
    // Animate the shell in immediately so the screen appears instantly (skeleton first),
    // instead of waiting for the network. Data fills in when loadData resolves.
    headerAnim.value  = withTiming(1, { duration: 300 });
    cardAnim.value    = withDelay(80,  withSpring(1, { damping: 18, stiffness: 160 }));
    actionsAnim.value = withDelay(160, withTiming(1, { duration: 300 }));
    tripsAnim.value   = withDelay(240, withTiming(1, { duration: 300 }));
  }, []);

  // Load once `userId` is actually known.
  //
  // This used to sit in the mount-only effect above, which captured the very
  // first `loadData` closure — the one built while `userId` was still null on a
  // cold start (the auth store hydrates from SecureStore asynchronously).
  // `fetchProfile(null)` resolves to null immediately, and with `[]` deps the
  // effect never re-ran once the real id arrived, so the profile was simply
  // never requested. Keyed on `userId` so it fires exactly when there's an id
  // to fetch with, and again if a different driver signs in.
  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId, loadData]);

  // Revalidate when Home is re-focused, but only if the cache went stale — and
  // without ever clearing what is already rendered.
  useFocusEffect(useCallback(() => { ensureFresh(); }, [ensureFresh]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  // "Mark arrived" is a geofence-gated action — hand off to the live map screen,
  // which confirms the driver's current location is within range of the destination
  // before allowing the arrive action, rather than flipping the trip status here with
  // no location check.
  const handleMarkArrived = useCallback(() => {
    if (!activeTrip) { showToastMsg('No active trip to mark as arrived', 'warn'); return; }
    router.push({
      pathname: '/(driver)/trip/[id]/map',
      params: { id: activeTrip.id },
    });
  }, [activeTrip, router, showToastMsg]);

  const initials = driverName
    ? driverName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'D';

  /**
   * The "TODAY'S TRIPS" list, actually restricted to today.
   *
   * `/trips` returns the driver's whole history and the section rendered all of
   * it, so a heading that promised today was listing trips from days or weeks
   * back — trips #1 and #2 from 20 July were showing on 30 July.
   *
   * Derived here rather than filtering at `setTrips` on purpose: the active-trip
   * lookup in `loadData` must still search the FULL list, because a trip
   * assigned yesterday and still running is very much today's problem.
   *
   * The timestamp follows the same precedence the row itself displays
   * (completed → cancelled → started → created), so a trip appears under the
   * date the driver actually saw it happen. Boundaries are local midnight, not
   * UTC — "today" means the driver's day.
   */
  const todaysTrips = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return trips.filter((t) => {
      const raw = t.completedAt || t.cancelledAt || t.startedAt || t.createdAt;
      if (!raw) return false;
      const when = new Date(raw);
      if (Number.isNaN(when.getTime())) return false;
      return when >= start && when < end;
    });
  }, [trips]);

  // The greeting shows the first name only. The full name shared a row with two
  // icon buttons, so anything longer than about 14 characters was cut — "Simon
  // Prince Quarm" rendered as "Simon Prince Qu…". A first name is also simply
  // the warmer greeting, and the full name is still on the Profile screen.
  const firstName = driverName?.trim().split(/\s+/)[0] || 'Driver';

  /* ─── render ─────────────────────────────────────────────────── */
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* Toast */}
      {toast && (
        <Animated.View
          style={[
            ss.toast,
            toast.type === 'success' && { backgroundColor: C.green },
            toast.type === 'warn'    && { backgroundColor: C.amber },
            toast.type === 'error'   && { backgroundColor: C.red },
            toastAnimStyle,
          ]}
        >
          <Feather
            name={toast.type === 'success' ? 'check-circle' : toast.type === 'error' ? 'alert-circle' : 'info'}
            size={14}
            color="#fff"
          />
          <Text style={ss.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.teal}
            colors={[C.teal]}
          />
        }
      >

        {/* ── Header ────────────────────────────────────────────── */}
        <Animated.View style={headerStyle}>
          <View style={[ss.header, { paddingTop: Math.max(56, insets.top + 16) }]}>
            <View style={ss.headerTop}>
              {/* Announced as one phrase with the FULL name, so nothing is lost
                  to a screen reader even though the eye sees the short form. */}
              <View
                style={{ flex: 1, marginRight: 12 }}
                accessible
                accessibilityRole="header"
                accessibilityLabel={`${getGreeting()}, ${driverName}`}
              >
                <Text style={ss.greeting} numberOfLines={1}>{getGreeting()}</Text>
                <Text style={ss.driverName} numberOfLines={1} ellipsizeMode="tail">{firstName}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, flexShrink: 0 }}>
                <PressableScale
                  onPress={() => router.push('/(driver)/notifications_5')}
                  style={ss.headerCircleBtn}
                >
                  <Feather name="bell" size={19} color="#fff" />
                </PressableScale>
                <PressableScale
                  onPress={() => router.push('/(driver)/profile')}
                  style={ss.avatarBtn}
                >
                  <Text style={ss.avatarText}>{initials}</Text>
                </PressableScale>
              </View>
            </View>

            {/* Shift pill */}
            <View style={ss.shiftPill}>
              <View style={ss.shiftDot} />
              <Text style={ss.shiftText}>On shift · Started 08:00</Text>
              <PressableScale onPress={openEndShift} style={ss.endShiftBtn}>
                <Text style={ss.endShiftText}>End shift</Text>
              </PressableScale>
            </View>
          </View>
        </Animated.View>

        {/* ── Active Trip Card ───────────────────────────────────── */}
        <Animated.View style={[ss.card, cardStyle]}>
          {loading ? (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBox width={80} height={10} shimmerStyle={shimmerStyle} C={C} />
                <SkeletonBox width={60} height={22} borderRadius={11} shimmerStyle={shimmerStyle} C={C} />
              </View>
              <SkeletonBox width={200} height={18} shimmerStyle={shimmerStyle} C={C} />
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <SkeletonBox width={60} height={12} shimmerStyle={shimmerStyle} C={C} />
                <SkeletonBox width={60} height={12} shimmerStyle={shimmerStyle} C={C} />
                <SkeletonBox width={60} height={12} shimmerStyle={shimmerStyle} C={C} />
              </View>
              <SkeletonBox height={4} borderRadius={2} shimmerStyle={shimmerStyle} style={{ alignSelf: 'stretch' }} C={C} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SkeletonBox height={50} borderRadius={14} shimmerStyle={shimmerStyle} style={{ flex: 1 }} C={C} />
                <SkeletonBox height={50} borderRadius={14} shimmerStyle={shimmerStyle} style={{ flex: 1.4 }} C={C} />
              </View>
            </View>
          ) : activeTrip ? (
            <View>
              <View style={ss.cardTopRow}>
                <Text style={ss.cardLabel}>ACTIVE TRIP</Text>
                <StatusBadge status={activeTrip.status} ss={ss} C={C} />
              </View>
              <Text style={ss.tripIdText}>Trip #{activeTrip.id}</Text>
              <View style={ss.routeRow}>
                <Text style={ss.routeOrigin} numberOfLines={1}>
                  {shortLocation(activeTrip.origin) || 'Origin'}
                </Text>
                <Text style={ss.routeArrow}>→</Text>
                <Text style={ss.routeDest} numberOfLines={1}>
                  {shortLocation(activeTrip.destination) || 'Destination'}
                </Text>
              </View>
              <View style={ss.metaRow}>
                <View style={ss.metaItem}>
                  <Feather name="clock" size={14} color={C.teal} />
                  <Text style={ss.metaText}>{formatEta(activeTrip.eta)}</Text>
                </View>
                <View style={ss.metaItem}>
                  <Feather name="map-pin" size={14} color={C.teal} />
                  <Text style={ss.metaText}>
                    {activeTrip.distanceKm ? `${activeTrip.distanceKm} km` : '-- km'}
                  </Text>
                </View>
                <View style={ss.metaItem}>
                  <Feather name="package" size={14} color={C.teal} />
                  <Text style={ss.metaText}>
                    {activeTrip.cargoDescription || activeTrip.cargo || 'Cargo'}
                  </Text>
                </View>
              </View>
              <View
                style={ss.progressTrack}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
              >
                <Animated.View style={[ss.progressFill, progressStyle]} />
              </View>
              <View style={ss.cardActions}>
                <View style={{ flex: 1 }}>
                  <PressableScale
                    onPress={() => router.push({
                      pathname: '/(driver)/trip/[id]/map',
                      params: { id: activeTrip.id },
                    })}
                    style={ss.navBtn}
                  >
                    <Feather name="navigation" size={16} color={C.navyPrimary} />
                    <Text style={ss.navBtnText}>Navigate</Text>
                  </PressableScale>
                </View>
                <View style={{ flex: 1.4 }}>
                  <PressableScale
                    onPress={() => router.push(`/(driver)/trip/${activeTrip.id}`)}
                    style={ss.viewDetailsBtn}
                  >
                    <Feather name="file-text" size={16} color="#fff" />
                    <Text style={ss.viewDetailsBtnText}>View trip details</Text>
                  </PressableScale>
                </View>
              </View>
            </View>
          ) : (
            <View style={ss.noTripBox}>
              <Feather name="truck" size={36} color={C.teal} />
              <Text style={ss.noTripTitle}>No active trip</Text>
              <Text style={ss.noTripSub}>
                Your dispatcher will assign your next trip here
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── Quick Actions ──────────────────────────────────────── */}
        <Animated.View style={actionsStyle}>
          <Text style={[ss.sectionLabel, { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }]}>
            QUICK ACTIONS
          </Text>
          <View style={ss.qaRow}>
            <QuickActionTile
              icon="camera" label="Take photo" ss={ss}
              iconColor={C.navyPrimary}
              hint="Opens the pre-dispatch photo step for your active trip"
              onPress={() => activeTrip
                ? router.push(`/(driver)/delivery/pre-dispatch/${activeTrip.id}`)
                : showToastMsg('No active trip', 'warn')}
            />
            <QuickActionTile
              icon="alert-triangle" label="Report issue" ss={ss}
              iconColor={C.red}
              hint="Reports an incident on your active trip"
              onPress={() => activeTrip
                ? router.push(`/(driver)/incident/report/${activeTrip.id}`)
                : showToastMsg('No active trip', 'warn')}
            />
            <QuickActionTile
              icon="check-circle" label="Mark arrived" ss={ss}
              iconColor={C.green}
              hint="Marks you as arrived at the destination"
              onPress={handleMarkArrived}
            />
            <QuickActionTile
              icon="phone" label="Call dispatch" ss={ss}
              iconColor={C.amber}
              hint="Calls the dispatch office"
              onPress={() => Linking.openURL(`tel:${DISPATCH_PHONE}`)}
            />
          </View>
        </Animated.View>

        {/* ── Today's Trips ──────────────────────────────────────── */}
        <Animated.View style={tripsStyle}>
          <Text style={[ss.sectionLabel, { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }]}>
            TODAY'S TRIPS
          </Text>
          {todaysTrips.length === 0 ? (
            <EmptyState
              compact
              // Smaller here than in a full-screen empty state — this sits
              // inside a section, not on its own page.
              illustration={<NoTripsIllustration size={84} />}
              title="No trips today"
              // Nudges toward history rather than implying the driver has never
              // done anything — they may well have trips, just not today's.
              message={
                trips.length > 0
                  ? "Nothing completed today yet. Earlier trips are in your history."
                  : 'Trips you complete today will show up here.'
              }
              action={{
                label: 'View history',
                icon: 'clock',
                onPress: () => router.push('/(driver)/trip/history_2'),
              }}
            />
          ) : (
            <View style={ss.tripsCard}>
              {todaysTrips.slice(0, 8).map((trip, i) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  ss={ss}
                  C={C}
                  isLast={i === Math.min(todaysTrips.length, 8) - 1}
                  onPress={() => router.push(`/(driver)/trip/${trip.id}`)}
                />
              ))}
            </View>
          )}
        </Animated.View>

      </ScrollView>

      {/* ── End Shift Bottom Sheet ─────────────────────────────────── */}
      {showEndShift && (
        <Modal transparent animationType="none" visible onRequestClose={closeEndShift}>
          <View style={{ flex: 1 }}>
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }, backdropStyle]}
            />
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeEndShift}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              accessibilityHint="Closes the end-shift prompt"
            />
            <Animated.View style={[ss.sheet, sheetAnimStyle]}>
              <View style={ss.sheetHandle} />
              <Text style={ss.sheetTitle}>End shift?</Text>
              <Text style={ss.sheetBody}>This will mark your shift as complete for the day.</Text>
              <View style={ss.sheetBtns}>
                <PressableScale onPress={closeEndShift} style={[ss.sheetBtn, ss.sheetBtnCancel]}>
                  <Text style={ss.sheetBtnCancelText}>Cancel</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => {
                    closeEndShift();
                    showToastMsg('Shift ended', 'success');
                  }}
                  style={[ss.sheetBtn, ss.sheetBtnConfirm]}
                >
                  <Text style={ss.sheetBtnConfirmText}>End shift</Text>
                </PressableScale>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

    </View>
  );
}

/* ─── styles ─────────────────────────────────────────────────────── */

const makeStyles = (C) => StyleSheet.create({
  /* header — always the deep navy hero bar */
  header: {
    backgroundColor: C.navyDark,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 18,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 3,
  },
  driverName: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 26,
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.teal,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#fff',
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  shiftDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  shiftText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  endShiftBtn: {
    backgroundColor: 'rgba(220,38,38,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.30)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  endShiftText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#F87171',
  },

  /* active trip card */
  card: {
    marginHorizontal: 16,
    marginTop: -20,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginBottom: 4,
    zIndex: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    color: C.text3,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    gap: 5,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },
  tripIdText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: C.text3,
    marginBottom: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  routeOrigin: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: C.text1,
    flex: 1,
  },
  routeArrow: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: C.teal,
  },
  routeDest: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: C.text1,
    flex: 1,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: C.text2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: C.bg,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.navyPrimary,
    borderRadius: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.navyPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  navBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: C.navyPrimary,
  },
  viewDetailsBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: C.navyPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: C.navyPrimary,
    shadowOpacity: 0.30,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  viewDetailsBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: -0.2,
  },
  noTripBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  noTripTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: C.text1,
    marginTop: 2,
  },
  noTripSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: C.text3,
    textAlign: 'center',
    marginTop: 4,
  },

  /* section label */
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: C.text3,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* quick actions */
  qaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  qaTile: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    // Uniform surface for all four tiles — the icon colour carries the meaning.
    // Previously each tile was filled with its own saturated tint, which made
    // the row read as a rainbow with no hierarchy between the actions.
    backgroundColor: C.surface,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...C.elevation.sm,
  },
  qaLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: C.text2,
    textAlign: 'center',
  },

  /* today's trips */
  tripsCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  tripRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tripRowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripRowRoute: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: C.text1,
  },
  tripRowMeta: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: C.text3,
    marginTop: 2,
  },
  // emptyBox / emptyTitle / emptySub removed — EmptyState owns that layout now,
  // and unlike the old block it offers the driver an action.

  /* toast */
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.navyPrimary,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },

  /* end shift sheet */
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: C.text1,
    marginBottom: 8,
  },
  sheetBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: C.text3,
    lineHeight: 20,
  },
  sheetBtns: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 24,
  },
  sheetBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnCancel: {
    backgroundColor: C.bg,
  },
  sheetBtnCancelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: C.text2,
  },
  sheetBtnConfirm: {
    backgroundColor: C.red,
  },
  sheetBtnConfirmText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#fff',
  },
});
