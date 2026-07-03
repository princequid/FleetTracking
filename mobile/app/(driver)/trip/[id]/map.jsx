import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Dimensions, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming,
  Easing, interpolateColor,
} from 'react-native-reanimated';
import { C } from '../../../../constants/colors';
import tripService from '../../../../services/tripService_2';
import api from '../../../../services/api_1';

const ARRIVE_RADIUS = 200; // metres

// ─── Haversine ───────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── GeoJSON route parser ─────────────────────────────────────────────────────
function parseRoute(geo) {
  if (!geo) return [];
  try {
    const g = typeof geo === 'string' ? JSON.parse(geo) : geo;
    const coords = g.coordinates || (g.geometry && g.geometry.coordinates) || [];
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDist(m) {
  if (m == null) return '––';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function calcEta(distM, speedKmh) {
  if (!speedKmh || speedKmh < 2 || !distM) return '--:--';
  const t = new Date(Date.now() + (distM / 1000 / speedKmh) * 3_600_000);
  return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Pulsing ring (Reanimated) ────────────────────────────────────────────────
function PulseRing() {
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(2.2, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1, false,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1, false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: C.teal },
        style,
      ]}
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LiveMapScreen() {
  const router  = useRouter();
  const { id }  = useLocalSearchParams();
  const tripId  = String(id);
  const insets  = useSafeAreaInsets();
  const mapRef  = useRef(null);

  const [trip,       setTrip]       = useState(null);
  const [location,   setLocation]   = useState(null);
  const [route,      setRoute]      = useState([]);
  const [distance,   setDistance]   = useState(null);
  const [permDenied, setPermDenied] = useState(false);
  const [arriving,   setArriving]   = useState(false);
  const [arrived,    setArrived]    = useState(false);
  const [centered,   setCentered]   = useState(true);
  const centeredRef = useRef(true);
  const watchRef    = useRef(null);

  // Keep ref in sync so GPS callback always reads current value
  useEffect(() => { centeredRef.current = centered; }, [centered]);

  // ── Load trip ──
  useEffect(() => {
    api.get(`/trips/${tripId}`)
      .then((r) => {
        setTrip(r.data);
        if (r.data.status === 'ARRIVED') setArrived(true);
        setRoute(parseRoute(r.data.routeGeometry));
      })
      .catch(() => {});
  }, [tripId]);

  // ── GPS watch ──
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setPermDenied(true); return; }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 8,
        },
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          const speedKmh = speed != null ? Math.round(speed * 3.6) : 0;
          setLocation({ latitude, longitude, speed: speedKmh, heading: heading ?? 0 });

          if (centeredRef.current && mapRef.current) {
            mapRef.current.animateCamera(
              { center: { latitude, longitude }, zoom: 16 },
              { duration: 500 },
            );
          }

          // Fire-and-forget ping
          tripService.sendGpsPing(tripId, {
            latitude, longitude, speedKmh,
            heading: heading ?? 0,
            timestamp: new Date(pos.timestamp).toISOString(),
          }).catch(() => {});
        },
      );
      watchRef.current = sub;
    })();

    return () => { watchRef.current?.remove?.(); };
  }, []);

  // ── Distance to destination ──
  useEffect(() => {
    if (!location || !trip?.destinationLat) return;
    setDistance(haversine(
      location.latitude, location.longitude,
      trip.destinationLat, trip.destinationLng,
    ));
  }, [location, trip]);

  // ── Reanimated: arrive button colour ──
  const hasDestCoords = Boolean(trip?.destinationLat);
  const canArrive     = !arrived && (!hasDestCoords || (distance != null && distance <= ARRIVE_RADIUS));
  const arriveAnim    = useSharedValue(0);

  useEffect(() => {
    arriveAnim.value = withTiming(canArrive ? 1 : 0, { duration: 400 });
  }, [canArrive]);

  const arriveBtnStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      arriveAnim.value,
      [0, 1],
      [arrived ? C.green : '#CBD5E1', C.green],
    ),
    shadowOpacity: arriveAnim.value * 0.35,
  }));

  // ── Mark arrived ──
  const handleMarkArrived = useCallback(async () => {
    if (!canArrive || arriving || arrived) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setArriving(true);
    try {
      await tripService.markArrived(tripId);
      setArrived(true);
      setTrip((p) => p ? { ...p, status: 'ARRIVED' } : p);
    } catch {
      Alert.alert('Error', 'Could not mark arrival. Check your connection and try again.');
    } finally {
      setArriving(false);
    }
  }, [canArrive, arriving, arrived, tripId]);

  // ── Re-center ──
  const handleReCenter = useCallback(() => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateCamera(
      { center: { latitude: location.latitude, longitude: location.longitude }, zoom: 16 },
      { duration: 400 },
    );
    setCentered(true);
  }, [location]);

  const destCoord = trip?.destinationLat
    ? { latitude: trip.destinationLat, longitude: trip.destinationLng }
    : null;

  const initRegion = location
    ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }
    : route.length
    ? { latitude: route[0].latitude, longitude: route[0].longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
    : { latitude: 5.6037, longitude: -0.1870, latitudeDelta: 0.12, longitudeDelta: 0.12 };

  const speedKmh = location?.speed ?? 0;
  const eta      = calcEta(distance, speedKmh);

  const arriveLabel = arrived
    ? 'Arrived ✓'
    : arriving
    ? 'Marking…'
    : canArrive
    ? 'Mark Arrived'
    : hasDestCoords && distance != null
    ? `Mark Arrived  •  ${fmtDist(distance)} away`
    : 'Mark Arrived';

  // ── Permission denied ──
  if (permDenied) {
    return (
      <View style={[styles.permWrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Feather name="map-off" size={52} color={C.text3} />
        <Text style={styles.permTitle}>Location Access Denied</Text>
        <Text style={styles.permSub}>
          Enable location permissions in your device settings to use live navigation.
        </Text>
        <TouchableOpacity style={styles.permBackBtn} onPress={() => router.back()}>
          <Text style={styles.permBackBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={initRegion}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        onPanDrag={() => setCentered(false)}
        rotateEnabled={false}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          tileSize={256}
          shouldReplaceMapContent={Platform.OS === 'android'}
        />

        {route.length >= 2 && (
          <Polyline
            coordinates={route}
            strokeColor={C.navyPrimary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {destCoord && (
          <Marker coordinate={destCoord} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.destPin}>
              <Feather name="map-pin" size={22} color={C.red} />
            </View>
          </Marker>
        )}

        {location && (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges
          >
            <View style={styles.vehicleWrapper}>
              <PulseRing />
              <View style={styles.vehicleDot}>
                <Feather name="navigation-2" size={16} color="#fff" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
          <Feather name="chevron-down" size={22} color={C.navyPrimary} />
        </TouchableOpacity>

        <View style={styles.topInfo}>
          <Text style={styles.topTripId} numberOfLines={1}>Trip #{tripId}</Text>
          {trip && (
            <Text style={styles.topRoute} numberOfLines={1}>
              {trip.origin ?? '–'}  →  {trip.destination ?? '–'}
            </Text>
          )}
        </View>

        {arrived && (
          <View style={styles.arrivedBadge}>
            <Feather name="check-circle" size={13} color={C.green} />
            <Text style={styles.arrivedBadgeText}>Arrived</Text>
          </View>
        )}
      </View>

      {/* ── Re-center FAB ── */}
      {!centered && (
        <TouchableOpacity
          style={[styles.recenterFab, { bottom: insets.bottom + 196 }]}
          onPress={handleReCenter}
        >
          <Feather name="crosshair" size={20} color={C.navyPrimary} />
        </TouchableOpacity>
      )}

      {/* ── Bottom panel ── */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'ETA',      value: eta },
            { label: 'Distance', value: fmtDist(distance) },
            { label: 'Speed',    value: speedKmh > 0 ? `${speedKmh} km/h` : '0 km/h' },
          ].map((s) => (
            <View key={s.label} style={styles.statPill}>
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Mark Arrived button */}
        <Animated.View style={[styles.arriveBtn, arriveBtnStyle]}>
          <TouchableOpacity
            style={styles.arriveBtnInner}
            onPress={handleMarkArrived}
            disabled={arrived || arriving}
            activeOpacity={canArrive ? 0.75 : 1}
          >
            <Feather
              name={arrived ? 'check-circle' : 'map-pin'}
              size={18}
              color="#fff"
            />
            <Text style={styles.arriveBtnText}>{arriveLabel}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* After arriving, shortcut back to trip detail */}
        {arrived && (
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => router.push(`/(driver)/trip/${tripId}_2`)}
          >
            <Text style={styles.continueBtnText}>Continue trip  →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EFF8' },

  // Permission denied
  permWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32, backgroundColor: C.bg,
  },
  permTitle: { fontFamily: 'Inter-Bold', fontSize: 18, color: C.text1, textAlign: 'center' },
  permSub:   { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
  permBackBtn: {
    marginTop: 8, backgroundColor: C.navyPrimary, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 13,
  },
  permBackBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#fff' },

  // Top bar
  topBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  topInfo: { flex: 1 },
  topTripId: { fontFamily: 'Inter-Bold', fontSize: 14, color: C.text1 },
  topRoute:  { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, marginTop: 1 },
  arrivedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.greenLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  arrivedBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.green },

  // Vehicle marker
  vehicleWrapper: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  vehicleDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.navyPrimary, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.navyPrimary, shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
    borderWidth: 2.5, borderColor: '#fff',
  },

  // Destination marker
  destPin: { padding: 2 },

  // Re-center FAB
  recenterFab: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },

  // Bottom panel
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 16, paddingHorizontal: 20, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  statsRow: { flexDirection: 'row', gap: 8 },
  statPill: {
    flex: 1, alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 8, gap: 2,
  },
  statVal: { fontFamily: 'Inter-Bold', fontSize: 15, color: C.text1 },
  statLbl: { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3 },

  // Arrive button
  arriveBtn: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4,
  },
  arriveBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, paddingHorizontal: 20,
  },
  arriveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },

  // Continue trip
  continueBtn: {
    height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.teal, borderRadius: 12,
  },
  continueBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.teal },
});
