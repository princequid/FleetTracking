import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, BackHandler, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withRepeat, withSequence,
  Easing, interpolate,
} from 'react-native-reanimated';
import { C } from '../../../../constants/colors';
import api from '../../../../services/api_1';

const ARRIVE_RADIUS = 200;   // within this of the destination → "Mark arrived"
const READY_RADIUS  = 150;   // within this of the trip start → "Ready" button
const OSRM_BASE     = 'http://172.20.10.4:5000';
const REROUTE_DIST  = 80;

// Navigation phases:
//   APPROACH — Leg 1: routing the driver to the trip's start point.
//   AT_START — reached the start; trip route (origin→destination) loaded, awaiting Start.
//   TRIP     — Leg 2: navigating the actual trip from start to destination.
const PHASE = { APPROACH: 'APPROACH', AT_START: 'AT_START', TRIP: 'TRIP' };
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
function Pin({ color, icon, number, label }) {
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
          : <Feather name={icon} size={18} color="#fff" />}
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

  // Mutable nav state — read by GPS callback to avoid stale closures.
  // following starts false so the map opens on the full-route overview; the driver
  // taps the recenter/crosshair button to lock onto their location and follow.
  const nav = useRef({
    following:       false,
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
  });

  const locSubRef           = useRef(null);
  const isReroutingRef      = useRef(false);
  const lastSpokenStep      = useRef(-1);
  const spokenThresholds    = useRef(new Set());
  const mapReadyRef         = useRef(false);
  const didAutoZoomRef      = useRef(false);
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
  const [isFollowingVehicle,   setFollowing]          = useState(false);
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
  const pulseScale       = useSharedValue(1);
  const pulseOpacity     = useSharedValue(0.6);
  const cardEntrance     = useSharedValue(0);
  const toastOpacity     = useSharedValue(0);
  const statsOpacity     = useSharedValue(1);
  const backBtnScale     = useSharedValue(1);

  // ── Animated styles ──
  const pulsingRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity:   pulseOpacity.value,
  }));
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
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 0 }),
      ), -1, false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1500 }),
        withTiming(0.6, { duration: 0 }),
      ), -1, false,
    );
    cardEntrance.value = withTiming(1, {
      duration: 350, easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, []);

  // Lazy MapView — defer mount by one frame so the JS thread isn't blocked on initial render
  useEffect(() => {
    const t = setTimeout(() => setMapMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // On load we intentionally show the whole route (origin → destination) so the driver
  // can see the full trip. Zooming in to the driver is a deliberate action via the
  // recenter/crosshair button, not automatic — otherwise it hides the route on open.

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
      const res = await fetch(url);
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
    if (pendingFitRef.current && mapRef.current) {
      mapRef.current.fitToCoordinates(pendingFitRef.current, {
        edgePadding: { top: 140, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
      pendingFitRef.current = null;
    }
  }, []);

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

    const { steps, overviewCoords, duration } = await fetchOsrm(waypoints);
    if (overviewCoords.length >= 2) {
      nav.current.fullCoords = overviewCoords;
      nav.current.directions = steps;
      setFullRoute(overviewCoords);
      setDirections(steps);
      if (duration != null) setRouteDurationSecs(Math.round(duration));
      fitToRoute(overviewCoords);
    } else if (waypoints.length >= 2) {
      // OSRM unreachable — show a direct line so the route is still visible
      nav.current.fullCoords = waypoints;
      nav.current.directions = [];
      setFullRoute(waypoints);
      setDirections([]);
      fitToRoute(waypoints);
      showToast('Route server unreachable — showing a direct line.');
    }
  }, [fetchOsrm, fitToRoute, showToast]);

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

  // ── GPS position handler ──
  const onPositionUpdate = useCallback((location) => {
    const { latitude, longitude, speed, heading, accuracy } = location.coords;
    const speedKmh  = Math.max(0, (speed || 0) * 3.6);
    const dirs       = nav.current.directions;
    const fullCoords = nav.current.fullCoords;

    // Store latest position for ETA refresh and as fallback center for zoom buttons
    positionRef.current = { latitude, longitude };
    if (nav.current.following) {
      mapCameraRef.current.latitude  = latitude;
      mapCameraRef.current.longitude = longitude;
      mapCameraRef.current.zoom      = NAV_ZOOM;
    }

    markerHeading.value = withTiming(heading || 0, { duration: 500 });
    setPosition({ latitude, longitude });
    setHeading(heading || 0);
    setSpeed(speedKmh);

    // Camera follow — reads tilt from nav ref to avoid stale closure.
    // Sets both zoom (Android) and altitude (iOS) so the zoom holds on both providers.
    if (nav.current.following) {
      mapRef.current?.animateCamera(
        {
          center: { latitude, longitude },
          heading: heading || 0,
          pitch: nav.current.tilt ? 45 : 0,
          zoom: NAV_ZOOM,
          altitude: NAV_ALTITUDE,
        },
        { duration: 800 },
      );
    }

    // GPS ping — fire and forget
    api.post(`/gps/trips/${tripId}/ping`, {
      lat:        latitude,
      lng:        longitude,
      speedKmh:   Math.round(speedKmh),
      heading:    Math.round(heading || 0),
      accuracyM:  Math.round(accuracy || 0),
      recordedAt: new Date(location.timestamp).toISOString(),
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

  // ── Load trip + start GPS ──
  useEffect(() => {
    (async () => {
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

      // ── Resolve start & destination coordinates ──
      // Prefer coordinates stored on the trip; if a trip was dispatched with only a
      // typed address, geocode that text so the route still draws.
      let { originLat, originLng, destLat, destLng } = extractCoords(tripData);
      if (originLat == null && tripData.origin) {
        const g = await geocodeAddress(tripData.origin);
        if (g) { originLat = g.latitude; originLng = g.longitude; }
      }
      if (destLat == null && tripData.destination) {
        const g = await geocodeAddress(tripData.destination);
        if (g) { destLat = g.latitude; destLng = g.longitude; }
      }

      // ── Resolve stop coordinates (geocode any missing), preserving order ──
      const rawStops = Array.isArray(tripData.stops) ? tripData.stops : [];
      const stopCoords = [];
      for (const s of rawStops) {
        let lat = s.lat ?? s.latitude ?? null;
        let lng = s.lng ?? s.longitude ?? null;
        if ((lat == null || lng == null) && s.name) {
          const g = await geocodeAddress(s.name);
          if (g) { lat = g.latitude; lng = g.longitude; }
        }
        if (lat != null && lng != null) {
          stopCoords.push({ latitude: Number(lat), longitude: Number(lng) });
        }
      }

      // Patch the trip with resolved coords so markers + distance-to-destination work,
      // and stash stop coords for reroutes.
      tripData.originLat = originLat; tripData.originLng = originLng;
      tripData.destLat   = destLat;   tripData.destLng   = destLng;
      nav.current.trip       = tripData;
      nav.current.stopCoords = stopCoords;
      setTrip({ ...tripData });
      setStopMarkers(stopCoords);

      // Trip endpoints
      const originPt = originLat != null ? { latitude: originLat, longitude: originLng } : null;
      const destPt   = destLat   != null ? { latitude: destLat,   longitude: destLng }   : null;
      nav.current.originPt = originPt;
      nav.current.destPt   = destPt;

      // ── Get the driver's current position (needed to route the approach leg) ──
      let driverPos = null;
      try {
        const posRes = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude, heading, speed } = posRes.coords;
        driverPos = { latitude, longitude };
        positionRef.current = driverPos;
        setPosition(driverPos);
        setHeading(heading || 0);
        setSpeed(Math.max(0, (speed || 0) * 3.6));
      } catch {
        showToast('Unable to get your current location. Check GPS and try again.');
      }

      // ── Choose the starting leg based on trip status ──
      // Already-started trips skip the approach leg and go straight to the trip route.
      const status        = (tripData.status || '').toUpperCase();
      const alreadyStarted = status === 'STARTED' || status === 'EN_ROUTE';

      if (alreadyStarted || !originPt) {
        // Leg 2 directly: navigate the trip route origin → stops → destination
        nav.current.phase = PHASE.TRIP;
        setPhase(PHASE.TRIP);
        nav.current.following = true;
        setFollowing(true);
        const wp = [originPt, ...stopCoords, destPt].filter(Boolean);
        if (wp.length >= 2) await loadLeg(wp, destPt);
        else showToast('Could not determine the trip start or destination location.');
      } else if (driverPos && originPt) {
        // Leg 1: approach route from the driver's location to the trip start
        nav.current.phase = PHASE.APPROACH;
        setPhase(PHASE.APPROACH);
        await loadLeg([driverPos, originPt], originPt);
      } else if (originPt && destPt) {
        // No GPS fix yet — preview the trip route until a fix arrives; the "Ready"
        // trigger still fires off distance-to-start once GPS resumes.
        nav.current.phase = PHASE.APPROACH;
        setPhase(PHASE.APPROACH);
        nav.current.target = originPt;
        await loadLeg([originPt, ...stopCoords, destPt], originPt);
      } else {
        showToast('Could not determine the trip start or destination location.');
      }

      setIsLoading(false);

      // Start live GPS watch
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1500, distanceInterval: 5 },
        onPositionUpdate,
      );
      locSubRef.current = sub;

      // OSRM ETA refresh every 30 s
      etaTimerRef.current = setInterval(fetchEtaRefresh, 30000);
    })();

    return () => {
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
    locSubRef.current?.remove?.();
    clearInterval(etaTimerRef.current);
    Speech.stop();
    try {
      await api.put(`/trips/${tripId}/arrive`);
      router.replace(`/(driver)/trip/${tripId}_2`);
    } catch {
      setIsMarkingArrived(false);
      showToast('Could not confirm arrival. Please try again.');
    }
  }, [tripId, isMarkingArrived, showToast]);

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
    nav.current.following = true;
    setFollowing(true);
    focusOnDriver(pos, 500);
  }, [currentPosition, showToast, focusOnDriver]);

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
          onMapReady={onMapReady}
          onPanDrag={() => {
            nav.current.following = false;
            setFollowing(false);
          }}
          onRegionChangeComplete={(region) => {
            // latitudeDelta ≈ 360 / 2^zoom  →  zoom ≈ log2(360 / latDelta)
            const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(Math.log2(360 / region.latitudeDelta))));
            mapCameraRef.current = { latitude: region.latitude, longitude: region.longitude, zoom };
            zoomRef.current = zoom;
          }}
        >
          {/* Map imagery:
              - iOS  → Apple Maps (native vector, free, no key). No tile overlay needed.
              - Android → Google's base map needs an API key we don't have, so we overlay
                OpenStreetMap raster tiles instead.
              Tile tuning to avoid black screens:
              - maximumNativeZ 18 → only fetch tiles that always exist on OSM.
              - maximumZ 20 (> maxZoomLevel) → beyond native zoom the last tile is
                UPSCALED (slightly blurry) instead of rendering black.
              - tileSize 256 matches OSM's native tile size for correct, fast loading. */}
          {Platform.OS === 'android' && (
            <UrlTile
              urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
              minimumZ={1}
              maximumZ={20}
              maximumNativeZ={18}
              tileSize={256}
              shouldReplaceMapContent
            />
          )}

          {/* Full route — drawn start → finish so the line is ALWAYS visible,
              independent of the driver's position. Shadow underlay first, then the
              solid navy line on top. */}
          {fullRouteCoords.length > 1 && (
            <Polyline
              coordinates={fullRouteCoords}
              strokeColor="rgba(0,0,0,0.35)"
              strokeWidth={11}
              lineCap="round"
            />
          )}
          {fullRouteCoords.length > 1 && (
            <Polyline
              coordinates={fullRouteCoords}
              strokeColor="#FFFFFF"
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
              coordinate={{ latitude: originLat, longitude: originLng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={2}
            >
              <Pin color={C.green} icon="flag" label="Start" />
            </Marker>
          )}

          {/* Stop markers — numbered navy pins between origin and destination */}
          {stopMarkers.map((s, i) => (
            <Marker
              key={`stop-${i}`}
              coordinate={s}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={2}
            >
              <Pin color={C.navyPrimary} number={i + 1} />
            </Marker>
          ))}

          {/* Destination — red pin with the destination name */}
          {destLat != null && (
            <Marker
              coordinate={{ latitude: destLat, longitude: destLng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={3}
            >
              <Pin color={C.red} icon="map-pin" label={trip?.destination || 'Destination'} />
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

          {/* Vehicle marker — tracksViewChanges always true so Reanimated pulse ring
              stays live in the native layer; acceptable cost for a single moving marker */}
          {currentPosition && (
            <Marker
              coordinate={currentPosition}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              tracksViewChanges
              rotation={currentHeading}
            >
              <View style={styles.vehicleWrapper}>
                <Animated.View style={[styles.pulseRing, pulsingRingStyle]} />
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
  pinPoint: {
    width: 0, height: 0, marginTop: -3,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    // borderTopColor set inline per pin
  },
  turnDot:       { width: 12, height: 12, borderRadius: 6, backgroundColor: C.teal, borderWidth: 2, borderColor: '#fff' },

  // Vehicle marker
  vehicleWrapper: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(13,148,136,0.18)',
  },
  vehicleCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.navyPrimary,
    borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: C.navyPrimary, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
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
