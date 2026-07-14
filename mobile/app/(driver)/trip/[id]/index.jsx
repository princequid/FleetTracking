import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, SafeAreaView, Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../../services/api_1';
import { useTheme } from '../../../../theme/ThemeContext';

const { width } = Dimensions.get('window');

const STEPS = [
  { key: 'pre_dispatch', label: 'Pre-dispatch photo', icon: 'camera' },
  { key: 'started',      label: 'Trip started',       icon: 'play-circle' },
  { key: 'arrived',      label: 'Mark arrived',       icon: 'map-pin' },
  { key: 'pod',          label: 'Capture POD',        icon: 'image' },
  { key: 'complete',     label: 'Complete trip',      icon: 'check-circle' },
];

// Trim a location name to its first few words so the header stays tidy.
function shortLocation(name, max = 3) {
  if (!name) return '';
  const words = String(name).trim().split(/\s+/);
  return words.length <= max ? name : words.slice(0, max).join(' ') + '…';
}

function statusToStep(status) {
  if (!status) return 0;
  if (status === 'ASSIGNED') return 0;
  if (status === 'STARTED' || status === 'EN_ROUTE') return 1;
  if (status === 'ARRIVED') return 2;
  return 4;
}

function PulsingRing({ color, styles }) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.6, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 2000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[styles.pulseRing, { borderColor: color, transform: [{ scale }], opacity }]}
    />
  );
}

function StepCard({ step, index, activeIndex, styles, C }) {
  const isDone   = index < activeIndex;
  const isActive = index === activeIndex;
  const breathe  = useRef(new Animated.Value(1)).current;
  const loopRef  = useRef(null);

  useEffect(() => {
    if (isActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 1,    duration: 1000, useNativeDriver: true }),
        ])
      );
      loop.start();
      loopRef.current = loop;
      return () => loop.stop();
    } else {
      if (loopRef.current) loopRef.current.stop();
      breathe.stopAnimation();
      Animated.timing(breathe, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive]);

  const bg = isDone ? C.greenLight : isActive ? C.accentSoft : C.bg;
  const opacity = !isDone && !isActive ? 0.4 : 1;

  return (
    <Animated.View style={[styles.stepCard, { backgroundColor: bg, opacity, transform: [{ scale: breathe }] }]}>
      <View style={[
        styles.stepBadge,
        isDone   ? styles.stepBadgeDone   :
        isActive ? styles.stepBadgeActive : styles.stepBadgeLocked,
      ]}>
        {isDone
          ? <Feather name="check" size={14} color="#fff" />
          : <Text style={styles.stepNum}>{index + 1}</Text>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepLabel, { color: isDone ? C.green : isActive ? C.navyPrimary : C.text3 }]}>
          {step.label}
        </Text>
        {isDone   && <Text style={styles.stepDoneText}>Completed</Text>}
        {isActive && <Text style={styles.stepActiveText}>Current step</Text>}
      </View>
      <Feather name={step.icon} size={18} color={isDone ? C.green : isActive ? C.navyPrimary : C.border} />
    </Animated.View>
  );
}

// One point in the trip's route timeline (start / a stop / destination).
function RouteStop({ color, tag, name, description, number, last, styles }) {
  return (
    <View style={styles.routeRow}>
      <View style={styles.routeGutter}>
        <View style={[styles.routeDot, { backgroundColor: color }]}>
          {number != null && <Text style={styles.routeDotNum}>{number}</Text>}
        </View>
        {!last && <View style={styles.routeLine} />}
      </View>
      <View style={[styles.routeBody, last && { paddingBottom: 0 }]}>
        <Text style={[styles.routeTag, { color }]}>{tag}</Text>
        <Text style={styles.routeName}>{name}</Text>
        {description ? <Text style={styles.routeDesc}>{description}</Text> : null}
      </View>
    </View>
  );
}

// This screen is now READ-ONLY regarding trip progression — Start/Arrive/Capture
// photos/Complete all live on the live-navigation map as one sequential button, so
// there's a single source of truth for those (location-gated) actions instead of two
// screens that could drift out of sync. This page shows route/status/instructions
// and hands off to the map for anything that advances the trip.
export default function TripDetailScreen() {
  const router = useRouter();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams();
  const tripId = String(id);

  const [trip, setTrip] = useState(null);

  useEffect(() => {
    api.get(`/trips/${tripId}`)
      .then((r) => setTrip(r.data))
      .catch(() => {});
  }, [tripId]);

  const activeStep = trip ? statusToStep(trip.status) : 0;
  const canOpenNav = trip && !['DELIVERED', 'CANCELLED'].includes(trip.status);

  const navButtonLabel = (() => {
    if (!trip) return 'Open live navigation';
    if (trip.status === 'ASSIGNED') return 'Move to pickup';
    if (trip.status === 'STARTED' || trip.status === 'EN_ROUTE') return 'Continue navigation';
    if (trip.status === 'ARRIVED') return 'Continue to complete trip';
    return 'Open live navigation';
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navyDark }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={20} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerMid}>
          <Text style={styles.headerTripId}>Trip #{tripId}</Text>
          {trip && (
            <View style={styles.headerBadge}>
              <View style={[styles.badgeDot, { backgroundColor: C.amber }]} />
              <Text style={[styles.badgeText, { color: C.amber }]}>{trip.status}</Text>
            </View>
          )}
        </View>

        <Text style={styles.headerRoute}>
          {shortLocation(trip?.origin) || '–'}{'\n'}
          <Text style={{ color: C.tealLight }}>  ↓{'\n'}</Text>
          {shortLocation(trip?.destination) || '–'}
        </Text>

        <View style={styles.statRow}>
          {[
            { label: 'ETA',      val: trip?.eta ? new Date(trip.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–' },
            { label: 'Distance', val: '–– km' },
            { label: 'Speed',    val: '–– km/h' },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.miniMap}>
          <View style={styles.mapGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={styles.mapGridLine} />
            ))}
          </View>
          <View style={styles.mapCenter}>
            <PulsingRing color={C.teal} styles={styles} />
            <View style={styles.vehicleMarker}>
              <Feather name="navigation-2" size={14} color="#fff" />
            </View>
          </View>
          <View style={[styles.mapPin, { top: 20, left: 20 }]}>
            <Feather name="map-pin" size={16} color={C.green} />
          </View>
          <View style={[styles.mapPin, { bottom: 20, right: 20 }]}>
            <Feather name="map-pin" size={16} color={C.red} />
          </View>
          <TouchableOpacity style={styles.expandBtn}>
            <Feather name="maximize-2" size={14} color={C.text3} />
          </TouchableOpacity>
        </View>

        {/* Full route: start → stops → destination, with any admin descriptions */}
        <View>
          <Text style={styles.sectionLabel}>ROUTE</Text>
          <View style={styles.routeCard}>
            <RouteStop
              color={C.green}
              tag="START"
              name={trip?.origin || 'Origin'}
              description={trip?.originDescription || trip?.originNote}
              styles={styles}
            />
            {(trip?.stops || []).map((s, i) => (
              <RouteStop
                key={s.id ?? `stop-${i}`}
                color={C.navyPrimary}
                tag={`STOP ${i + 1}`}
                number={i + 1}
                name={s.name || s.locationName || `Stop ${i + 1}`}
                description={s.description || s.note}
                styles={styles}
              />
            ))}
            <RouteStop
              color={C.red}
              tag="DESTINATION"
              name={trip?.destination || 'Destination'}
              description={trip?.destinationDescription || trip?.destNote}
              last
              styles={styles}
            />
          </View>
        </View>

        {trip?.description ? (
          <View>
            <Text style={styles.sectionLabel}>INSTRUCTIONS FROM DISPATCH</Text>
            <View style={styles.notesCard}>
              <Feather name="info" size={16} color={C.navyPrimary} style={{ marginTop: 1 }} />
              <Text style={styles.notesText}>{trip.description}</Text>
            </View>
          </View>
        ) : null}

        <View>
          <Text style={styles.sectionLabel}>TRIP PROGRESS</Text>
          <View style={styles.stepsCol}>
            {STEPS.map((step, i) => (
              <StepCard key={step.key} step={step} index={i} activeIndex={activeStep} styles={styles} C={C} />
            ))}
          </View>
        </View>

        {canOpenNav && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/(driver)/trip/[id]/map', params: { id: tripId } })}
          >
            <Feather name="navigation" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>{navButtonLabel}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Having a problem?</Text>
          <Text style={styles.dangerSub}>Report any issues or incidents during this trip</Text>
          <TouchableOpacity style={styles.reportBtn} onPress={() => router.push(`/(driver)/incident/report/${tripId}`)}>
            <Text style={styles.reportBtnText}>Report incident</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: { backgroundColor: C.navyDark, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { fontFamily: 'Inter-Medium', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  headerMid: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTripId: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },
  headerRoute: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff', lineHeight: 22 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  statVal: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#fff' },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  miniMap: { height: 180, backgroundColor: C.accentSoft, borderRadius: 16, overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  mapGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around' },
  mapGridLine: { width: 1, backgroundColor: 'rgba(0,0,0,0.06)', height: '100%' },
  mapCenter: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  vehicleMarker: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.navyPrimary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.navyPrimary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  mapPin: { position: 'absolute' },
  expandBtn: {
    position: 'absolute', bottom: 10, right: 10,
    width: 30, height: 30, borderRadius: 8, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  sectionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8, marginBottom: 10 },
  stepsCol: { gap: 8 },

  // Route timeline (start → stops → destination)
  routeCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  routeRow: { flexDirection: 'row' },
  routeGutter: { width: 26, alignItems: 'center' },
  routeDot: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.surface,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  routeDotNum: { fontFamily: 'Inter-Bold', fontSize: 10, color: '#fff' },
  routeLine: { width: 2, flex: 1, backgroundColor: C.border, marginVertical: 2 },
  routeBody: { flex: 1, paddingLeft: 10, paddingBottom: 18 },
  routeTag: { fontFamily: 'Inter-SemiBold', fontSize: 10, letterSpacing: 0.5 },
  routeName: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1, marginTop: 2 },
  routeDesc: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, marginTop: 3, lineHeight: 18 },
  notesCard: {
    flexDirection: 'row', gap: 10, backgroundColor: C.accentSoft, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  notesText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: C.text2, lineHeight: 20 },
  stepCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  stepBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepBadgeDone:   { backgroundColor: C.green },
  stepBadgeActive: { backgroundColor: C.navyPrimary },
  stepBadgeLocked: { backgroundColor: C.border },
  stepNum: { fontFamily: 'Inter-Bold', fontSize: 13, color: '#fff' },
  stepLabel: { fontFamily: 'Inter-SemiBold', fontSize: 14 },
  stepDoneText:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.green, marginTop: 2 },
  stepActiveText: { fontFamily: 'Inter-Medium', fontSize: 12, color: C.navyPrimary, marginTop: 2 },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: C.teal, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.teal, shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  actionBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff', letterSpacing: -0.2 },
  dangerCard: { backgroundColor: C.redLight, borderWidth: 1, borderColor: C.redLight, borderRadius: 14, padding: 16, gap: 4 },
  dangerTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1 },
  dangerSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3, marginBottom: 10 },
  reportBtn: { borderWidth: 1.5, borderColor: C.red, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  reportBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.red },
});
