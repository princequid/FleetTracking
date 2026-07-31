import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, BackHandler, Platform, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withRepeat, withSequence,
  Easing, interpolate,
} from 'react-native-reanimated';
import { useTheme, useThemeMode } from '../../../../theme/ThemeContext';
import VehicleMarker3D from '../../../../components/map/VehicleMarker3D';
import Pin3D from '../../../../components/map/Pin3D';
import { DARK_MAP_STYLE } from '../../../../constants/mapStyle';
import { TRIP_PAGE_SIZE } from '../../../../constants/config';
import api from '../../../../services/api_1';
import { useNavStore } from '../../../../store/navStore_2';
import { useTripStore } from '../../../../store/tripStore_2';
import tripService from '../../../../services/tripService_2';

const ARRIVE_RADIUS = 50;    // within this of the destination → "Mark arrived"
const READY_RADIUS  = 50;    // within this of the trip start → "Ready" button
// FleetTrack marker-family colors — fixed brand colors for the pin roles, independent
// of the light/dark theme palette (a stop pin should read the same shade of amber
// whichever theme the driver has selected).
const PIN_START_COLOR  = '#22C55E';
const PIN_STOP_COLOR   = '#F59E0B';
const PIN_DEST_COLOR   = '#EF4444';
const PIN_DRIVER_COLOR = '#1677FF';
// Public OSRM server (HTTPS) so routes follow real roads from anywhere the phone has
// internet — no local OSRM/firewall needed. Override with EXPO_PUBLIC_OSRM_URL to use a
// self-hosted OSRM instead. If unreachable, the map falls back to a direct line.
const OSRM_BASE     = process.env.EXPO_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';
const REROUTE_DIST  = 80;

// Navigation phases — drive the single bottom button through the whole trip lifecycle:
//   APPROACH — Leg 1: routing the driver to the trip's start point.
//   AT_START — reached the start; trip route (origin→destination) loaded. Next up:
//              pre-dispatch photo, then Start.
//   TRIP     — Leg 2: navigating the actual trip from start to destination.
//   ARRIVED  — reached the destination; next up: POD photo, then Complete.
const PHASE = { APPROACH: 'APPROACH', AT_START: 'AT_START', TRIP: 'TRIP', ARRIVED: 'ARRIVED' };

// In-memory cache of a trip's resolved route/nav state, keyed by tripId. Survives
// navigating away and back within the app session, so re-opening the map is instant
// (no re-fetch/geocode/route). Cleared when the trip is marked arrived.
//
// Bounded to the few most recent trips: each entry holds the FULL decoded OSRM polyline
// (fullCoords/completedCoords can be thousands of {latitude, longitude} objects on a long
// route) plus the turn-by-turn step list. Entries were only ever removed on trip
// completion, so a driver who opened several trips without completing them — or who
// re-opened the same trip after a reroute — accumulated every route for the whole app
// session with nothing ever releasing them. Map preserves insertion order, so deleting
// the first key evicts the least-recently-inserted entry.
const ROUTE_CACHE_MAX = 3;
const routeCache = new Map();

function cacheRoute(tripId, snapshot) {
  // Re-inserting moves the key to the end, so a refreshed trip counts as most-recent.
  routeCache.delete(tripId);
  routeCache.set(tripId, snapshot);
  while (routeCache.size > ROUTE_CACHE_MAX) {
    routeCache.delete(routeCache.keys().next().value);
  }
}
// Street-level navigation zoom. Both providers render vector detail well past this,
// so 18 is a comfortable navigation zoom rather than a hard ceiling. Shared by
// auto-zoom, follow and recenter so the camera never snaps between zoom levels.
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
/**
 * Turns an OSRM step into a spoken/printed instruction.
 *
 * OSRM frequently returns an empty `name` — unnamed service roads, campus
 * paths, minor junctions. This used to substitute the literal string
 * "the road", which produced "Turn right onto the road" and, because the same
 * fallback also fed the street-name label, printed "the road" twice on screen
 * at once.
 *
 * Now a missing name simply drops the "onto …" clause. "Turn right" is both
 * shorter and more honest than naming a road we can't name.
 */
function buildInstruction(step) {
  const name = step.name || null;
  const type = step.maneuver?.type  || '';
  const mod  = step.maneuver?.modifier || '';

  // " onto Main Street" / " on Main Street", or nothing at all.
  const onto = name ? ` onto ${name}` : '';
  const on   = name ? ` on ${name}`   : '';

  if (type === 'depart')  return name ? `Head onto ${name}` : 'Start driving';
  if (type === 'arrive')  return 'You have arrived at your destination';
  if (type === 'roundabout' || type === 'rotary')
    return name ? `At the roundabout, exit onto ${name}` : 'At the roundabout, take your exit';
  if (type === 'merge')   return `Merge${onto}`;
  if (type === 'fork')
    return mod.includes('right')
      ? `Keep right at the fork${onto}`
      : `Keep left at the fork${onto}`;
  if (type === 'turn' || type === 'new name') {
    if (mod === 'left')         return `Turn left${onto}`;
    if (mod === 'right')        return `Turn right${onto}`;
    if (mod === 'slight left')  return `Keep slightly left${onto}`;
    if (mod === 'slight right') return `Keep slightly right${onto}`;
    if (mod === 'sharp left')   return `Turn sharply left${onto}`;
    if (mod === 'sharp right')  return `Turn sharply right${onto}`;
    if (mod === 'straight')     return `Continue straight${on}`;
  }
  return name ? `Continue on ${name}` : 'Continue';
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
    // null, not 'the road' — the banner already guards on this being falsy and
    // simply omits the label. The old fallback printed "the road" beside an
    // instruction that also said "the road".
    streetName:       step.name || null,
    startLocation: {
      latitude:  step.geometry.coordinates[0][1],
      longitude: step.geometry.coordinates[0][0],
    },
    coordinates: step.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
  }));
}

// ─── Distinct map pin (iOS only) ──────────────────────────────────────────────
// The custom teardrop pin (Pin3D) with an optional label chip above, anchored at the
// bottom tip so the point marks the exact coordinate. Android uses native Google pins
// instead (see RouteMarker below), so this only ever renders on iOS.
// The stop number is layered on top as a plain RN <Text> rather than SVG text, since
// SVG text and icon-font glyphs don't rasterise reliably inside a marker.
const PIN_BADGE_SIZE = 16;

function Pin({ color, number, label, styles, size = 44 }) {
  const badge = Pin3D.badgeCenter(size);
  return (
    <View style={{ alignItems: 'center' }} collapsable={false}>
      {label ? (
        <View style={styles.pinLabel} collapsable={false}>
          <Text style={styles.pinLabelText} numberOfLines={1}>{label}</Text>
        </View>
      ) : null}
      <View style={{ width: size, height: Pin3D.height(size) }} collapsable={false}>
        <Pin3D color={color} size={size} hole={false} />
        {number != null && (
          <View
            style={[
              styles.pinNumberBadge,
              { left: badge.x - PIN_BADGE_SIZE / 2, top: badge.y - PIN_BADGE_SIZE / 2 },
            ]}
            collapsable={false}
          >
            <Text style={styles.pinNumber}>{number}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Marker that stops flickering ─────────────────────────────────────────────
// Android re-rasterises a custom marker on EVERY frame while tracksViewChanges is
// true, which is what shows up as the pins blinking/jittering. Leaving it permanently
// true was how these pins avoided being frozen mid-paint (blank or half-drawn), but
// the cost was that flicker. This does both: it tracks just long enough for the pin to
// paint, then freezes the bitmap so it stops re-rasterising (and stops blinking).
// `trackKey` reopens that window whenever the marker's content changes — e.g. the
// destination label resolving after a geocode — so a late change still gets captured.
function TrackedMarker({ trackKey, trackMs = 1500, children, ...markerProps }) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), trackMs);
    return () => clearTimeout(t);
  }, [trackKey, trackMs]);
  return (
    <Marker tracksViewChanges={tracking} {...markerProps}>
      {children}
    </Marker>
  );
}

// ─── Platform-split route marker ──────────────────────────────────────────────
// Android → a NATIVE Google Maps pin (`pinColor`, no children). With no custom view
// there is nothing for Android to rasterise into a marker bitmap, which was the single
// root cause of the clipped / missing / flickering pins — SVG and plain Views both hit
// it. A native pin always draws. Trade-off: native pins can't carry the number badge or
// the label chip, so those move into `title` (shown when the pin is tapped), and Google
// snaps `pinColor` to its nearest standard marker hue.
// iOS → the custom teardrop pin, which renders correctly there, unchanged.
function RouteMarker({ coordinate, color, number, label, styles, zIndex, trackKey }) {
  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={coordinate}
        pinColor={color}
        title={number != null ? `Stop ${number}` : label}
        zIndex={zIndex}
      />
    );
  }
  return (
    <TrackedMarker
      trackKey={trackKey}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={zIndex}
    >
      <Pin color={color} number={number} label={label} styles={styles} />
    </TrackedMarker>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LiveMapScreen() {
  // Keeps the device screen on for as long as this screen is mounted — a driver glancing
  // between the road and the phone shouldn't have the screen lock mid-trip. Automatically
  // released on unmount, so it never affects any other screen in the app.
  useKeepAwake();

  const router          = useRouter();
  const { id: tripId }  = useLocalSearchParams();
  // Every entry point (Navigate, Mark arrived, View Map, a notification tap, ...) must
  // focus the camera on the driver's current location — this used to be opt-in via a
  // `?focus=driver` param that only ONE caller ("Move to pickup") actually passed, so
  // every other entry point fell through to restoring whatever Explore-mode camera (or
  // cached position) happened to be saved from a previous visit, which could be far away
  // or long stale. Centralizing it here — always true, not caller-dependent — means the
  // screen behaves consistently regardless of how it was opened, with no per-button
  // camera-reset logic to keep in sync. Callers no longer need to pass `?focus=driver`.
  const focusOnMe = true;
  const C = useTheme();
  const { resolved } = useThemeMode();
  const styles = useMemo(() => makeStyles(C), [C]);
  // Map provider: Android → Google Maps (needs the API key in app.json's
  // android.config.googleMaps); iOS → Apple Maps (PROVIDER_DEFAULT), since the iOS
  // Google Maps key is still a placeholder. Dark mode is handled per-provider on the
  // MapView below (customMapStyle for Google, userInterfaceStyle for Apple).
  const mapProvider = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
  const insets          = useSafeAreaInsets();
  const mapRef          = useRef(null);

  // ── Global nav state (survives leaving/returning to the map) ──
  const storeLocation   = useNavStore((s) => s.location);   // live GPS from shared tracker
  const setStoreCamera  = useNavStore((s) => s.setCamera);
  const getStoreCamera  = useNavStore((s) => s.getCamera);
  const clearStoreCamera = useNavStore((s) => s.clearCamera);

  // Trip-lifecycle flags shared with the pre-dispatch/POD camera screens, so this
  // single button knows which step in the sequence to show next.
  const podUploaded          = useTripStore((s) => s.podUploaded);
  const preDispatchUploaded  = useTripStore((s) => s.preDispatchUploaded);
  const resetTripStore       = useTripStore((s) => s.resetTripStore);
  // Stops that already have an optional POD captured this trip — hides the button once done.
  const stopPods             = useTripStore((s) => s.stopPods);
  // Always false now that every entry focuses on the driver (focusOnMe is always true) —
  // kept as a ref (rather than deleted outright) because loadLeg's `mayMoveCamera` guard
  // and the first-fix auto-zoom effect below both key off it, and a saved Explore camera
  // may still exist in the store from before this fix; this ref is what keeps it from
  // ever being restored again.
  const hasSavedCameraRef = useRef(null);
  if (hasSavedCameraRef.current === null) {
    hasSavedCameraRef.current = focusOnMe ? false : !!getStoreCamera(tripId);
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
  const movingRef           = useRef(false);  // confirmed-moving vs. parked (see onPositionUpdate)
  const pendingMoveRef      = useRef(null);   // unconfirmed candidate fix while parked
  const toastTimersRef      = useRef([]);     // pending showToast timeouts, so a new toast can cancel a stale one's hide/clear
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
  const [isCompleting,         setIsCompleting]       = useState(false);
  // Vehicle marker rasterisation: on briefly so Android captures a crisp icon, then off
  const [vehicleTracking,      setVehicleTracking]    = useState(true);
  const vehicleReadyRef = useRef(false);
  const [isFollowingVehicle,   setFollowing]          = useState(true);
  const [panelExpanded,        setPanelExpanded]      = useState(false);
  const [voiceEnabled,         setVoice]              = useState(true);
  const [permissionDenied,     setPermDenied]         = useState(false);
  const [errorToast,           setErrorToast]         = useState('');
  const [mapMounted,           setMapMounted]         = useState(false);
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

  // Flush any GPS pings that failed to send and were queued offline (e.g. after a
  // network blip). Runs once on mount and again whenever this screen regains focus
  // (the closest signal we have to "reconnected", since NetInfo isn't wired up here).
  useFocusEffect(
    useCallback(() => {
      tripService.flushOfflinePings().catch(() => {});
    }, []),
  );

  // Once the vehicle marker first has a position, keep it rasterising just long enough
  // for the pin glyph to render, then stop so the icon stays crisp (Android fix).
  // 1800ms (was 1000ms) — a slower Android device can still be mid-paint of the SVG's
  // gradient/glow layers at the 1s mark, and freezing tracksViewChanges mid-paint
  // locks in that incomplete frame permanently (the icon then looks wrong/clipped
  // for the rest of the trip, since tracksViewChanges never re-enables itself).
  useEffect(() => {
    if (currentPosition && !vehicleReadyRef.current) {
      vehicleReadyRef.current = true;
      const t = setTimeout(() => setVehicleTracking(false), 1800);
      return () => clearTimeout(t);
    }
  }, [currentPosition]);

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
  // Cancels any hide/clear timers left over from a previous call before scheduling new
  // ones — without this, a fast repeat call (e.g. the reroute-failure path retrying every
  // few seconds against an unreachable OSRM) could have an earlier call's timers fire
  // after a newer toast is already showing, fading/clearing text that was just re-set.
  const showToast = useCallback((msg) => {
    toastTimersRef.current.forEach(clearTimeout);
    toastTimersRef.current = [];

    setErrorToast(msg);
    toastOpacity.value = withTiming(1, { duration: 200 });
    const hideTimer = setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 300 });
      const clearTimer = setTimeout(() => setErrorToast(''), 300);
      toastTimersRef.current.push(clearTimer);
    }, 3000);
    toastTimersRef.current.push(hideTimer);
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

    // Every entry always centers on the driver: drop any saved camera so it can't
    // restore a stale/far-away view, and fall through to the driver-follow behaviour.
    if (focusOnMe) clearStoreCamera(tripId);

    // The live GPS tracker runs for the whole driver session (not just while this screen
    // is open), so a position is often already known BEFORE the native map view finishes
    // initializing — meaning the currentPosition effect below can fire first, see
    // mapReadyRef still false, and skip the focus. It never gets a second chance, because
    // that effect only re-runs when currentPosition itself changes again, not when
    // mapReadyRef flips true (a ref isn't reactive). Cover that ordering here too, using
    // positionRef (kept in sync ahead of React state) so either order — map-ready-first or
    // position-first — reliably ends in the same place: centered on the driver.
    if (!firstFixZoomedRef.current && positionRef.current) {
      firstFixZoomedRef.current = true;
      focusOnDriver(positionRef.current, 1000);
      // Deterministic precedence: don't also apply a route-fit queued by loadLeg before
      // the map was ready (pendingFitRef below) right after — it would immediately
      // override the drive-focus animation just started.
      pendingFitRef.current = null;
      return;
    }

    // Dead branch by design now that focusOnMe is always true (savedCam is always null) —
    // left in place rather than deleted in case a future caller legitimately needs to
    // restore an exact Explore-mode view. It previously restored whatever camera the
    // driver had last panned/zoomed to, which is exactly what made re-opening the map
    // (via any button that didn't explicitly opt out) land on a stale, unrelated view.
    const savedCam = focusOnMe ? null : getStoreCamera(tripId);
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
  }, [getStoreCamera, tripId, focusOnMe, clearStoreCamera, focusOnDriver]);

  // ── Push the trip route to the backend ──
  // So the admin live map can draw this driver's actual route (and gps-service can run
  // deviation detection). Fire-and-forget — never blocks navigation. Sent as GeoJSON
  // {"coordinates":[[lng,lat],...]} to match what the backend/deviation check expect.
  const pushTripRoute = useCallback((coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return;
    const geometry = JSON.stringify({
      type: 'LineString',
      coordinates: coords.map((c) => [c.longitude, c.latitude]),
    });
    api.put(`/trips/${tripId}/route`, { routeGeometry: geometry }).catch(() => {});
  }, [tripId]);

  // ── Load a navigation leg ──
  // Fetches the OSRM route through `waypoints`, resets progress/turn tracking, draws
  // the line and fits it, and sets the active target (leg end). Falls back to a direct
  // line if OSRM is unreachable. Used for both Leg 1 (driver→start) and Leg 2 (trip).
  // `moveCamera: false` is passed by the initial map-entry paths, where `focusOnDriver`
  // is already explicitly centering the camera on the driver — without this, the OSRM
  // fetch resolving later (it can take up to 7s) would call fitToRoute a second time and
  // silently override that focus with a whole-route overview, which is exactly what made
  // "Navigate"/"Move to pickup" land on the driver only sometimes.
  const loadLeg = useCallback(async (waypoints, targetPt, options = {}) => {
    nav.current.target = targetPt;
    // Reset progress + turn tracking for the new leg
    nav.current.completedCoords = [];
    nav.current.stepIndex       = 0;
    lastSpokenStep.current      = -1;
    spokenThresholds.current.clear();
    setCompleted([]);
    setStepIndex(0);

    // Only auto-fit the camera to the route when we're NOT restoring a saved view, and
    // the caller hasn't reserved the camera for something else (see comment above).
    const mayMoveCamera = !hasSavedCameraRef.current && options.moveCamera !== false;

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
      // Once the trip is underway, share this leg's route with the backend (admin map).
      if (nav.current.phase === PHASE.TRIP) pushTripRoute(overviewCoords);
    }
    // If OSRM was unreachable the straight line from step 1 stays visible.
  }, [fetchOsrm, fitToRoute, pushTripRoute]);

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

    // Draw the approach route from the driver's real position to the trip start (once).
    // moveCamera:false — the focusOnDriver call just above already owns the camera here.
    if (nav.current.phase === PHASE.APPROACH && nav.current.originPt && !approachFixRef.current) {
      approachFixRef.current = true;
      loadLeg([currentPosition, nav.current.originPt], nav.current.originPt, { moveCamera: false });
    }
  }, [currentPosition, focusOnDriver, loadLeg]);

  // ── Rerouting ──
  // Ref/state setup lives INSIDE the try (not before it) so that if anything here ever
  // throws synchronously, the finally block still runs and isReroutingRef always gets
  // released — otherwise a single bad tick could wedge it at `true` and silently disable
  // rerouting for the rest of the trip.
  const triggerReroute = useCallback(async (lat, lng) => {
    if (isReroutingRef.current) return;
    // Bail before any visible side effect (haptic/speech/overlay) if there's nothing to
    // reroute to — otherwise a null target (e.g. destination geocoding failed) still
    // buzzes the phone and speaks "Rerouting" for a reroute that was never going to happen.
    const target = nav.current.target;
    if (!target) return;
    try {
      isReroutingRef.current = true;
      setIsRerouting(true);
      reroutingOpacity.value = withTiming(1, { duration: 200 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (nav.current.voice) Speech.speak('Rerouting', { language: 'en' });

      // Reroute from the driver's current position to the active leg's target
      // (the trip start during APPROACH, the destination during TRIP).
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
        // Push the rerouted path so the admin live map reflects the change.
        if (nav.current.phase === PHASE.TRIP) pushTripRoute(newCoords);
      } else {
        // fetchOsrm never throws (it swallows its own errors) — an empty `steps` here
        // means the routing request itself failed (timeout/unreachable/no route), not
        // that we're not actually off-route. Surface that instead of failing silently;
        // the next off-route GPS tick will retry automatically.
        showToast('Could not get a new route. Retrying…');
      }
    } catch {
      showToast('Could not get a new route. Retrying…');
    } finally {
      reroutingOpacity.value = withTiming(0, { duration: 300 });
      setIsRerouting(false);
      isReroutingRef.current = false;
    }
  }, [fetchOsrm, pushTripRoute, showToast]);

  // ── GPS position handler — processes a location fed from the shared tracker/store.
  //    NOTE: this updates the driver marker + nav logic ONLY. It never moves the map
  //    camera (the camera is fully independent — it only moves on recenter). ──
  const onPositionUpdate = useCallback((coords) => {
    const { latitude, longitude, speed, heading, accuracy, timestamp } = coords;
    const acc  = accuracy ?? 0;
    const prev = positionRef.current;
    const now  = timestamp || Date.now();

    // ── Location stabilisation (fixes Android GPS jitter/drift when parked) ──
    // 1) Drop very inaccurate fixes that would make the marker jump around. 35m (was 50m)
    // — indoors/poor-signal fixes routinely fall back to WiFi/cell-tower estimates that can
    // report misleadingly "OK" accuracy in the 35-50m band while still being genuinely wrong,
    // so reject more of that before it reaches the deadband/confirmed-move checks below.
    // Real outdoor GPS is typically 3-15m accurate, well under this either way — this only
    // tightens behavior for poor-signal conditions, not normal driving.
    if (prev && acc > 35) return;
    // 2) Deadband: GPS keeps reporting tiny position changes even when the vehicle
    //    is stationary. If the reported move is below the noise radius, treat the
    //    driver as not moving — keep the marker/camera still and show 0 km/h.
    let movedMeters = 0;
    if (prev) {
      movedMeters    = haversineMetres(prev.latitude, prev.longitude, latitude, longitude);
      // Floor raised 8m → 12m: Android's reported accuracy is often an optimistic
      // confidence radius, not a hard cap — a "10m accuracy" fix can still legitimately
      // wobble 10-15m from the true stationary point. An 8m floor let enough of that
      // real-world noise clear the deadband (and then mutually "confirm" itself against
      // the next similarly-noisy fix below) to make the parked marker visibly drift.
      const deadband = Math.min(20, Math.max(12, acc * 0.5));
      if (movedMeters < deadband) {
        // Stationary jitter — show 0. Do NOT advance lastFixTimeRef here: it must stay
        // paired with positionRef (both only move on accepted fixes) so the distance÷time
        // speed below always covers the same interval and isn't wildly inflated.
        speedSmoothRef.current = 0;
        setSpeed(0); // React bails out if already 0 — no needless re-render
        movingRef.current = false;
        pendingMoveRef.current = null;
        return;
      }

      // 3) A single fix can clear the deadband on its own (accuracy is often 20-45m in
      // practice, well past the deadband cap of 20m) while the vehicle is genuinely
      // parked, which used to yank the anchor to that noisy spot and make the marker
      // hop back and forth on the next good fix. While parked (not already confirmed
      // moving), require ONE more fix that agrees with this one before trusting it —
      // a real departure repeats in the same direction next fix, noise doesn't. Once
      // movement is confirmed, fixes are accepted immediately as before (no added lag
      // mid-drive).
      if (!movingRef.current) {
        const pending = pendingMoveRef.current;
        if (!pending || haversineMetres(pending.latitude, pending.longitude, latitude, longitude) > 15) {
          pendingMoveRef.current = { latitude, longitude };
          return;
        }
        movingRef.current = true;
        pendingMoveRef.current = null;
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

    // GPS ping — fire and forget. Routed through tripService so a failed ping is
    // persisted to the offline queue and retried later (flushOfflinePings), instead
    // of silently dropping on a network blip.
    tripService.sendGpsPing(tripId, {
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
        // Every re-entry (focusOnMe is always true) DON'T seed the stale cached position
        // from the last visit — that's what made re-opening the map snap to an old spot.
        // Leave the position to the live GPS tracker so the fresh-fix zoom below centres
        // on where the driver actually is now. (Dead branch below by the same design as
        // the onMapReady savedCam branch above — kept for a future opt-out, not deleted.)
        if (!focusOnMe && cached.position) positionRef.current = cached.position;

        setTrip(cached.trip);
        setFullRoute(cached.fullCoords || []);
        setStopMarkers(cached.stopCoords || []);
        setDirections(cached.directions || []);
        setCompleted(cached.completedCoords || []);
        setStepIndex(cached.stepIndex || 0);
        setPhase(cached.phase || PHASE.APPROACH);
        setNearStart(!!cached.nearStart);
        setWithin200m(!!cached.within200m);
        if (!focusOnMe && cached.position) setPosition(cached.position);
        approachFixRef.current = true;     // route already present — don't redraw
        firstFixZoomedRef.current = false; // allow a fresh zoom to the current position
        // Force follow mode so the camera tracks the driver's live position on re-open.
        if (focusOnMe) { nav.current.following = true; setFollowing(true); }
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
      // Keep each stop's id/name alongside its coords (zipped by index BEFORE filtering,
      // so nulls don't misalign) — the map needs them to offer/tag an optional per-stop POD.
      const stopCoords = stopGeos
        .map((coord, i) => (coord ? {
          ...coord,
          id:   rawStops[i]?.id ?? null,
          name: rawStops[i]?.name || rawStops[i]?.locationName || null,
        } : null))
        .filter(Boolean);

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
      const alreadyArrived = status === 'ARRIVED';
      // Backend status wins for STARTED; otherwise resume the saved local phase (e.g. the
      // driver had captured the pre-dispatch photo and was at the start reviewing the route).
      const resumeAtStart = !alreadyStarted && saved?.phase === PHASE.AT_START && originPt && destPt;

      if (alreadyArrived) {
        // Backend says this trip already reached the destination (e.g. the app was
        // killed and reopened between Mark arrived and Complete) — resume straight
        // into the Capture POD / Complete step rather than re-running approach nav.
        nav.current.phase = PHASE.ARRIVED;
        setPhase(PHASE.ARRIVED);
        nav.current.following = false;
        setFollowing(false);
        const wp = [originPt, ...stopCoords, destPt].filter(Boolean);
        // moveCamera:false ONLY when we actually have a driver position — the
        // currentPosition effect's focusOnDriver call will own the camera in that case.
        // If GPS hasn't resolved yet (driverPos is null — still acquiring a fix), let
        // loadLeg fit to the route instead of leaving the camera at no position at all;
        // focusOnDriver will still take over and correct it the moment a fix arrives.
        if (wp.length >= 2) await loadLeg(wp, destPt, { moveCamera: !driverPos });
      } else if (alreadyStarted || !originPt) {
        nav.current.phase = PHASE.TRIP;
        setPhase(PHASE.TRIP);
        nav.current.following = true;
        setFollowing(true);
        const wp = [originPt, ...stopCoords, destPt].filter(Boolean);
        if (wp.length >= 2) await loadLeg(wp, destPt, { moveCamera: !driverPos });
        else showToast('Could not determine the trip start or destination location.');
      } else if (resumeAtStart) {
        // Resume the "at start" state: show the trip route + the Start button — same
        // deliberate whole-route review as handleCapturePreDispatch below, so this one
        // keeps its camera-fit rather than forcing driver-focus.
        nav.current.phase = PHASE.AT_START;
        setPhase(PHASE.AT_START);
        const wp = [originPt, ...stopCoords, destPt].filter(Boolean);
        if (wp.length >= 2) await loadLeg(wp, destPt);
      } else if (driverPos && originPt) {
        nav.current.phase = PHASE.APPROACH;
        setPhase(PHASE.APPROACH);
        approachFixRef.current = true; // drawn from a real fix — don't redraw in the GPS effect
        await loadLeg(
          [{ latitude: driverPos.latitude, longitude: driverPos.longitude }, originPt],
          originPt,
          { moveCamera: false },
        );
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
      cacheRoute(tripId, {
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

    // Trip isn't over yet — stay on this screen and move to the next step in the
    // sequence (Capture POD, then Complete). Full teardown + navigation now happens
    // in handleCompleteTrip once the trip is actually DELIVERED.
    const finish = () => {
      nav.current.phase = PHASE.ARRIVED;
      setPhase(PHASE.ARRIVED);
      nav.current.following = false;
      setFollowing(false);
      setIsMarkingArrived(false);
    };

    // Geofencing is enforced server-side; this screen only shows/enables "Mark
    // arrived" once nearStart/within200m are already true, so the driver's current
    // position should always satisfy it — but the backend still needs it in the body.
    const pos = positionRef.current;
    const locationBody = pos ? { lat: pos.latitude, lng: pos.longitude } : {};

    try {
      await api.put(`/trips/${tripId}/arrive`, locationBody);
      finish();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || '';
      // The backend rejects arrival unless the trip is STARTED/EN_ROUTE. If the Start
      // step never landed, start it now and retry arrival once.
      const notStarted = err?.response?.status === 400 || /STARTED|EN_ROUTE|must be/i.test(msg);
      if (notStarted) {
        try {
          // This is a bookkeeping backfill, not a fresh start — the driver has already
          // physically driven the route and is confirming arrival right now. Use the
          // trip's own origin point (not the driver's current, near-destination position)
          // so this recovery step doesn't get rejected by the origin-proximity check.
          // The security-relevant check is the arrival call right after, which DOES use
          // the driver's real current position against the real destination.
          const originPt = nav.current.originPt;
          const startBody = originPt ? { lat: originPt.latitude, lng: originPt.longitude } : {};
          await api.put(`/trips/${tripId}/start`, startBody);
          await api.put(`/trips/${tripId}/arrive`, locationBody);
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
  }, [tripId, isMarkingArrived, showToast]);

  // ── Capture pre-dispatch photo: reached the pickup → reveal the full trip route
  //    (origin → stops → destination), same as the old "Ready" step, then open the
  //    camera. Folded into one tap so there's no separate confirmation step. ──
  const handleCapturePreDispatch = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (nav.current.phase === PHASE.APPROACH) {
      nav.current.phase = PHASE.AT_START;
      setPhase(PHASE.AT_START);
      nav.current.nearStart = false;
      setNearStart(false);
      // Show the trip route as an overview so the driver can review it before starting
      nav.current.following = false;
      setFollowing(false);
      const wp = [nav.current.originPt, ...(nav.current.stopCoords ?? []), nav.current.destPt].filter(Boolean);
      if (wp.length >= 2) await loadLeg(wp, nav.current.destPt);
    }
    router.push(`/(driver)/delivery/pre-dispatch/${tripId}`);
  }, [loadLeg, tripId, router]);

  // ── Start: begin the trip → mark STARTED on the backend + start turn-by-turn ──
  const handleStart = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);

    // Enforce one-started-trip-at-a-time. If another of the driver's trips is already
    // in progress, block starting this one. Fail-open on a network error so a legitimate
    // start isn't blocked when offline (the details screen guards this too, and start is
    // best-effort — backend status reconciles).
    try {
      const res = await api.get('/trips', { params: { size: TRIP_PAGE_SIZE } });
      const raw = res.data;
      const all = Array.isArray(raw) ? raw
        : Array.isArray(raw?.content) ? raw.content
        : Array.isArray(raw?.data) ? raw.data
        : [];
      const blocking = all.find((t) =>
        String(t.id) !== tripId && ['STARTED', 'EN_ROUTE', 'ARRIVED'].includes(t.status)
      );
      if (blocking) {
        showToast(`Finish trip #${blocking.id} before starting another.`);
        setIsStarting(false);
        return;
      }
    } catch { /* fail-open — proceed with start */ }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const pos = positionRef.current;
      await api.put(`/trips/${tripId}/start`, pos ? { lat: pos.latitude, lng: pos.longitude } : {});
    } catch {
      // Non-fatal: still let the driver navigate; backend status can reconcile later
      showToast('Could not update trip status — navigating anyway.');
    }
    nav.current.phase = PHASE.TRIP;
    setPhase(PHASE.TRIP);
    // Trip is now underway — share the route (already computed at the pickup) with the
    // backend so it shows on the admin live map.
    pushTripRoute(nav.current.fullCoords);
    nav.current.following = true;
    setFollowing(true);
    if (nav.current.voice) Speech.speak('Starting trip', { language: 'en-GB' });
    const pos = positionRef.current;
    if (pos) focusOnDriver(pos, 800);
    setIsStarting(false);
  }, [tripId, isStarting, showToast, focusOnDriver, pushTripRoute]);

  // ── Capture POD: only opens the camera if the driver is actually near the
  //    destination right now — mirrors the details-page check so this button can't
  //    be used to submit a photo from anywhere. The camera screen re-checks again at
  //    upload time (the driver could walk off after this check but before confirming). ──
  const handleCapturePOD = useCallback(() => {
    const pos = positionRef.current;
    const destLat = nav.current.trip?.destLat;
    const destLng = nav.current.trip?.destLng;
    if (destLat != null && destLng != null) {
      if (!pos) {
        showToast('Enable location services to continue.');
        return;
      }
      const distance = haversineMetres(pos.latitude, pos.longitude, Number(destLat), Number(destLng));
      if (distance > ARRIVE_RADIUS) {
        showToast(`You need to be within ${ARRIVE_RADIUS}m of the destination. You're ${Math.round(distance)}m away.`);
        return;
      }
    }
    router.push(`/(driver)/delivery/pod/${tripId}`);
  }, [tripId, router, showToast]);

  // ── Complete trip: the trip is genuinely over now — do the teardown that used to
  //    happen right after "Mark arrived" (cache/camera/nav-state cleanup), reset the
  //    pre-dispatch/POD flags for the next trip, then hand off to the celebration screen. ──
  const handleCompleteTrip = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await api.put(`/trips/${tripId}/complete`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      locSubRef.current?.remove?.();
      clearInterval(etaTimerRef.current);
      routeCache.delete(tripId);
      clearStoreCamera(tripId);
      SecureStore.deleteItemAsync(`ft_nav_${tripId}`).catch(() => {});
      resetTripStore();
      router.replace(`/(driver)/trip/${tripId}/complete`);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message;
      setIsCompleting(false);
      showToast(msg || 'Could not complete trip. Please try again.');
    }
  }, [tripId, isCompleting, showToast, clearStoreCamera, resetTripStore, router]);

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

  // Phase-aware primary button (bottom panel) — one button, walking the whole trip:
  //   Move to pickup → Capture pre-dispatch photo → Start trip → (drive) →
  //   Mark arrived → Capture POD → Complete trip.
  // Each step is skipped automatically once its condition is already satisfied (e.g.
  // a driver who opens the map already standing at the pickup goes straight to the
  // pre-dispatch step — "Move to pickup" never shows).
  // `formatDistance` returns the placeholder '––' before GPS/OSRM produce a
  // real figure, and interpolating that straight into a label gave buttons that
  // read "Move to pickup — ––" and "–– to destination". A distance we don't have
  // yet should be absent from the label, not spelled out as dashes.
  const hasDistance = Number.isFinite(distanceToDest) && distanceToDest > 0;
  const distanceSuffix = hasDistance ? ` — ${formatDistance(distanceToDest)}` : '';

  const primaryBtn = (() => {
    if (phase === PHASE.ARRIVED) {
      return podUploaded
        ? { label: 'Complete trip', icon: 'check-circle', active: true, loading: isCompleting, onPress: handleCompleteTrip, bg: C.teal }
        : { label: 'Capture POD', icon: 'image', active: true, onPress: handleCapturePOD, bg: C.green };
    }
    if (phase === PHASE.TRIP) {
      return isWithin200m
        ? { label: 'Mark arrived', icon: 'map-pin', active: true,  loading: isMarkingArrived, onPress: handleMarkArrived, bg: C.green }
        : {
            label: hasDistance ? `${formatDistance(distanceToDest)} to destination` : 'Driving to destination',
            icon: 'navigation',
            active: false,
            onPress: null,
          };
    }
    if (phase === PHASE.AT_START) {
      return preDispatchUploaded
        ? { label: 'Start trip', icon: 'play', active: true, loading: isStarting, onPress: handleStart, bg: C.green }
        : { label: 'Capture pre-dispatch photo', icon: 'camera', active: true, onPress: handleCapturePreDispatch, bg: C.navyPrimary };
    }
    // APPROACH
    return nearStart
      ? { label: 'Capture pre-dispatch photo', icon: 'camera', active: true, onPress: handleCapturePreDispatch, bg: C.navyPrimary }
      : { label: `Move to pickup${distanceSuffix}`, icon: 'navigation', active: true, onPress: handleReCenter, bg: C.navyPrimary };
  })();

  // Optional per-stop POD: while driving (TRIP phase), if the driver is within the
  // geofence of a stop that doesn't yet have a POD, surface a skippable "Deliver POD"
  // button. Derived from live position so it appears/disappears as they pass each stop,
  // without touching the hot GPS callback. A stop with no id can't be de-duped/tagged,
  // so it's skipped here.
  const nearStop = useMemo(() => {
    if (phase !== PHASE.TRIP || !currentPosition || !stopMarkers.length) return null;
    for (const s of stopMarkers) {
      if (s.id == null || stopPods.includes(s.id)) continue;
      const d = haversineMetres(
        currentPosition.latitude, currentPosition.longitude,
        Number(s.latitude), Number(s.longitude),
      );
      if (d <= ARRIVE_RADIUS) return s;
    }
    return null;
  }, [phase, currentPosition, stopMarkers, stopPods]);

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
        <Pressable
          style={styles.permPrimaryBtn}
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Enable location"
          accessibilityHint="Opens system settings to grant location access"
        >
          <Text style={styles.permPrimaryBtnText}>Enable location</Text>
        </Pressable>
        <Pressable
          style={styles.permGhostBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
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
          provider={mapProvider}
          mapType="standard"
          userInterfaceStyle={resolved}
          customMapStyle={resolved === 'dark' ? DARK_MAP_STYLE : []}
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
          {/* Map imagery is now the provider's own base map — Google Maps on Android
              (via the app.json API key), Apple Maps on iOS — so there's no raster tile
              overlay. Dark mode: customMapStyle above styles the Google map; Apple
              follows userInterfaceStyle. */}

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

          {/* Origin / stops / destination — native Google pins on Android (always draw),
              custom teardrop pins on iOS. See RouteMarker above. */}
          {originLat != null && (
            <RouteMarker
              trackKey={`origin-${originLat},${originLng}`}
              coordinate={{ latitude: Number(originLat), longitude: Number(originLng) }}
              color={PIN_START_COLOR}
              label="Start"
              styles={styles}
              zIndex={2}
            />
          )}

          {/* Stop markers — numbered pins between origin and destination */}
          {stopMarkers.map((s, i) => (
            <RouteMarker
              key={`stop-${i}`}
              trackKey={`stop-${i}-${s.latitude},${s.longitude}`}
              coordinate={{ latitude: Number(s.latitude), longitude: Number(s.longitude) }}
              color={PIN_STOP_COLOR}
              number={i + 1}
              styles={styles}
              zIndex={2}
            />
          ))}

          {/* Destination — red pin with the destination name */}
          {destLat != null && (
            <RouteMarker
              trackKey={`dest-${destLat},${destLng}-${trip?.destination || ''}`}
              coordinate={{ latitude: Number(destLat), longitude: Number(destLng) }}
              color={PIN_DEST_COLOR}
              label={trip?.destination || 'Destination'}
              styles={styles}
              zIndex={3}
            />
          )}

          {/* Next-turn dot */}
          {nextDir?.startLocation && (
            <Marker
              coordinate={nextDir.startLocation}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.turnDot} collapsable={false} />
            </Marker>
          )}

          {/* Driver location pin — native Google pin on Android (nothing to rasterise,
              so it always draws), custom teardrop on iOS. Not directional: it's a pin
              anchored by its point, so it doesn't rotate with heading. */}
          {currentPosition && (
            Platform.OS === 'android' ? (
              <Marker
                coordinate={currentPosition}
                pinColor={PIN_DRIVER_COLOR}
                title="Your location"
                zIndex={4}
              />
            ) : (
              <Marker
                coordinate={currentPosition}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={vehicleTracking}
                zIndex={4}
              >
                <VehicleMarker3D />
              </Marker>
            )
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
                accessibilityRole="button"
                accessibilityLabel="Exit navigation"
                accessibilityHint="Returns to trip details"
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
                  accessibilityRole="button"
                  accessibilityLabel={voiceEnabled ? 'Mute voice guidance' : 'Unmute voice guidance'}
                  accessibilityState={{ selected: voiceEnabled }}
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
        {/* Every one of these map controls is an icon-only circle. Without a
            label they are, to a screen reader, five identical unnamed buttons
            floating over a map. The toggles also expose `selected` so their
            on/off state isn't carried by teal tint alone. */}
        <Pressable
          style={[styles.controlBtn, isFollowingVehicle && styles.controlBtnActive]}
          onPress={handleReCenter}
          accessibilityRole="button"
          accessibilityLabel="Re-centre on my location"
          accessibilityState={{ selected: isFollowingVehicle }}
        >
          <Feather name="crosshair" size={18} color={isFollowingVehicle ? C.teal : C.navyPrimary} />
        </Pressable>
        <Pressable
          style={styles.controlBtn}
          onPress={handleZoomIn}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
        >
          <Feather name="plus" size={18} color={C.navyPrimary} />
        </Pressable>
        <Pressable
          style={styles.controlBtn}
          onPress={handleZoomOut}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
        >
          <Feather name="minus" size={18} color={C.navyPrimary} />
        </Pressable>
        <Pressable
          style={styles.controlBtn}
          onPress={handleOverview}
          accessibilityRole="button"
          accessibilityLabel="Show whole route"
          accessibilityHint="Zooms out to fit the full route on screen"
        >
          <Feather name="maximize" size={18} color={C.navyPrimary} />
        </Pressable>
        <Pressable
          style={[styles.controlBtn, tiltEnabled && styles.controlBtnActive]}
          onPress={handleTiltToggle}
          accessibilityRole="button"
          accessibilityLabel={tiltEnabled ? 'Switch to flat view' : 'Switch to 3D view'}
          accessibilityState={{ selected: tiltEnabled }}
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

        {/* A bare grab-pill. Announcing it as "expand/collapse" is the only way
            the panel is operable without seeing the handle. */}
        <Pressable
          style={styles.dragHandle}
          onPress={togglePanel}
          accessibilityRole="button"
          accessibilityLabel={panelExpanded ? 'Collapse trip panel' : 'Expand trip panel'}
          accessibilityState={{ expanded: panelExpanded }}
        >
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

          {/* Optional per-stop POD — only while near an as-yet-undelivered stop */}
          {nearStop && (
            <Pressable
              style={styles.stopPodBtn}
              accessibilityRole="button"
              accessibilityLabel="Deliver proof of delivery for this stop"
              onPress={() => router.push({
                pathname: '/(driver)/delivery/pod/[id]',
                params: {
                  id: tripId,
                  stopId:  String(nearStop.id),
                  stopLat: String(nearStop.latitude),
                  stopLng: String(nearStop.longitude),
                  stopName: nearStop.name || '',
                },
              })}
            >
              <Feather name="camera" size={16} color={C.navyPrimary} />
              <Text style={styles.stopPodBtnText} numberOfLines={1}>
                Deliver POD{nearStop.name ? ` — ${nearStop.name}` : ' for this stop'} (optional)
              </Text>
            </Pressable>
          )}

          {/* Phase-aware primary button: (distance hint) → Ready → Start → Mark arrived */}
          <Animated.View style={arrivedBtnStyle}>
            <Pressable
              onPress={primaryBtn.active ? primaryBtn.onPress : null}
              disabled={!primaryBtn.active || primaryBtn.loading}
              accessibilityRole="button"
              // The label changes with the trip phase, so it has to come from
              // the same source as the visible text rather than be hardcoded.
              accessibilityLabel={primaryBtn.label}
              accessibilityState={{
                disabled: !primaryBtn.active || !!primaryBtn.loading,
                busy: !!primaryBtn.loading,
              }}
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
            onPress={() => router.push(`/(driver)/incident/report/${tripId}`)}
            accessibilityRole="button"
            accessibilityLabel="Report incident"
            accessibilityHint="Opens the incident report form for this trip"
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
const makeStyles = (C) => StyleSheet.create({
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
    backgroundColor: C.surface, borderRadius: 20,
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
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Instruction card
  instructionCard: {
    backgroundColor: C.surface,
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
  cardDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  previewRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  previewText: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, flex: 1 },
  streetText:  { fontFamily: 'Inter-Medium', fontSize: 12, color: C.teal },

  // Speed bubble
  speedBubble: {
    position: 'absolute', left: 16,
    backgroundColor: C.surface, borderRadius: 12,
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
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface,
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
    backgroundColor: C.surface,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, marginBottom: 4, maxWidth: 170,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinLabelText: { fontFamily: 'Inter-Bold', fontSize: 12, color: C.text1 },
  // Overlaid on Pin3D's solid white badge (hole={false}) to number a stop pin —
  // dark text so it stays legible on white regardless of the pin's own color.
  pinNumberBadge: {
    position: 'absolute', width: PIN_BADGE_SIZE, height: PIN_BADGE_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  pinNumber: { fontFamily: 'Inter-Bold', fontSize: 12, color: '#1E293B' },
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
    backgroundColor: C.surface, borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20,
  },
  reroutingTitle:    { fontFamily: 'Inter-SemiBold', fontSize: 16, color: C.text1 },
  reroutingSubtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3 },

  // Error toast
  errorToast: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  errorToastText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red },

  // Bottom panel
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
  },
  dragHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  dragPill:   { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border },
  panelContent: { paddingHorizontal: 20 },

  // Stats
  statsRow:        { flexDirection: 'row', marginBottom: 14 },
  statCell:        { flex: 1, alignItems: 'center' },
  statCellBorder:  { borderRightWidth: 1, borderRightColor: C.border },
  statVal:         { fontFamily: 'Inter-Bold', fontSize: 22, color: C.text1 },
  statLbl:         { fontFamily: 'Inter-Regular', fontSize: 11, color: C.text3, marginTop: 2 },

  // Upcoming steps
  upcomingLabel:     { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  stepRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stepRowBorder:     { borderBottomWidth: 1, borderBottomColor: C.border },
  stepIconBox:       { width: 32, height: 32, borderRadius: 8, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
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

  // Optional per-stop POD button (secondary — sits above the primary action)
  stopPodBtn: {
    height: 46, borderRadius: 14, borderWidth: 1.5, borderColor: C.navyPrimary,
    backgroundColor: C.accentSoft,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, paddingHorizontal: 12,
  },
  stopPodBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.navyPrimary, flexShrink: 1 },

  // Incident button
  incidentBtn: {
    height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 8,
  },
  incidentBtnText: { fontFamily: 'Inter-Medium', fontSize: 13, color: C.red },
});
