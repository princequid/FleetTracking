import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, BackHandler, Platform, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withRepeat, withSequence,
  Easing, interpolate,
} from 'react-native-reanimated';
import { C } from '../../../../constants/colors';
import api from '../../../../services/api_1';
import { useNavStore } from '../../../../store/navStore_2';

const ARRIVE_RADIUS = 50;    // within this of the destination → "Mark arrived"
const READY_RADIUS  = 50;    // within this of the trip start → "Ready" button
// Public OSRM server (HTTPS) so routes follow real roads from anywhere the phone has
// internet — no local OSRM/firewall needed. Override with EXPO_PUBLIC_OSRM_URL to use a
// self-hosted OSRM instead. If unreachable, the map falls back to a direct line.
const OSRM_BASE     = process.env.EXPO_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';
const REROUTE_DIST  = 80;

// Navigation phases:
//   APPROACH — Leg 1: routing the driver to the trip's start point.
//   AT_START — reached the start; trip route (origin→destination) loaded, awaiting Start.
//   TRIP     — Leg 2: navigating the actual trip from start to destination.
const PHASE = { APPROACH: 'APPROACH', AT_START: 'AT_START', TRIP: 'TRIP' };

// In-memory cache of a trip's resolved route/nav state, keyed by tripId. Survives
// navigating away and back within the app session, so re-opening the map is instant
// (no re-fetch/geocode/route). Cleared when the trip is marked arrived.
const routeCache = new Map();
// Street-level navigation zoom. The MapView caps zoom at maxZoomLevel={18}
// (and UrlTile at maximumZ={18} to avoid black tiles), so 18 is the maximum
// practical navigation zoom for this map. Shared by auto-zoom, follow and recenter
// so the camera never snaps between zoom levels.
const NAV_ZOOM = 18;
// Apple Maps (PROVIDER_DEFAULT on iOS) ignores Camera.zoom and uses Camera.altitude
// (metres) instead. ~350 m gives an equivalent street-level navigation view. Camera
// helpers below set BOTH fields so zoom works on Google (Android) and Apple (iOS).
const NAV_ALTITUDE = 350;
const MIN_ZOOM = 3;
// Native vector maps render detail well past 18 without going black.
const MAX_ZOOM = 20;

// Screen height — used to offset the driver marker toward the lower third while
// following (via mapPadding), so more of the road ahead is visible.
const SCREEN_H = Dimensions.get('window').height;

// ─── Step instruction builder ─────────────────────────────────────────────────
function buildInstruction(step) {
  const name = step.name || 'the road';
  const type = step.maneuver?.type  || '';
  const mod  = step.maneuver?.modifier || '';

  if (type === 'depart')  return `Head onto ${name}`;
  if (type === 'arrive')  return 'You have arrived at your destination';
  if (type === 'roundabout' || type === 'rotary')
    return `At the roundabout, exit onto ${name}`;
  if (type === 'merge')   return `Merge onto ${name}`;
  if (type === 'fork')
    return mod.includes('right')
      ? `Keep right at the fork onto ${name}`
      : `Keep left at the fork onto ${name}`;
  if (type === 'turn' || type === 'new name') {
    if (mod === 'left')         return `Turn left onto ${name}`;
    if (mod === 'right')        return `Turn right onto ${name}`;
    if (mod === 'slight left')  return `Keep slightly left onto ${name}`;
    if (mod === 'slight right') return `Keep slightly right onto ${name}`;
    if (mod === 'sharp left')   return `Turn sharply left onto ${name}`;
    if (mod === 'sharp right')  return `Turn sharply right onto ${name}`;
    if (mod === 'straight')     return `Continue straight on ${name}`;
  }
  return `Continue on ${name}`;
}

function getManeuverIcon(type, modifier) {
  const mod = modifier || '';
  if (!type || type === 'depart') return 'navigation';
  if (type === 'arrive')  return 'map-pin';
  if (type === 'roundabout' || type === 'rotary') return 'rotate-ccw';
  if (type === 'merge')   return 'git-merge';
  if (type === 'fork')
    return mod.includes('right') ? 'arrow-up-right' : 'arrow-up-left';
  if (type === 'turn' || type === 'new name') {
    if (mod === 'left'  || mod === 'sharp left')  return 'corner-up-left';
    if (mod === 'right' || mod === 'sharp right') return 'corner-up-right';
    if (mod === 'slight left')  return 'arrow-up-left';
    if (mod === 'slight right') return 'arrow-up-right';
  }
  return 'arrow-up';
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────
function parseRoute(geo) {
  if (!geo) return [];
  try {
    const g = typeof geo === 'string' ? JSON.parse(geo) : geo;
    const coords = g.coordinates ?? g.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch { return []; }
}

function haversineMetres(lat1, lng1, lat2, lng2) {
  if (lat2 == null || lng2 == null) return Infinity;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Camera bearing helpers ─────────────────────────────────────────────────────
// Initial compass bearing (degrees, 0–360) from point A to point B.
function bearingBetween(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
// Signed smallest difference b−a in [−180, 180].
function angleDiff(a, b) { return ((b - a + 540) % 360) - 180; }
// Interpolate along the SHORTEST arc from a→b by fraction t (handles 359°→1° wrap).
function angleLerp(a, b, t) { return (a + angleDiff(a, b) * t + 360) % 360; }

// A point on the route ~aheadM metres in front of the driver, used to orient the
// camera toward where the driver is going (look-ahead), not just the noisy GPS heading.
function routeLookAheadPoint(coords, lat, lng, aheadM) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  let ci = 0, md = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineMetres(lat, lng, coords[i].latitude, coords[i].longitude);
    if (d < md) { md = d; ci = i; }
  }
  let acc = 0;
  for (let i = ci; i < coords.length - 1; i++) {
    acc += haversineMetres(coords[i].latitude, coords[i].longitude, coords[i + 1].latitude, coords[i + 1].longitude);
    if (acc >= aheadM) return coords[i + 1];
  }
  return coords[coords.length - 1];
}

function formatDistance(m) {
  if (!m || m === Infinity) return '––';
  if (m < 50)   return 'nearby';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// OSRM-based ETA: duration in seconds
function formatEtaMins(secs) {
  if (secs == null || secs <= 0) return '--';
  if (secs < 60) return '< 1 min';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatArrivalTime(secs) {
  if (secs == null) return '--';
  return new Date(Date.now() + secs * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function extractCoords(trip) {
  if (!trip) return {};
  return {
    originLat: trip.originLat  ?? trip.originLatitude  ?? null,
    originLng: trip.originLng  ?? trip.originLongitude ?? null,
    destLat:   trip.destLat    ?? trip.destinationLat  ?? trip.destLatitude   ?? null,
    destLng:   trip.destLng    ?? trip.destinationLng  ?? trip.destLongitude  ?? null,
  };
}

// Geocode a free-text address → { latitude, longitude } via Nominatim (OSM).
// Used as a fallback when a trip was dispatched with a typed address but no coordinates.
async function geocodeAddress(query) {
  if (!query || !query.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'FleetTrackPro/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function parseOsrmSteps(steps) {
  return steps.map((step, i) => ({
    id: i,
    instruction:      buildInstruction(step),
    distance:         step.distance,
    duration:         step.duration,
    maneuverType:     step.maneuver?.type     || 'turn',
    maneuverModifier: step.maneuver?.modifier || 'straight',
    streetName:       step.name || 'the road',
    startLocation: {
      latitude:  step.geometry.coordinates[0][1],
      longitude: step.geometry.coordinates[0][0],
    },
    coordinates: step.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
  }));
}

// ─── Distinct map pin ─────────────────────────────────────────────────────────
// A bold teardrop marker: a coloured circular head (with an icon or number) sitting
// on a matching pointer, plus an optional label chip above. Anchored at the bottom
// tip so the point marks the exact coordinate.
// NOTE: the pin head deliberately uses only plain Views/Text — NOT an icon font.
// Icon-font glyphs (e.g. Feather) don't reliably rasterise inside a react-native-maps
// custom marker on Android, which left the start/destination pins blank. A number (Text)
// or a solid white centre dot (View) always renders.
function Pin({ color, number, label }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {label ? (
        <View style={styles.pinLabel}>
          <Text style={styles.pinLabelText} numberOfLines={1}>{label}</Text>
        </View>
      ) : null}
      <View style={[styles.pinHead, { backgroundColor: color }]}>
        {number != null
          ? <Text style={styles.pinNumber}>{number}</Text>
          : <View style={styles.pinCenterDot} />}
      </View>
      <View style={[styles.pinPoint, { borderTopColor: color }]} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LiveMapScreen() {
  const router          = useRouter();
  const { id: tripId }  = useLocalSearchParams();
  const insets          = useSafeAreaInsets();
  const mapRef          = useRef(null);

  // ── Global nav state (survives leaving/returning to the map) ──
  const storeLocation   = useNavStore((s) => s.location);   // live GPS from shared tracker
  const setStoreCamera  = useNavStore((s) => s.setCamera);
  const getStoreCamera  = useNavStore((s) => s.getCamera);
  const clearStoreCamera = useNavStore((s) => s.clearCamera);
  // Snapshot whether a camera was already saved for this trip (decided once, on mount):
  // if so we restore that exact view instead of auto-zooming to the driver.
  const hasSavedCameraRef = useRef(null);
  if (hasSavedCameraRef.current === null) {
    hasSavedCameraRef.current = !!getStoreCamera(tripId);
  }

  // Mutable nav state — read by GPS callback to avoid stale closures.
  // following starts true so the map auto-zooms to and tracks the driver on open.
  const nav = useRef({
    following:       true,
    voice:           true,
    tilt:            true,
    directions:      [],
    stepIndex:       0,
    fullCoords:      [],
    completedCoords: [],
    trip:            null,
    within200m:      false,
    // Two-leg navigation state (read by GPS callback to avoid stale closures)
    phase:           PHASE.APPROACH,
    target:          null,   // { latitude, longitude } — end of the active leg
    originPt:        null,   // trip start coords
    destPt:          null,   // trip destination coords
    stopCoords:      [],     // ordered stop coords
    nearStart:       false,  // driver is within READY_RADIUS of the start
    camBearing:      0,      // smoothed follow-camera bearing (deg)
    camZoom:         NAV_ZOOM, // smoothed follow-camera zoom
  });

  const locSubRef           = useRef(null);
  const isReroutingRef      = useRef(false);
  const lastSpokenStep      = useRef(-1);
  const spokenThresholds    = useRef(new Set());
  const mapReadyRef         = useRef(false);
  const didAutoZoomRef      = useRef(false);
  const firstFixZoomedRef   = useRef(false);  // auto-zoom to driver once, on first GPS fix
  const approachFixRef      = useRef(false);  // approach route drawn from a real fix
  const lastPersistRef      = useRef(0);      // throttle nav-state persistence
  const lastFixTimeRef      = useRef(0);      // timestamp of last accepted fix (for speed)
  const speedSmoothRef      = useRef(0);      // low-pass smoothed speed (km/h)
  const pendingFitRef       = useRef(null);
  const zoomRef             = useRef(15);
  const updateCounterRef    = useRef(0);
  const etaTimerRef   = useRef(null);
  const positionRef   = useRef(null);
  // Tracks actual map center + zoom from onRegionChangeComplete so zoom buttons
  // always know the real current zoom (not a stale initial value).
  const mapCameraRef  = useRef({ latitude: 0, longitude: 0, zoom: 15 });

  // ── State ──
  const [trip,                 setTrip]              = useState(null);
  const [fullRouteCoords,      setFullRoute]          = useState([]);
  const [stopMarkers,          setStopMarkers]        = useState([]);
  const [completedRouteCoords, setCompleted]          = useState([]);
  const [directions,           setDirections]         = useState([]);
  const [currentStepIndex,     setStepIndex]          = useState(0);
  const [currentPosition,      setPosition]           = useState(null);
  const [currentHeading,       setHeading]            = useState(0);
  const [currentSpeed,         setSpeed]              = useState(0);
  const [distanceToNextTurn,   setDistNextTurn]       = useState(0);
  const [distanceToDest,       setDistDest]           = useState(0);
  const [routeDurationSecs,    setRouteDurationSecs]  = useState(null);
  const [isWithin200m,         setWithin200m]         = useState(false);
  const [isRerouting,          setIsRerouting]        = useState(false);
  const [isMarkingArrived,     setIsMarkingArrived]   = useState(false);
  const [phase,                setPhase]              = useState(PHASE.APPROACH);
  const [nearStart,            setNearStart]          = useState(false);
  const [isStarting,           setIsStarting]         = useState(false);
  // Vehicle marker rasterisation: on briefly so Android captures a crisp icon, then off
  const [vehicleTracking,      setVehicleTracking]    = useState(true);
  const vehicleReadyRef = useRef(false);
  // Same for the start/stop/destination pins — track changes briefly so Android
  // rasterises the pin (icon + label) properly, then freeze for performance.
  const [trackMarkers,         setTrackMarkers]       = useState(true);
  const markersFrozenRef = useRef(false);
  const [isFollowingVehicle,   setFollowing]          = useState(true);
  const [panelExpanded,        setPanelExpanded]      = useState(false);
  const [voiceEnabled,         setVoice]              = useState(true);
  const [permissionDenied,     setPermDenied]         = useState(false);
  const [errorToast,           setErrorToast]         = useState('');
  const [mapMounted,           setMapMounted]         = useState(false);
  // tracksViewChanges is always true for the vehicle marker — toggling it causes
  // react-native-maps to drop the Reanimated view in the native layer, making the
  // marker vanish or snap to stale coordinates.
  const [tiltEnabled,          setTiltEnabled]        = useState(true);
  const [isLoading,            setIsLoading]          = useState(true);

  // Keep nav ref in sync with state
  useEffect(() => { nav.current.following = isFollowingVehicle; }, [isFollowingVehicle]);
  useEffect(() => { nav.current.voice     = voiceEnabled; },      [voiceEnabled]);
  useEffect(() => { nav.current.tilt      = tiltEnabled; },       [tiltEnabled]);
  useEffect(() => { nav.current.phase     = phase; },             [phase]);

  // ── Reanimated shared values ──
  const markerHeading    = useSharedValue(0);
  const panelH           = useSharedValue(180 + insets.bottom);
  const reroutingOpacity = useSharedValue(0);
  const arrivedPulse     = useSharedValue(1);
  const cardEntrance     = useSharedValue(0);
  const toastOpacity     = useSharedValue(0);
  const statsOpacity     = useSharedValue(1);
  const backBtnScale     = useSharedValue(1);

  // ── Animated styles ──
  const arrivedBtnStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: arrivedPulse.value }],
  }));
  const panelStyle       = useAnimatedStyle(() => ({
    height: panelH.value, overflow: 'hidden',
  }));
  const reroutingStyle   = useAnimatedStyle(() => ({
    opacity: reroutingOpacity.value,
  }));
  const cardStyle        = useAnimatedStyle(() => ({
    opacity:   cardEntrance.value,
    transform: [{ translateY: interpolate(cardEntrance.value, [0, 1], [-20, 0]) }],
  }));
  const toastStyle       = useAnimatedStyle(() => ({
    opacity:   toastOpacity.value,
    transform: [{ translateY: interpolate(toastOpacity.value, [0, 1], [-8, 0]) }],
  }));
  const statsAnimStyle   = useAnimatedStyle(() => ({ opacity: statsOpacity.value }));
  const backBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backBtnScale.value }],
  }));

  // ── Mount animations ──
  useEffect(() => {
    cardEntrance.value = withTiming(1, {
      duration: 350, easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, []);

  // Lazy MapView — defer mount by one frame so the JS thread isn't blocked on initial render
  useEffect(() => {
    const t = setTimeout(() => setMapMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Once the vehicle marker first has a position, keep it rasterising just long enough
  // for the truck glyph to render, then stop so the icon stays crisp (Android fix).
  useEffect(() => {
    if (currentPosition && !vehicleReadyRef.current) {
      vehicleReadyRef.current = true;
      const t = setTimeout(() => setVehicleTracking(false), 1000);
      return () => clearTimeout(t);
    }
  }, [currentPosition]);

  // Once the start/destination/stop pins have coordinates, keep them rasterising for a
  // moment so Android captures the fully-rendered pin (icon + label), then freeze.
  useEffect(() => {
    const c = extractCoords(trip);
    const hasPins = c.originLat != null || c.destLat != null || stopMarkers.length > 0;
    if (hasPins && !markersFrozenRef.current) {
      markersFrozenRef.current = true;
      const t = setTimeout(() => setTrackMarkers(false), 1500);
      return () => clearTimeout(t);
    }
  }, [trip, stopMarkers]);

  // On load we intentionally show the whole route (origin → destination) so the driver
  // can see the full trip. Zooming in to the driver is a deliberate action via the
  // recenter/crosshair button, not automatic — otherwise it hides the route on open.

  // ── Persist navigation state so the trip resumes where the driver left off ──
  // Saves the phase + last position (keyed by trip). Restored on the load effect below;
  // updated on phase changes and (throttled) as the driver moves.
  const NAV_KEY = `ft_nav_${tripId}`;
  const persistNav = useCallback(() => {
    const pos = positionRef.current;
    SecureStore.setItemAsync(NAV_KEY, JSON.stringify({
      phase: nav.current.phase,
      lat: pos?.latitude ?? null,
      lng: pos?.longitude ?? null,
      updatedAt: Date.now(),
    })).catch(() => {});
  }, [NAV_KEY]);

  // Save on phase transitions (Ready / Start), once past initial load
  useEffect(() => {
    if (!isLoading) persistNav();
  }, [phase, isLoading, persistNav]);

  // ── Arrived pulse ──
  useEffect(() => {
    if (isWithin200m) {
      arrivedPulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 900 }),
          withTiming(1,    { duration: 900 }),
        ), -1, true,
      );
    } else {
      arrivedPulse.value = withTiming(1);
    }
  }, [isWithin200m]);

  // ── Android hardware back button ──
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        locSubRef.current?.remove?.();
        Speech.stop();
        clearInterval(etaTimerRef.current);
        router.back();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router]),
  );

  // ── Error toast helper ──
  const showToast = useCallback((msg) => {
    setErrorToast(msg);
    toastOpacity.value = withTiming(1, { duration: 200 });
    setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 300 });
      setTimeout(() => setErrorToast(''), 300);
    }, 3000);
  }, []);

  // ── Back button handler ──
  const handleBack = useCallback(() => {
    locSubRef.current?.remove?.();
    Speech.stop();
    clearInterval(etaTimerRef.current);
    router.back();
  }, [router]);

  // ── Voice instruction ──
  const speakInstruction = useCallback((stepIdx, dirs, distNext) => {
    if (!nav.current.voice) return;
    if (stepIdx === lastSpokenStep.current) return;
    lastSpokenStep.current = stepIdx;
    spokenThresholds.current.clear();
    const nextStep = dirs[stepIdx + 1];
    const curStep  = dirs[stepIdx];
    const text = nextStep
      ? `In ${formatDistance(distNext)}, ${nextStep.instruction}`
      : curStep?.maneuverType === 'arrive'
      ? 'You have arrived'
      : '';
    if (text) { Speech.stop(); Speech.speak(text, { language: 'en-GB', rate: 0.95 }); }
  }, []);

  const checkVoiceThresholds = useCallback((dist, stepIdx, dirs) => {
    if (!nav.current.voice) return;
    const next = dirs[stepIdx + 1];
    if (!next) return;
    const speak = (key, text) => {
      if (spokenThresholds.current.has(key)) return;
      spokenThresholds.current.add(key);
      Speech.stop();
      Speech.speak(text, { language: 'en-GB', rate: 0.95 });
    };
    if (dist <= 500 && dist > 450) speak(`${stepIdx}_500`, `In 500 metres, ${next.instruction}`);
    if (dist <= 200 && dist > 150) speak(`${stepIdx}_200`, `In 200 metres, ${next.instruction}`);
    if (dist <= 50)                speak(`${stepIdx}_50`,  next.instruction);
  }, []);

  // ── Fetch OSRM fastest route + duration through an ordered list of waypoints ──
  // waypoints: [{ latitude, longitude }, ...] in order (origin → stops → destination).
  // Requests alternatives and picks the route with the LOWEST duration so the driver
  // always gets the fastest path. Steps are flattened across all legs.
  const fetchOsrm = useCallback(async (waypoints) => {
    try {
      if (!Array.isArray(waypoints) || waypoints.length < 2) {
        return { steps: [], overviewCoords: [], duration: null };
      }
      const coordStr = waypoints.map((w) => `${w.longitude},${w.latitude}`).join(';');
      // alternatives=3 → OSRM returns up to 3 candidate routes (for 2-point legs);
      // we then select the fastest by duration. Multi-waypoint routes return one route.
      const url = `${OSRM_BASE}/route/v1/driving/${coordStr}?alternatives=3&steps=true&geometries=geojson&overview=full`;
      // Cap the request so a slow/unreachable OSRM can't make the route hang — the
      // caller falls back to a straight line if this times out.
      const res = await Promise.race([
        fetch(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('osrm-timeout')), 7000)),
      ]);
      if (!res.ok) return { steps: [], overviewCoords: [], duration: null };
      const data = await res.json();
      const routes = data?.routes ?? [];
      if (routes.length === 0) return { steps: [], overviewCoords: [], duration: null };

      // Pick the fastest route (minimum travel time)
      const best = routes.reduce((a, b) => (b.duration < a.duration ? b : a), routes[0]);
      const rawSteps = (best.legs ?? []).flatMap((leg) => leg.steps ?? []);
      const overview = best.geometry?.coordinates ?? [];
      return {
        steps: parseOsrmSteps(rawSteps),
        overviewCoords: overview.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
        duration: best.duration ?? null,
      };
    } catch {
      return { steps: [], overviewCoords: [], duration: null };
    }
  }, []);

  // ── Lightweight ETA refresh (every 30 s) ──
  const fetchEtaRefresh = useCallback(async () => {
    const pos    = positionRef.current;
    const target = nav.current.target;
    if (!pos || !target) return;
    try {
      const url = `${OSRM_BASE}/route/v1/driving/${pos.longitude},${pos.latitude};${target.longitude},${target.latitude}?alternatives=3&overview=false`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const routes = data?.routes ?? [];
      // Fastest of the returned routes
      const secs = routes.length ? Math.min(...routes.map((r) => r.duration)) : null;
      if (secs != null) {
        setRouteDurationSecs(Math.round(secs));
        statsOpacity.value = withSequence(
          withTiming(0.3, { duration: 100 }),
          withTiming(1,   { duration: 200 }),
        );
      }
    } catch {}
  }, []);

  // ── Map fit helpers ──
  const fitToRoute = useCallback((coords) => {
    if (!coords || coords.length < 2) return;
    if (mapReadyRef.current && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 140, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
    } else {
      pendingFitRef.current = coords;
    }
  }, []);

  // ── Camera helper: focus on the driver at street-level nav zoom ──
  // Reads the live camera so we can set BOTH zoom (Google) and altitude (Apple),
  // making the zoom actually take effect on iOS as well as Android.
  const focusOnDriver = useCallback(async (pos, duration) => {
    const map = mapRef.current;
    if (!map || !pos) return;
    let cam;
    try { cam = await map.getCamera(); } catch { cam = {}; }
    cam.center  = pos;
    cam.heading = currentHeading;
    cam.pitch   = nav.current.tilt ? 45 : 0;
    cam.zoom    = NAV_ZOOM;         // Google Maps (Android)
    cam.altitude = NAV_ALTITUDE;    // Apple Maps (iOS)
    zoomRef.current           = NAV_ZOOM;
    mapCameraRef.current.zoom = NAV_ZOOM;
    map.animateCamera(cam, { duration });
  }, [currentHeading]);

  // ── Gentle two-phase zoom-in used by the auto-zoom on map open ──
  // Phase 1 (450 ms): ease over to the driver at a wide zoom.
  // Phase 2 (1100 ms): smoothly zoom the rest of the way in to NAV_ZOOM.
  // The result is a continuous, gentle "zooming in" rather than a single jump.
  const smoothZoomToDriver = useCallback(async (pos, onDone) => {
    const map = mapRef.current;
    if (!map || !pos) return;
    const heading = currentHeading;
    const pitch   = nav.current.tilt ? 45 : 0;
    let cam;
    try { cam = await map.getCamera(); } catch { cam = {}; }

    // Phase 1 — glide to the driver at a wide, zoomed-out view
    map.animateCamera(
      { ...cam, center: pos, heading, pitch, zoom: 15, altitude: NAV_ALTITUDE * 6 },
      { duration: 450 },
    );

    // Phase 2 — gently zoom in to street level
    setTimeout(() => {
      zoomRef.current           = NAV_ZOOM;
      mapCameraRef.current.zoom = NAV_ZOOM;
      map.animateCamera(
        { center: pos, heading, pitch, zoom: NAV_ZOOM, altitude: NAV_ALTITUDE },
        { duration: 1100 },
      );
      // Hand back to the follow camera / turn-by-turn once the zoom-in finishes
      setTimeout(() => onDone?.(), 1100);
    }, 450);
  }, [currentHeading]);

  // ── Auto-zoom onto the driver once the map + GPS are ready (fires once per open) ──
  // Follow is paused during the gentle zoom so GPS ticks can't interrupt it, then
  // re-enabled so turn-by-turn resumes. Does not touch gestures or any map controls.
  const maybeAutoZoom = useCallback(() => {
    if (didAutoZoomRef.current) return;
    if (!mapReadyRef.current || !mapRef.current) return;
    const pos = positionRef.current;
    if (!pos) return;                 // wait for the first GPS fix (see error toast below)
    didAutoZoomRef.current = true;    // set before await so the two triggers can't double-fire
    nav.current.following = false;    // pause follow for the duration of the gentle zoom
    setFollowing(false);
    smoothZoomToDriver(pos, () => {
      nav.current.following = true;   // resume turn-by-turn follow after the zoom-in
      setFollowing(true);
    });
  }, [smoothZoomToDriver]);

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true;

    // A saved camera only exists if the driver left in Free Explore mode — restore that
    // EXACT view (no reset/flicker) and STAY in Explore (recenter button shown). Follow
    // Mode is not resumed automatically here; the driver taps Recenter to resume it.
    const savedCam = getStoreCamera(tripId);
    if (savedCam && mapRef.current) {
      nav.current.following = false;
      setFollowing(false);
      mapRef.current.setCamera({
        center: { latitude: savedCam.latitude, longitude: savedCam.longitude },
        zoom:     savedCam.zoom,
        heading:  savedCam.heading,
        pitch:    savedCam.pitch,
        altitude: savedCam.altitude,
      });
      pendingFitRef.current = null;
      return;
    }

    if (pendingFitRef.current && mapRef.current) {
      mapRef.current.fitToCoordinates(pendingFitRef.current, {
        edgePadding: { top: 140, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
      pendingFitRef.current = null;
    }
  }, [getStoreCamera, tripId]);

  // ── Load a navigation leg ──
  // Fetches the OSRM route through `waypoints`, resets progress/turn tracking, draws
  // the line and fits it, and sets the active target (leg end). Falls back to a direct
  // line if OSRM is unreachable. Used for both Leg 1 (driver→start) and Leg 2 (trip).
  const loadLeg = useCallback(async (waypoints, targetPt) => {
    nav.current.target = targetPt;
    // Reset progress + turn tracking for the new leg
    nav.current.completedCoords = [];
    nav.current.stepIndex       = 0;
    lastSpokenStep.current      = -1;
    spokenThresholds.current.clear();
    setCompleted([]);
    setStepIndex(0);

    // Only auto-fit the camera to the route when we're NOT restoring a saved view —
    // otherwise fitting would override the exact camera the driver left.
    const mayMoveCamera = !hasSavedCameraRef.current;

    // 1) Draw a straight line IMMEDIATELY so the route appears with no delay…
    if (waypoints.length >= 2) {
      nav.current.fullCoords = waypoints;
      setFullRoute(waypoints);
      if (mayMoveCamera) fitToRoute(waypoints);
    }

    // 2) …then upgrade to the road-following OSRM route when it arrives (7s timeout).
    const { steps, overviewCoords, duration } = await fetchOsrm(waypoints);
    if (overviewCoords.length >= 2) {
      nav.current.fullCoords = overviewCoords;
      nav.current.directions = steps;
      setFullRoute(overviewCoords);
      setDirections(steps);
      if (duration != null) setRouteDurationSecs(Math.round(duration));
      if (mayMoveCamera) fitToRoute(overviewCoords);
    }
    // If OSRM was unreachable the straight line from step 1 stays visible.
  }, [fetchOsrm, fitToRoute]);

  // ── On the first real GPS fix: auto-zoom to the driver AND (if approaching) draw the
  //    driver→start route. Handles the case where the map loaded before GPS locked on. ──
  useEffect(() => {
    if (!currentPosition) return;

    // Auto-zoom in to the driver once, ONLY when there's no saved camera to restore.
    // If the driver had left a camera position, we keep that view instead.
    if (!firstFixZoomedRef.current && mapReadyRef.current && !hasSavedCameraRef.current) {
      firstFixZoomedRef.current = true;
      focusOnDriver(currentPosition, 1000);
    }

    // Draw the approach route from the driver's real position to the trip start (once)
    if (nav.current.phase === PHASE.APPROACH && nav.current.originPt && !approachFixRef.current) {
      approachFixRef.current = true;
      loadLeg([currentPosition, nav.current.originPt], nav.current.originPt);
    }
  }, [currentPosition, focusOnDriver, loadLeg]);

  // ── Rerouting ──
  const triggerReroute = useCallback(async (lat, lng) => {
    if (isReroutingRef.current) return;
    isReroutingRef.current = true;
    setIsRerouting(true);
    reroutingOpacity.value = withTiming(1, { duration: 200 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (nav.current.voice) Speech.speak('Rerouting', { language: 'en' });

    try {
      // Reroute from the driver's current position to the active leg's target
      // (the trip start during APPROACH, the destination during TRIP).
      const target = nav.current.target;
      if (!target) return;
      const { steps, overviewCoords, duration } = await fetchOsrm([
        { latitude: lat, longitude: lng },
        { latitude: target.latitude, longitude: target.longitude },
      ]);
      if (steps.length) {
        const newCoords = overviewCoords.length ? overviewCoords : steps.flatMap(s => s.coordinates);
        nav.current.directions      = steps;
        nav.current.fullCoords      = newCoords;
        nav.current.completedCoords = [];
        nav.current.stepIndex       = 0;
        lastSpokenStep.current      = -1;
        spokenThresholds.current.clear();
        setDirections(steps);
        setFullRoute(newCoords);
        setCompleted([]);
        setStepIndex(0);
        if (duration != null) setRouteDurationSecs(Math.round(duration));
      }
    } catch {}
    finally {
      reroutingOpacity.value = withTiming(0, { duration: 300 });
      setIsRerouting(false);
      isReroutingRef.current = false;
    }
  }, [fetchOsrm]);

  // ── GPS position handler — processes a location fed from the shared tracker/store.
  //    NOTE: this updates the driver marker + nav logic ONLY. It never moves the map
  //    camera (the camera is fully independent — it only moves on recenter). ──
  const onPositionUpdate = useCallback((coords) => {
    const { latitude, longitude, speed, heading, accuracy, timestamp } = coords;
    const acc  = accuracy ?? 0;
    const prev = positionRef.current;
    const now  = timestamp || Date.now();

    // ── Location stabilisation (fixes Android GPS jitter/drift when parked) ──
    // 1) Drop very inaccurate fixes that would make the marker jump around.
    if (prev && acc > 50) return;
    // 2) Deadband: GPS keeps reporting tiny position changes even when the vehicle
    //    is stationary. If the reported move is below the noise radius, treat the
    //    driver as not moving — keep the marker/camera still and show 0 km/h.
    let movedMeters = 0;
    if (prev) {
      movedMeters    = haversineMetres(prev.latitude, prev.longitude, latitude, longitude);
      const deadband = Math.min(20, Math.max(8, acc * 0.5));
      if (movedMeters < deadband) {
        // Stationary jitter — show 0. Do NOT advance lastFixTimeRef here: it must stay
        // paired with positionRef (both only move on accepted fixes) so the distance÷time
        // speed below always covers the same interval and isn't wildly inflated.
        speedSmoothRef.current = 0;
        setSpeed(0); // React bails out if already 0 — no needless re-render
        return;
      }
    }

    // ── Accurate speed (Android fix) ──
    // Prefer the GPS Doppler speed when it's a valid moving value. Android frequently
    // omits it (0/null/-1), which used to pin the readout to 0 while driving — so fall
    // back to distance ÷ time between accepted fixes. Clamp to a sane range and lightly
    // low-pass smooth so the needle is steady, not jumpy.
    let speedMs = (speed != null && speed > 0.3) ? speed : null;
    if (speedMs == null && prev && lastFixTimeRef.current) {
      const dt = (now - lastFixTimeRef.current) / 1000;      // seconds since last fix
      if (dt >= 0.4) speedMs = movedMeters / dt;             // derive from motion
    }
    speedMs = Math.max(0, speedMs || 0);
    let speedKmh = Math.min(200, speedMs * 3.6);
    speedKmh = speedSmoothRef.current * 0.4 + speedKmh * 0.6; // light smoothing
    speedSmoothRef.current = speedKmh;
    lastFixTimeRef.current = now;

    const dirs       = nav.current.directions;
    const fullCoords = nav.current.fullCoords;

    // Store latest position for ETA refresh and as fallback center for zoom buttons
    positionRef.current = { latitude, longitude };

    // Persist nav state as the driver moves (throttled to every 5s) so leaving/returning
    // resumes at the current location.
    if (now - lastPersistRef.current > 5000) {
      lastPersistRef.current = now;
      SecureStore.setItemAsync(`ft_nav_${tripId}`, JSON.stringify({
        phase: nav.current.phase, lat: latitude, lng: longitude, updatedAt: now,
      })).catch(() => {});
    }

    // Marker + readouts
    markerHeading.value = withTiming(heading || 0, { duration: 500 });
    setPosition({ latitude, longitude });
    setHeading(heading || 0);
    setSpeed(speedKmh);

    // ── Follow-Mode camera (Uber/Waze-style) ──
    // Only in Follow Mode. Uses a route look-ahead point (not just noisy GPS heading)
    // for the bearing, low-pass smooths rotation, ignores small jitter, holds bearing
    // when slow/stationary (no spinning), and adapts zoom/look-ahead to speed. The
    // deadband above already skips this entirely when the vehicle isn't really moving.
    if (nav.current.following && mapRef.current) {
      const aheadM      = Math.min(200, Math.max(30, speedMs * 7));           // 30m→200m
      const targetZoom  = speedKmh > 60 ? 16.5 : speedKmh > 30 ? 17.3 : NAV_ZOOM;

      // Desired bearing: route look-ahead is primary (stable); GPS heading nudges it.
      let desired = nav.current.camBearing;
      if (speedKmh >= 4) {
        const la = routeLookAheadPoint(nav.current.fullCoords, latitude, longitude, aheadM);
        const routeBearing = la
          ? bearingBetween(latitude, longitude, la.latitude, la.longitude)
          : (heading ?? nav.current.camBearing);
        desired = (heading != null) ? angleLerp(routeBearing, heading, 0.3) : routeBearing;
      }
      // Low-pass toward the desired bearing; ignore sub-3° jitter for stability
      if (Math.abs(angleDiff(nav.current.camBearing, desired)) > 3) {
        nav.current.camBearing = angleLerp(nav.current.camBearing, desired, 0.22);
      }
      // Smooth the zoom so speed changes don't jump
      nav.current.camZoom += (targetZoom - nav.current.camZoom) * 0.15;
      mapCameraRef.current.zoom = Math.round(nav.current.camZoom);

      mapRef.current.animateCamera({
        center:   { latitude, longitude },
        heading:  nav.current.camBearing,
        pitch:    nav.current.tilt ? 50 : 0,
        zoom:     nav.current.camZoom,
        altitude: NAV_ALTITUDE,
      }, { duration: 900 });
    }

    // GPS ping — fire and forget
    api.post(`/gps/trips/${tripId}/ping`, {
      lat:        latitude,
      lng:        longitude,
      speedKmh:   Math.round(speedKmh),
      heading:    Math.round(heading || 0),
      accuracyM:  Math.round(accuracy || 0),
      recordedAt: new Date(timestamp || Date.now()).toISOString(),
    }).catch(() => {});

    // ── Step detection ──
    if (dirs.length > 0) {
      let minDist = Infinity, bestIdx = 0;
      dirs.forEach((dir, i) => {
        const d = haversineMetres(latitude, longitude, dir.startLocation.latitude, dir.startLocation.longitude);
        if (d < minDist) { minDist = d; bestIdx = i; }
      });
      const prevIdx = nav.current.stepIndex;
      const newIdx  = Math.max(prevIdx, bestIdx);
      if (newIdx > prevIdx) {
        nav.current.stepIndex = newIdx;
        setStepIndex(newIdx);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const nextStep = dirs[newIdx + 1];
        if (nextStep) {
          const dist = haversineMetres(latitude, longitude, nextStep.startLocation.latitude, nextStep.startLocation.longitude);
          speakInstruction(newIdx, dirs, dist);
        }
      }

      const nextStep = dirs[newIdx + 1];
      if (nextStep?.startLocation) {
        const d = haversineMetres(latitude, longitude, nextStep.startLocation.latitude, nextStep.startLocation.longitude);
        setDistNextTurn(d);
        checkVoiceThresholds(d, newIdx, dirs);
      }
    }

    // ── Distance to the active target + phase transitions (debounced every 3 ticks) ──
    const target = nav.current.target;
    if (target) {
      const dist = haversineMetres(latitude, longitude, target.latitude, target.longitude);
      updateCounterRef.current += 1;
      if (updateCounterRef.current % 3 === 0) {
        setDistDest(dist);
      }
      if (nav.current.phase === PHASE.APPROACH) {
        // Leg 1: reached the start point → reveal the "Ready" button
        if (dist < READY_RADIUS && !nav.current.nearStart) {
          nav.current.nearStart = true;
          setNearStart(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (nav.current.voice) Speech.speak('You have reached the trip start', { language: 'en-GB' });
        }
      } else if (nav.current.phase === PHASE.TRIP) {
        // Leg 2: reached the destination → reveal "Mark arrived"
        if (dist < ARRIVE_RADIUS && !nav.current.within200m) {
          nav.current.within200m = true;
          setWithin200m(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }

    // ── Completed route (gray out driven segment) ──
    if (fullCoords.length > 0) {
      let closestIdx = 0, minD = Infinity;
      fullCoords.forEach((pt, i) => {
        const d = haversineMetres(latitude, longitude, pt.latitude, pt.longitude);
        if (d < minD) { minD = d; closestIdx = i; }
      });
      const completed = fullCoords.slice(0, closestIdx + 1);
      nav.current.completedCoords = completed;
      setCompleted(completed);

      // ── Off-route check ──
      if (speedKmh > 5 && !isReroutingRef.current) {
        const remaining = fullCoords.slice(closestIdx);
        let minOff = Infinity;
        remaining.forEach(pt => {
          const d = haversineMetres(latitude, longitude, pt.latitude, pt.longitude);
          if (d < minOff) minOff = d;
        });
        if (minOff > REROUTE_DIST) triggerReroute(latitude, longitude);
      }
    }
  }, [tripId, speakInstruction, checkVoiceThresholds, triggerReroute]);

  // Drive the nav logic from the shared location store (single source of truth). The
  // marker + turn/arrival logic update as GPS flows in; the camera is untouched here.
  useEffect(() => {
    if (storeLocation) onPositionUpdate(storeLocation);
  }, [storeLocation, onPositionUpdate]);

  // ── Load trip + start ETA timer ──
  useEffect(() => {
    // The live GPS watch is owned by the shared tracker in the driver layout (so it keeps
    // running across screens). Here we only start the periodic ETA refresh.
    const startTracking = async () => {
      etaTimerRef.current = setInterval(fetchEtaRefresh, 30000);
    };

    (async () => {
      // ── FAST PATH: hydrate from the in-memory cache for an instant re-open ──
      const cached = routeCache.get(tripId);
      if (cached) {
        nav.current.trip            = cached.trip;
        nav.current.fullCoords      = cached.fullCoords || [];
        nav.current.stopCoords      = cached.stopCoords || [];
        nav.current.directions      = cached.directions || [];
        nav.current.completedCoords = cached.completedCoords || [];
        nav.current.stepIndex       = cached.stepIndex || 0;
        nav.current.originPt        = cached.originPt || null;
        nav.current.destPt          = cached.destPt || null;
        nav.current.target          = cached.target || null;
        nav.current.phase           = cached.phase || PHASE.APPROACH;
        nav.current.nearStart       = !!cached.nearStart;
        nav.current.within200m      = !!cached.within200m;
        if (cached.position) positionRef.current = cached.position;

        setTrip(cached.trip);
        setFullRoute(cached.fullCoords || []);
        setStopMarkers(cached.stopCoords || []);
        setDirections(cached.directions || []);
        setCompleted(cached.completedCoords || []);
        setStepIndex(cached.stepIndex || 0);
        setPhase(cached.phase || PHASE.APPROACH);
        setNearStart(!!cached.nearStart);
        setWithin200m(!!cached.within200m);
        if (cached.position) setPosition(cached.position);
        approachFixRef.current = true;     // route already present — don't redraw
        firstFixZoomedRef.current = false; // allow a fresh zoom to the current position
        setIsLoading(false);               // no loading pill on re-entry

        // Ensure permission is still granted, then resume live tracking
        const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
        if (perm && perm.status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync().catch(() => null);
          if (!req || req.status !== 'granted') { setPermDenied(true); return; }
        }
        await startTracking();
        return;
      }

      // ── FULL PATH (first open of this trip) ──
      const [permResult, tripResult] = await Promise.allSettled([
        Location.requestForegroundPermissionsAsync(),
        api.get(`/trips/${tripId}`),
      ]);

      if (permResult.status === 'rejected' || permResult.value?.status !== 'granted') {
        setPermDenied(true);
        return;
      }

      if (tripResult.status === 'rejected') {
        showToast('Could not load trip data. Please go back and try again.');
        setIsLoading(false);
        return;
      }
      const tripData = tripResult.value.data;

      // ── Restore saved nav state (resume where the driver left off) ──
      let saved = null;
      try {
        const raw = await SecureStore.getItemAsync(NAV_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch { /* ignore */ }
      // Show the last-known position instantly so the marker appears before a fresh fix
      if (saved?.lat != null && saved?.lng != null) {
        const restored = { latitude: saved.lat, longitude: saved.lng };
        positionRef.current = restored;
        setPosition(restored);
      }

      // ── Start the GPS fix immediately, in parallel with geocoding/route work ──
      // (last-known first for an instant fix, then a fresh one capped at 8s.)
      const positionPromise = (async () => {
        let pos = null;
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last?.coords) pos = { latitude: last.coords.latitude, longitude: last.coords.longitude };
        } catch { /* ignore */ }
        try {
          // Balanced accuracy locks on much faster than High (network/wifi assisted);
          // the live watch upgrades to precise GPS right after. Capped at 6s.
          const fresh = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('gps-timeout')), 6000)),
          ]);
          pos = {
            latitude:  fresh.coords.latitude,
            longitude: fresh.coords.longitude,
            heading:   fresh.coords.heading,
            speed:     fresh.coords.speed,
          };
        } catch { /* keep last-known */ }
        return pos;
      })();

      // ── Resolve start/destination/stop coordinates — geocode ALL missing ones
      //    CONCURRENTLY (was one-at-a-time; this is the main load-time win) ──
      let { originLat, originLng, destLat, destLng } = extractCoords(tripData);
      const rawStops = Array.isArray(tripData.stops) ? tripData.stops : [];

      const [originGeo, destGeo, stopGeos] = await Promise.all([
        (originLat == null && tripData.origin)      ? geocodeAddress(tripData.origin)      : Promise.resolve(null),
        (destLat   == null && tripData.destination) ? geocodeAddress(tripData.destination) : Promise.resolve(null),
        Promise.all(rawStops.map((s) => {
          const lat = s.lat ?? s.latitude ?? null;
          const lng = s.lng ?? s.longitude ?? null;
          if (lat != null && lng != null) return Promise.resolve({ latitude: Number(lat), longitude: Number(lng) });
          if (s.name) return geocodeAddress(s.name);
          return Promise.resolve(null);
        })),
      ]);
      if (originGeo) { originLat = originGeo.latitude; originLng = originGeo.longitude; }
      if (destGeo)   { destLat   = destGeo.latitude;   destLng   = destGeo.longitude; }
      const stopCoords = stopGeos.filter(Boolean);

      // Patch trip + endpoints, stash for reroutes
      tripData.originLat = originLat; tripData.originLng = originLng;
      tripData.destLat   = destLat;   tripData.destLng   = destLng;
      const originPt = originLat != null ? { latitude: originLat, longitude: originLng } : null;
      const destPt   = destLat   != null ? { latitude: destLat,   longitude: destLng }   : null;
      nav.current.trip       = tripData;
      nav.current.stopCoords = stopCoords;
      nav.current.originPt   = originPt;
      nav.current.destPt     = destPt;
      setTrip({ ...tripData });
      setStopMarkers(stopCoords);

      // Map + markers are ready — clear the loading pill NOW. GPS + route stream in next.
      setIsLoading(false);

      // ── Await the GPS fix (already in flight) ──
      const driverPos = await positionPromise;
      if (driverPos) {
        positionRef.current = { latitude: driverPos.latitude, longitude: driverPos.longitude };
        setPosition({ latitude: driverPos.latitude, longitude: driverPos.longitude });
        if (driverPos.heading != null) setHeading(driverPos.heading || 0);
        if (driverPos.speed   != null) setSpeed(Math.max(0, (driverPos.speed || 0) * 3.6));
      } else {
        const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
        showToast(servicesOn
          ? 'Waiting for GPS signal… move to an open area and it will lock on.'
          : 'Location is off. Turn on Location/GPS in your phone settings, then reopen.');
      }

      // ── Choose the starting leg + draw the route ──
      const status        = (tripData.status || '').toUpperCase();
      const alreadyStarted = status === 'STARTED' || status === 'EN_ROUTE';
      // Backend status wins for STARTED; otherwise resume the saved local phase (e.g. the
      // driver had tapped "Ready" and was at the start reviewing the trip route).
      const resumeAtStart = !alreadyStarted && saved?.phase === PHASE.AT_START && originPt && destPt;

      if (alreadyStarted || !originPt) {
        nav.current.phase = PHASE.TRIP;
        setPhase(PHASE.TRIP);
        nav.current.following = true;
        setFollowing(true);
        const wp = [originPt, ...stopCoords, destPt].filter(Boolean);
        if (wp.length >= 2) await loadLeg(wp, destPt);
        else showToast('Could not determine the trip start or destination location.');
      } else if (resumeAtStart) {
        // Resume the "at start" state: show the trip route + the Start button
        nav.current.phase = PHASE.AT_START;
        setPhase(PHASE.AT_START);
        const wp = [originPt, ...stopCoords, destPt].filter(Boolean);
        if (wp.length >= 2) await loadLeg(wp, destPt);
      } else if (driverPos && originPt) {
        nav.current.phase = PHASE.APPROACH;
        setPhase(PHASE.APPROACH);
        approachFixRef.current = true; // drawn from a real fix — don't redraw in the GPS effect
        await loadLeg([{ latitude: driverPos.latitude, longitude: driverPos.longitude }, originPt], originPt);
      } else if (originPt && destPt) {
        nav.current.phase = PHASE.APPROACH;
        setPhase(PHASE.APPROACH);
        nav.current.target = originPt;
        await loadLeg([originPt, ...stopCoords, destPt], originPt);
      } else {
        showToast('Could not determine the trip start or destination location.');
      }

      // Start live GPS watch + ETA timer
      await startTracking();
    })();

    return () => {
      // Snapshot the current nav state so re-opening the map is instant (no reload)
      routeCache.set(tripId, {
        trip:            nav.current.trip,
        fullCoords:      nav.current.fullCoords,
        stopCoords:      nav.current.stopCoords,
        directions:      nav.current.directions,
        completedCoords: nav.current.completedCoords,
        stepIndex:       nav.current.stepIndex,
        originPt:        nav.current.originPt,
        destPt:          nav.current.destPt,
        target:          nav.current.target,
        phase:           nav.current.phase,
        nearStart:       nav.current.nearStart,
        within200m:      nav.current.within200m,
        position:        positionRef.current,
      });
      locSubRef.current?.remove?.();
      Speech.stop();
      clearInterval(etaTimerRef.current);
    };
  }, [tripId]);

  // ── Mark arrived ──
  const handleMarkArrived = useCallback(async () => {
    if (isMarkingArrived) return;
    setIsMarkingArrived(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (nav.current.voice) Speech.speak('You have arrived', { language: 'en-GB' });
    Speech.stop();

    const finish = () => {
      locSubRef.current?.remove?.();
      clearInterval(etaTimerRef.current);
      routeCache.delete(tripId);                                       // trip done — drop cache
      clearStoreCamera(tripId);                                        // and the saved camera
      SecureStore.deleteItemAsync(`ft_nav_${tripId}`).catch(() => {}); // and saved state
      router.replace(`/(driver)/trip/${tripId}_2`);
    };

    try {
      await api.put(`/trips/${tripId}/arrive`);
      finish();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || '';
      // The backend rejects arrival unless the trip is STARTED/EN_ROUTE. If the Start
      // step never landed, start it now and retry arrival once.
      const notStarted = err?.response?.status === 400 || /STARTED|EN_ROUTE|must be/i.test(msg);
      if (notStarted) {
        try {
          await api.put(`/trips/${tripId}/start`);
          await api.put(`/trips/${tripId}/arrive`);
          finish();
          return;
        } catch (err2) {
          const m2 = err2?.response?.data?.error || err2?.response?.data?.message;
          setIsMarkingArrived(false);
          showToast(m2 || 'Could not confirm arrival. Please try again.');
          return;
        }
      }
      setIsMarkingArrived(false);
      showToast(msg || 'Could not confirm arrival. Please try again.');
    }
  }, [tripId, isMarkingArrived, showToast, clearStoreCamera, router]);

  // ── Ready: reached the start → load the actual trip route (origin → stops → dest) ──
  const handleReady = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    nav.current.phase = PHASE.AT_START;
    setPhase(PHASE.AT_START);
    nav.current.nearStart = false;
    setNearStart(false);
    // Show the trip route as an overview so the driver can review it before starting
    nav.current.following = false;
    setFollowing(false);
    const wp = [nav.current.originPt, ...(nav.current.stopCoords ?? []), nav.current.destPt].filter(Boolean);
    if (wp.length >= 2) await loadLeg(wp, nav.current.destPt);
  }, [loadLeg]);

  // ── Start: begin the trip → mark STARTED on the backend + start turn-by-turn ──
  const handleStart = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await api.put(`/trips/${tripId}/start`);
    } catch {
      // Non-fatal: still let the driver navigate; backend status can reconcile later
      showToast('Could not update trip status — navigating anyway.');
    }
    nav.current.phase = PHASE.TRIP;
    setPhase(PHASE.TRIP);
    nav.current.following = true;
    setFollowing(true);
    if (nav.current.voice) Speech.speak('Starting trip', { language: 'en-GB' });
    const pos = positionRef.current;
    if (pos) focusOnDriver(pos, 800);
    setIsStarting(false);
  }, [tripId, isStarting, showToast, focusOnDriver]);

  // ── Map controls ──
  const handleReCenter = useCallback(() => {
    const pos = positionRef.current ?? currentPosition;
    if (!pos) {
      showToast('Location unavailable. Please wait for GPS signal.');
      return;
    }
    // Resume Follow Mode: drop the saved Explore view so future returns keep following,
    // and seed the follow camera with the current heading/zoom for a smooth resume.
    clearStoreCamera(tripId);
    hasSavedCameraRef.current = false;
    nav.current.following = true;
    setFollowing(true);
    nav.current.camBearing = currentHeading || nav.current.camBearing;
    nav.current.camZoom    = NAV_ZOOM;
    focusOnDriver(pos, 600);
  }, [currentPosition, currentHeading, showToast, focusOnDriver, clearStoreCamera, tripId]);

  // Zoom relative to the current camera. Reads the live camera and adjusts BOTH
  // zoom (Google/Android) and altitude (Apple/iOS) so it works on both providers,
  // keeping the current centre so it doesn't need a GPS fix.
  const zoomBy = useCallback(async (delta) => {
    const map = mapRef.current;
    if (!map) return;
    nav.current.following = false;
    setFollowing(false);
    let cam;
    try { cam = await map.getCamera(); } catch { return; }
    if (cam.zoom != null) {
      cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom + delta));
      zoomRef.current = cam.zoom;
      mapCameraRef.current.zoom = cam.zoom;
    }
    if (cam.altitude != null) {
      // Each zoom step halves/doubles altitude (zoom in = delta +1 = altitude / 2)
      cam.altitude = cam.altitude / Math.pow(2, delta);
    }
    map.animateCamera(cam, { duration: 300 });
  }, []);

  const handleZoomIn  = useCallback(() => zoomBy(1),  [zoomBy]);
  const handleZoomOut = useCallback(() => zoomBy(-1), [zoomBy]);

  const handleOverview = useCallback(() => {
    nav.current.following = false;
    setFollowing(false);
    const coords = nav.current.fullCoords;
    if (coords.length >= 2) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 140, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
    }
  }, []);

  const handleTiltToggle = useCallback(() => {
    const next = !tiltEnabled;
    setTiltEnabled(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pos = positionRef.current ?? currentPosition;
    if (nav.current.following && pos) {
      mapRef.current?.animateCamera(
        { center: pos, heading: currentHeading, pitch: next ? 45 : 0, zoom: NAV_ZOOM, altitude: NAV_ALTITUDE },
        { duration: 400 },
      );
    }
  }, [tiltEnabled, currentPosition, currentHeading]);

  const togglePanel = () => {
    const next = !panelExpanded;
    setPanelExpanded(next);
    panelH.value = withSpring(
      (next ? 380 : 180) + insets.bottom,
      { damping: 18, stiffness: 180 },
    );
  };

  // ── Derived display values ──
  const { originLat, originLng, destLat, destLng } = extractCoords(trip);
  const curDir      = directions[currentStepIndex];
  const nextDir     = directions[currentStepIndex + 1];
  const nextNextDir = directions[currentStepIndex + 2];

  // Phase-aware primary button (bottom panel): Ready → Start → Mark arrived.
  const primaryBtn = (() => {
    if (phase === PHASE.TRIP) {
      return isWithin200m
        ? { label: 'Mark arrived', icon: 'map-pin', active: true,  loading: isMarkingArrived, onPress: handleMarkArrived, bg: C.green }
        : { label: `${formatDistance(distanceToDest)} to destination`, icon: 'navigation', active: false, onPress: null };
    }
    if (phase === PHASE.AT_START) {
      return { label: 'Start trip', icon: 'play', active: true, loading: isStarting, onPress: handleStart, bg: C.green };
    }
    // APPROACH
    return nearStart
      ? { label: 'Ready', icon: 'check-circle', active: true, onPress: handleReady, bg: C.navyPrimary }
      : { label: `${formatDistance(distanceToDest)} to start`, icon: 'navigation', active: false, onPress: null };
  })();

  // ─────────────────────────────────────────────────────────────────────────────
  // PERMISSION DENIED SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  if (permissionDenied) {
    return (
      <View style={[styles.permWrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Feather name="map-pin" size={52} color={C.text3} />
        <Text style={styles.permTitle}>Location access needed</Text>
        <Text style={styles.permSub}>
          Enable location in Settings to use turn-by-turn navigation.
        </Text>
        <Pressable style={styles.permPrimaryBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.permPrimaryBtnText}>Enable location</Text>
        </Pressable>
        <Pressable style={styles.permGhostBtn} onPress={() => router.back()}>
          <Text style={styles.permGhostBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAP SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#E8EEF4' }}>

      {/* ── Full-screen map (lazy mount) ── */}
      {mapMounted && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          mapType="standard"
          showsUserLocation={false}
          showsCompass={false}
          showsMyLocationButton={false}
          rotateEnabled
          pitchEnabled
          minZoomLevel={3}
          maxZoomLevel={20}
          // While following, push the camera target down so the driver sits ~30% from the
          // bottom and more of the road ahead is visible (top padding lowers the target).
          mapPadding={isFollowingVehicle
            ? { top: Math.round(SCREEN_H * 0.34), right: 0, bottom: 0, left: 0 }
            : { top: 0, right: 0, bottom: 0, left: 0 }}
          onMapReady={onMapReady}
          onPanDrag={() => {
            nav.current.following = false;
            setFollowing(false);
          }}
          onRegionChangeComplete={async (region) => {
            // latitudeDelta ≈ 360 / 2^zoom  →  zoom ≈ log2(360 / latDelta)
            const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(Math.log2(360 / region.latitudeDelta))));
            mapCameraRef.current = { latitude: region.latitude, longitude: region.longitude, zoom };
            zoomRef.current = zoom;
            // Persist the FULL camera ONLY in Free Explore mode. In Follow Mode the camera
            // is derived from the driver, so saving it would overwrite the explore view and
            // make returns snap to a stale frame. getCamera adds heading + pitch.
            if (nav.current.following) return;
            try {
              const cam = await mapRef.current?.getCamera();
              if (cam) {
                setStoreCamera(tripId, {
                  latitude:  cam.center?.latitude  ?? region.latitude,
                  longitude: cam.center?.longitude ?? region.longitude,
                  zoom:      cam.zoom ?? zoom,
                  heading:   cam.heading ?? 0,
                  pitch:     cam.pitch ?? 0,
                  altitude:  cam.altitude,
                });
              }
            } catch { /* ignore */ }
          }}
        >
          {/* Map imagery:
              - iOS  → Apple Maps (native vector, free, no key). No tile overlay needed.
              - Android → Google's base map needs an API key we don't have, so we overlay
                raster tiles instead.
              Tiles come from CARTO's basemaps (OpenStreetMap data), NOT the OSM
              volunteer servers. The public osm.org tiles block embedded apps (HTTP 403 —
              tile usage policy); CARTO permits app use for free with attribution.
              - maximumNativeZ 20 → CARTO serves tiles up to z20.
              - maximumZ 20 caps display so nothing over-zooms into missing tiles.
              - tileSize 256 matches the raster tile size. */}
          {Platform.OS === 'android' && (
            <UrlTile
              urlTemplate="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
              minimumZ={1}
              maximumZ={20}
              maximumNativeZ={20}
              tileSize={256}
              shouldReplaceMapContent
            />
          )}

          {/* Full route — drawn start → finish so the line is ALWAYS visible,
              independent of the driver's position. White casing underlay first, then the
              solid blue line on top (classic navigation look, high visibility). */}
          {fullRouteCoords.length > 1 && (
            <Polyline
              coordinates={fullRouteCoords}
              strokeColor="rgba(255,255,255,0.9)"
              strokeWidth={11}
              lineCap="round"
            />
          )}
          {fullRouteCoords.length > 1 && (
            <Polyline
              coordinates={fullRouteCoords}
              strokeColor="#2563EB"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Driven portion overlaid in gray on top, to show progress along the route */}
          {completedRouteCoords.length > 1 && (
            <Polyline
              coordinates={completedRouteCoords}
              strokeColor="rgba(107,114,128,0.55)"
              strokeWidth={5}
              lineCap="round"
            />
          )}

          {/* Origin — green "Start" pin */}
          {originLat != null && (
            <Marker
              coordinate={{ latitude: Number(originLat), longitude: Number(originLng) }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={trackMarkers}
              zIndex={2}
            >
              <Pin color={C.green} label="Start" />
            </Marker>
          )}

          {/* Stop markers — numbered navy pins between origin and destination */}
          {stopMarkers.map((s, i) => (
            <Marker
              key={`stop-${i}`}
              coordinate={{ latitude: Number(s.latitude), longitude: Number(s.longitude) }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={trackMarkers}
              zIndex={2}
            >
              <Pin color={C.navyPrimary} number={i + 1} />
            </Marker>
          ))}

          {/* Destination — red pin with the destination name */}
          {destLat != null && (
            <Marker
              coordinate={{ latitude: Number(destLat), longitude: Number(destLng) }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={trackMarkers}
              zIndex={3}
            >
              <Pin color={C.red} label={trip?.destination || 'Destination'} />
            </Marker>
          )}

          {/* Next-turn dot */}
          {nextDir?.startLocation && (
            <Marker
              coordinate={nextDir.startLocation}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.turnDot} />
            </Marker>
          )}

          {/* Vehicle marker — static content so Android rasterises a crisp icon.
              tracksViewChanges is on only briefly (so the truck glyph is captured), then
              off, keeping the icon sharp and stable. The coordinate still moves natively
              and `rotation` still turns it to face the heading without re-capturing. */}
          {currentPosition && (
            <Marker
              coordinate={currentPosition}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              tracksViewChanges={vehicleTracking}
              rotation={currentHeading}
            >
              {/* Wrapper IS the halo (in-flow layout) — an absolute halo gets clipped
                  to a partial arc when Android rasterises the marker. */}
              <View style={styles.vehicleWrapper}>
                <View style={styles.vehicleCircle}>
                  <Feather name="truck" size={18} color="#fff" />
                </View>
              </View>
            </Marker>
          )}
        </MapView>
      )}

      {/* ── Loading pill — shown until trip + OSRM are ready ── */}
      {isLoading && (
        <View style={[styles.loadingPill, { top: insets.top + 8 }]}>
          <ActivityIndicator size="small" color={C.teal} />
          <Text style={styles.loadingPillText}>Loading route...</Text>
        </View>
      )}

      {/* ── Top row: back button + instruction card ── */}
      {!isLoading && (
        <View style={[styles.topSafe, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topRow}>

            {/* Back button */}
            <Animated.View style={backBtnAnimStyle}>
              <Pressable
                style={styles.backBtn}
                onPress={handleBack}
                onPressIn={() => { backBtnScale.value = withTiming(0.94, { duration: 80 }); }}
                onPressOut={() => { backBtnScale.value = withSpring(1, { damping: 12 }); }}
              >
                <Feather name="arrow-left" size={20} color={C.navyPrimary} />
              </Pressable>
            </Animated.View>

            {/* Instruction card */}
            <Animated.View style={[styles.instructionCard, cardStyle, { flex: 1 }]}>
              <View style={styles.instructionRow}>
                <View style={styles.maneuverBox}>
                  <Feather
                    name={getManeuverIcon(nextDir?.maneuverType, nextDir?.maneuverModifier)}
                    size={22}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.distText}>{formatDistance(distanceToNextTurn)}</Text>
                  <Text style={styles.instrText} numberOfLines={2}>
                    {nextDir?.instruction || curDir?.instruction || 'Continue on route'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setVoice(v => !v)}
                  style={[styles.voiceBtn, { backgroundColor: voiceEnabled ? C.tealPale : '#F3F4F6' }]}
                >
                  <Feather
                    name={voiceEnabled ? 'volume-2' : 'volume-x'}
                    size={16}
                    color={voiceEnabled ? C.teal : C.text3}
                  />
                </Pressable>
              </View>

              {(nextNextDir || curDir?.streetName) ? (
                <>
                  <View style={styles.cardDivider} />
                  <View style={styles.previewRow}>
                    {nextNextDir && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Feather
                          name={getManeuverIcon(nextNextDir.maneuverType, nextNextDir.maneuverModifier)}
                          size={13}
                          color={C.text3}
                          style={{ marginRight: 5 }}
                        />
                        <Text style={styles.previewText} numberOfLines={1}>
                          {'Then: ' + nextNextDir.instruction}
                        </Text>
                      </View>
                    )}
                    {curDir?.streetName ? (
                      <Text style={styles.streetText} numberOfLines={1}>
                        {curDir.streetName}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : null}
            </Animated.View>
          </View>
        </View>
      )}

      {/* ── Speed bubble ── */}
      <View style={[styles.speedBubble, { top: insets.top + 130 }]}>
        <Text style={styles.speedVal}>{Math.round(currentSpeed)}</Text>
        <Text style={styles.speedUnit}>KM/H</Text>
      </View>

      {/* Tile attribution — required by CARTO/OpenStreetMap usage terms (Android tiles) */}
      {Platform.OS === 'android' && (
        <Text style={[styles.attribution, { bottom: insets.bottom + 190 }]}>
          © OpenStreetMap © CARTO
        </Text>
      )}

      {/* ── Map control column (right side) ── */}
      <View style={[styles.controlCol, { top: insets.top + 130 }]}>
        <Pressable
          style={[styles.controlBtn, isFollowingVehicle && styles.controlBtnActive]}
          onPress={handleReCenter}
        >
          <Feather name="crosshair" size={18} color={isFollowingVehicle ? C.teal : C.navyPrimary} />
        </Pressable>
        <Pressable style={styles.controlBtn} onPress={handleZoomIn}>
          <Feather name="plus" size={18} color={C.navyPrimary} />
        </Pressable>
        <Pressable style={styles.controlBtn} onPress={handleZoomOut}>
          <Feather name="minus" size={18} color={C.navyPrimary} />
        </Pressable>
        <Pressable style={styles.controlBtn} onPress={handleOverview}>
          <Feather name="maximize" size={18} color={C.navyPrimary} />
        </Pressable>
        <Pressable
          style={[styles.controlBtn, tiltEnabled && styles.controlBtnActive]}
          onPress={handleTiltToggle}
        >
          <Feather name="layers" size={18} color={tiltEnabled ? C.teal : C.navyPrimary} />
        </Pressable>
      </View>

      {/* ── Rerouting overlay ── */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.reroutingOverlay, reroutingStyle]}
        pointerEvents={isRerouting ? 'auto' : 'none'}
      >
        <View style={styles.reroutingCard}>
          <ActivityIndicator size="large" color={C.teal} />
          <Text style={styles.reroutingTitle}>Rerouting...</Text>
          <Text style={styles.reroutingSubtitle}>Finding the best route</Text>
        </View>
      </Animated.View>

      {/* ── Error toast ── */}
      {!!errorToast && (
        <Animated.View style={[styles.errorToast, { top: insets.top + 100 }, toastStyle]}>
          <Feather name="alert-circle" size={14} color={C.red} />
          <Text style={styles.errorToastText}>{errorToast}</Text>
        </Animated.View>
      )}

      {/* ── Bottom trip panel ── */}
      <Animated.View style={[styles.bottomPanel, panelStyle]}>

        <Pressable style={styles.dragHandle} onPress={togglePanel}>
          <View style={styles.dragPill} />
        </Pressable>

        <View style={styles.panelContent}>

          {/* Stats row — ETA (mins) | Distance | Arrival time; cross-fades on OSRM refresh */}
          <Animated.View style={[styles.statsRow, statsAnimStyle]}>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statVal}>{formatEtaMins(routeDurationSecs)}</Text>
              <Text style={styles.statLbl}>ETA</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statVal}>{formatDistance(distanceToDest)}</Text>
              <Text style={styles.statLbl}>Distance</Text>
            </View>
            <View style={[styles.statCell, { flex: 1.1 }]}>
              <Text style={styles.statVal}>{formatArrivalTime(routeDurationSecs)}</Text>
              <Text style={styles.statLbl}>Arrives</Text>
            </View>
          </Animated.View>

          {/* Upcoming turns (expanded) */}
          {panelExpanded && directions.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.upcomingLabel}>UPCOMING TURNS</Text>
              {directions.slice(currentStepIndex, currentStepIndex + 5).map((step, index) => (
                <View
                  key={step.id}
                  style={[styles.stepRow, index < 4 && styles.stepRowBorder]}
                >
                  <View style={[styles.stepIconBox, index === 0 && styles.stepIconBoxActive]}>
                    <Feather
                      name={getManeuverIcon(step.maneuverType, step.maneuverModifier)}
                      size={16}
                      color={index === 0 ? '#fff' : C.text3}
                    />
                  </View>
                  <Text
                    style={[styles.stepInstruction, index === 0 && { fontFamily: 'Inter-SemiBold', color: C.text1 }]}
                    numberOfLines={1}
                  >
                    {step.instruction}
                  </Text>
                  <Text style={styles.stepDist}>{formatDistance(step.distance)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Phase-aware primary button: (distance hint) → Ready → Start → Mark arrived */}
          <Animated.View style={arrivedBtnStyle}>
            <Pressable
              onPress={primaryBtn.active ? primaryBtn.onPress : null}
              disabled={!primaryBtn.active || primaryBtn.loading}
              style={[
                styles.arriveBtn,
                {
                  backgroundColor: primaryBtn.active ? primaryBtn.bg : C.border,
                  shadowColor:     primaryBtn.active ? primaryBtn.bg : 'transparent',
                  shadowOpacity:   primaryBtn.active ? 0.35 : 0,
                },
              ]}
            >
              {primaryBtn.loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather
                    name={primaryBtn.icon}
                    size={18}
                    color={primaryBtn.active ? '#fff' : '#9CA3AF'}
                  />
                  <Text style={[styles.arriveBtnText, { color: primaryBtn.active ? '#fff' : '#9CA3AF' }]}>
                    {primaryBtn.label}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Incident report button */}
          <Pressable
            style={styles.incidentBtn}
            onPress={() => router.push({ pathname: '/(driver)/incident/report/[tripId]_3', params: { tripId } })}
          >
            <Feather name="alert-triangle" size={14} color={C.red} />
            <Text style={styles.incidentBtnText}>Report incident</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 8 }} />
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Permission denied
  permWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 32, backgroundColor: C.bg,
  },
  permTitle:          { fontFamily: 'Inter-Bold', fontSize: 20, color: C.text1, textAlign: 'center' },
  permSub:            { fontFamily: 'Inter-Regular', fontSize: 14, color: C.text3, textAlign: 'center', lineHeight: 22 },
  permPrimaryBtn:     { marginTop: 8, backgroundColor: C.teal, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  permPrimaryBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  permGhostBtn:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 12 },
  permGhostBtnText:   { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text2 },

  // Loading pill
  loadingPill: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  loadingPillText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.text2 },

  // Top row (back btn + card side by side)
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, gap: 8 },

  // Back button
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Instruction card
  instructionCard: {
    backgroundColor: '#fff',
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  instructionRow:  { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 10 },
  maneuverBox: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: C.navyPrimary,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
    shadowColor: C.navyPrimary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  distText:   { fontFamily: 'Inter-Bold', fontSize: 26, color: C.text1, letterSpacing: -0.5 },
  instrText:  { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text2, marginTop: 1 },
  voiceBtn: {
    width: 36, height: 36, borderRadius: 18, marginLeft: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardDivider: { height: 1, backgroundColor: '#F9FAFB', marginHorizontal: 16 },
  previewRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  previewText: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, flex: 1 },
  streetText:  { fontFamily: 'Inter-Medium', fontSize: 12, color: C.teal },

  // Speed bubble
  speedBubble: {
    position: 'absolute', left: 16,
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  speedVal:  { fontFamily: 'Inter-Bold', fontSize: 20, color: C.text1 },
  speedUnit: { fontFamily: 'Inter-Regular', fontSize: 9, color: C.text3, letterSpacing: 0.5 },

  // Tile attribution (bottom-left, subtle)
  attribution: {
    position: 'absolute',
    left: 10,
    fontFamily: 'Inter-Regular',
    fontSize: 9,
    color: 'rgba(0,0,0,0.5)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },

  // Map control column
  controlCol: {
    position: 'absolute', right: 16,
    gap: 8,
  },
  controlBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  controlBtnActive: {
    backgroundColor: C.tealPale,
    borderWidth: 1.5,
    borderColor: 'rgba(13,148,136,0.3)',
  },

  // Markers — distinct teardrop pins
  pinLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, marginBottom: 4, maxWidth: 170,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinLabelText: { fontFamily: 'Inter-Bold', fontSize: 12, color: C.text1 },
  pinHead: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pinNumber: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#fff' },
  pinCenterDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  pinPoint: {
    width: 0, height: 0, marginTop: -3,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    // borderTopColor set inline per pin
  },
  turnDot:       { width: 12, height: 12, borderRadius: 6, backgroundColor: C.teal, borderWidth: 2, borderColor: '#fff' },

  // Vehicle marker (static + in-flow layout so it rasterises crisply on Android)
  // The wrapper is the teal halo; the navy circle sits centred inside it.
  vehicleWrapper: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(13,148,136,0.22)',
    borderWidth: 1, borderColor: 'rgba(13,148,136,0.40)',
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.navyPrimary,
    borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },

  // Rerouting
  reroutingOverlay: {
    backgroundColor: 'rgba(27,58,107,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  reroutingCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20,
  },
  reroutingTitle:    { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.text1 },
  reroutingSubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3 },

  // Error toast
  errorToast: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  errorToastText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red },

  // Bottom panel
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
  },
  dragHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  dragPill:   { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border },
  panelContent: { paddingHorizontal: 20 },

  // Stats
  statsRow:        { flexDirection: 'row', marginBottom: 14 },
  statCell:        { flex: 1, alignItems: 'center' },
  statCellBorder:  { borderRightWidth: 1, borderRightColor: '#F3F4F6' },
  statVal:         { fontFamily: 'Inter-Bold', fontSize: 22, color: C.text1 },
  statLbl:         { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3, marginTop: 2 },

  // Upcoming steps
  upcomingLabel:     { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  stepRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stepRowBorder:     { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  stepIconBox:       { width: 32, height: 32, borderRadius: 8, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  stepIconBoxActive: { backgroundColor: C.navyPrimary },
  stepInstruction:   { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3 },
  stepDist:          { fontFamily: 'Inter-Medium', fontSize: 12, color: C.text3, marginLeft: 8 },

  // Arrive button
  arriveBtn: {
    height: 54, borderRadius: 16, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  arriveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, letterSpacing: -0.2 },

  // Incident button
  incidentBtn: {
    height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 8,
  },
  incidentBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red },
});
