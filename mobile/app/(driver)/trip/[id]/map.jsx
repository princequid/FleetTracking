import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

const ARRIVE_RADIUS = 200;
const OSRM_BASE     = 'http://172.20.10.4:5000';
const REROUTE_DIST  = 80;  // metres off-route before rerouting

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

function formatEta(etaDate) {
  if (!etaDate) return '--';
  const mins = Math.round((etaDate - Date.now()) / 60000);
  if (mins < 1)  return '< 1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
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

// ─── Parse OSRM steps into direction objects ──────────────────────────────────
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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LiveMapScreen() {
  const router   = useRouter();
  const { id: tripId } = useLocalSearchParams();
  const insets   = useSafeAreaInsets();
  const mapRef   = useRef(null);

  // Refs that the GPS callback reads (avoids stale closures)
  const nav = useRef({
    following:        true,
    voice:            true,
    directions:       [],
    stepIndex:        0,
    fullCoords:       [],
    completedCoords:  [],
    trip:             null,
    within200m:       false,
  });
  const locSubRef        = useRef(null);
  const isReroutingRef   = useRef(false);
  const lastSpokenStep   = useRef(-1);
  const spokenThresholds = useRef(new Set()); // "stepIdx_threshold"
  const mapReadyRef      = useRef(false);
  const pendingFitRef    = useRef(null);

  // ── State (for rendering) ──
  const [trip,                 setTrip]           = useState(null);
  const [fullRouteCoords,      setFullRoute]       = useState([]);
  const [completedRouteCoords, setCompleted]       = useState([]);
  const [directions,           setDirections]      = useState([]);
  const [currentStepIndex,     setStepIndex]       = useState(0);
  const [currentPosition,      setPosition]        = useState(null);
  const [currentHeading,       setHeading]         = useState(0);
  const [currentSpeed,         setSpeed]           = useState(0);
  const [distanceToNextTurn,   setDistNextTurn]    = useState(0);
  const [distanceToDest,       setDistDest]        = useState(0);
  const [eta,                  setEta]             = useState(null);
  const [isWithin200m,         setWithin200m]      = useState(false);
  const [isRerouting,          setIsRerouting]     = useState(false);
  const [isMarkingArrived,     setIsMarkingArrived]= useState(false);
  const [isFollowingVehicle,   setFollowing]       = useState(true);
  const [panelExpanded,        setPanelExpanded]   = useState(false);
  const [voiceEnabled,         setVoice]           = useState(true);
  const [permissionDenied,     setPermDenied]      = useState(false);
  const [errorToast,           setErrorToast]      = useState('');

  // Keep nav ref in sync with state
  useEffect(() => { nav.current.following = isFollowingVehicle; }, [isFollowingVehicle]);
  useEffect(() => { nav.current.voice     = voiceEnabled; },      [voiceEnabled]);

  // ── Reanimated shared values ──
  const markerHeading    = useSharedValue(0);
  const panelH           = useSharedValue(180 + insets.bottom);
  const reroutingOpacity = useSharedValue(0);
  const arrivedPulse     = useSharedValue(1);
  const pulseScale       = useSharedValue(1);
  const pulseOpacity     = useSharedValue(0.6);
  const cardEntrance     = useSharedValue(0);
  const toastOpacity     = useSharedValue(0);

  // ── Animated styles ──
  const pulsingRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity:   pulseOpacity.value,
  }));
  const arrivedBtnStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: arrivedPulse.value }],
  }));
  const panelStyle       = useAnimatedStyle(() => ({
    height: panelH.value,
    overflow: 'hidden',
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
      duration: 350,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, []);

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

  // ── Error toast helper ──
  const showToast = useCallback((msg) => {
    setErrorToast(msg);
    toastOpacity.value = withTiming(1, { duration: 200 });
    setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 300 }, () => {});
      setTimeout(() => setErrorToast(''), 300);
    }, 3000);
  }, []);

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

  // ── Fetch OSRM directions ──
  const fetchOsrm = useCallback(async (oLat, oLng, dLat, dLng) => {
    try {
      const url = `${OSRM_BASE}/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?steps=true&geometries=geojson&overview=full`;
      const res = await fetch(url);
      if (!res.ok) return { steps: [], overviewCoords: [] };
      const data = await res.json();
      const steps    = data?.routes?.[0]?.legs?.[0]?.steps ?? [];
      const overview = data?.routes?.[0]?.geometry?.coordinates ?? [];
      return {
        steps: parseOsrmSteps(steps),
        overviewCoords: overview.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
      };
    } catch {
      return { steps: [], overviewCoords: [] };
    }
  }, []);

  // ── Map fit helpers ──
  // Call fitToCoordinates safely whether map is ready yet or not
  const fitToRoute = useCallback((coords) => {
    if (!coords || coords.length < 2) return;
    if (mapReadyRef.current && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 140, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
    } else {
      // Map not mounted yet — store and apply when onMapReady fires
      pendingFitRef.current = coords;
    }
  }, []);

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

  // ── Rerouting ──
  const triggerReroute = useCallback(async (lat, lng) => {
    if (isReroutingRef.current) return;
    isReroutingRef.current = true;
    setIsRerouting(true);
    reroutingOpacity.value = withTiming(1, { duration: 200 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (nav.current.voice) Speech.speak('Rerouting', { language: 'en' });

    try {
      const t = nav.current.trip;
      const { destLat, destLng } = extractCoords(t);
      if (destLat == null) return;
      const { steps, overviewCoords } = await fetchOsrm(lat, lng, destLat, destLng);
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
    const speedKmh = Math.max(0, (speed || 0) * 3.6);
    const dirs      = nav.current.directions;
    const fullCoords = nav.current.fullCoords;
    const t         = nav.current.trip;

    // Update marker heading smoothly
    markerHeading.value = withTiming(heading || 0, { duration: 500 });
    setPosition({ latitude, longitude });
    setHeading(heading || 0);
    setSpeed(speedKmh);

    // Camera follow
    if (nav.current.following) {
      mapRef.current?.animateCamera(
        { center: { latitude, longitude }, heading: heading || 0, pitch: 45, zoom: 17 },
        { duration: 800 },
      );
    }

    // GPS ping — fire and forget
    api.post(`/gps/trips/${tripId}/ping`, {
      lat:       latitude,
      lng:       longitude,
      speedKmh:  Math.round(speedKmh),
      heading:   Math.round(heading || 0),
      accuracyM: Math.round(accuracy || 0),
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

      // Distance to next turn + voice thresholds
      const nextStep = dirs[newIdx + 1];
      if (nextStep?.startLocation) {
        const d = haversineMetres(latitude, longitude, nextStep.startLocation.latitude, nextStep.startLocation.longitude);
        setDistNextTurn(d);
        checkVoiceThresholds(d, newIdx, dirs);
      }
    }

    // ── Distance to destination ──
    if (t) {
      const { destLat, destLng } = extractCoords(t);
      if (destLat != null) {
        const destDist = haversineMetres(latitude, longitude, destLat, destLng);
        setDistDest(destDist);
        const speedMs = Math.max(8.33, speedKmh / 3.6);
        setEta(new Date(Date.now() + (destDist / speedMs) * 1000));
        if (destDist < ARRIVE_RADIUS && !nav.current.within200m) {
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
      // ① Kick off permission + trip fetch in parallel — don't wait for one before the other
      const [permResult, tripResult] = await Promise.allSettled([
        Location.requestForegroundPermissionsAsync(),
        api.get(`/trips/${tripId}`),
      ]);

      // Permission check
      if (
        permResult.status === 'rejected' ||
        permResult.value?.status !== 'granted'
      ) {
        setPermDenied(true);
        return;
      }

      // Trip data check
      if (tripResult.status === 'rejected') {
        showToast('Could not load trip data. Please go back and try again.');
        return;
      }
      const tripData = tripResult.value.data;
      nav.current.trip = tripData;
      setTrip(tripData);

      // ② Parse and show stored route geometry IMMEDIATELY — no waiting for OSRM
      const storedCoords = parseRoute(tripData.routeGeometry);
      if (storedCoords.length >= 2) {
        nav.current.fullCoords = storedCoords;
        setFullRoute(storedCoords);
        fitToRoute(storedCoords); // fires as soon as map is ready (onMapReady handles timing)
      }

      // ③ Fetch OSRM directions + initial GPS position in parallel
      const { originLat, originLng, destLat, destLng } = extractCoords(tripData);
      const [osrmResult, posResult] = await Promise.allSettled([
        originLat != null && destLat != null
          ? fetchOsrm(originLat, originLng, destLat, destLng)
          : Promise.resolve({ steps: [], overviewCoords: [] }),
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      ]);

      // Apply OSRM directions (upgrades turn instructions and may refine route line)
      if (osrmResult.status === 'fulfilled') {
        const { steps, overviewCoords } = osrmResult.value;
        if (steps.length) {
          nav.current.directions = steps;
          setDirections(steps);
          // If OSRM returned a higher-resolution overview, use it
          if (overviewCoords.length > storedCoords.length) {
            nav.current.fullCoords = overviewCoords;
            setFullRoute(overviewCoords);
          }
        }
      }

      // Apply initial GPS position
      if (posResult.status === 'fulfilled') {
        const { latitude, longitude, heading, speed } = posResult.value.coords;
        setPosition({ latitude, longitude });
        setHeading(heading || 0);
        setSpeed(Math.max(0, (speed || 0) * 3.6));
      }

      // ④ Start live GPS watch
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1500, distanceInterval: 5 },
        onPositionUpdate,
      );
      locSubRef.current = sub;
    })();

    return () => {
      locSubRef.current?.remove?.();
      Speech.stop();
    };
  }, [tripId]);

  // ── Mark arrived ──
  const handleMarkArrived = useCallback(async () => {
    if (isMarkingArrived) return;
    setIsMarkingArrived(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (nav.current.voice) Speech.speak('You have arrived', { language: 'en-GB' });
    locSubRef.current?.remove?.();
    Speech.stop();
    try {
      await api.put(`/trips/${tripId}/arrive`);
      router.replace(`/(driver)/trip/${tripId}_2`);
    } catch {
      setIsMarkingArrived(false);
      showToast('Could not confirm arrival. Please try again.');
    }
  }, [tripId, isMarkingArrived, showToast]);

  // ── Re-centre ──
  const handleReCenter = useCallback(() => {
    if (!currentPosition) return;
    setFollowing(true);
    mapRef.current?.animateCamera(
      { center: currentPosition, heading: currentHeading, pitch: 45, zoom: 17 },
      { duration: 500 },
    );
  }, [currentPosition, currentHeading]);

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
  const curDir  = directions[currentStepIndex];
  const nextDir = directions[currentStepIndex + 1];
  const nextNextDir = directions[currentStepIndex + 2];
  const remainingCoords = fullRouteCoords.slice(completedRouteCoords.length);

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
    <View style={{ flex: 1 }}>

      {/* ── Full-screen map ── */}
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
        onMapReady={onMapReady}
        onPanDrag={() => setFollowing(false)}
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          tileSize={256}
          shouldReplaceMapContent
        />

        {/* Driven segment — gray */}
        {completedRouteCoords.length > 1 && (
          <Polyline
            coordinates={completedRouteCoords}
            strokeColor="rgba(107,114,128,0.45)"
            strokeWidth={5}
            lineCap="round"
          />
        )}

        {/* Remaining route — shadow */}
        {remainingCoords.length > 1 && (
          <Polyline
            coordinates={remainingCoords}
            strokeColor="rgba(27,58,107,0.15)"
            strokeWidth={10}
            lineCap="round"
          />
        )}

        {/* Remaining route — main line */}
        {remainingCoords.length > 1 && (
          <Polyline
            coordinates={remainingCoords}
            strokeColor={C.navyPrimary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Origin dot */}
        {originLat != null && (
          <Marker
            coordinate={{ latitude: originLat, longitude: originLng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.originDot} />
          </Marker>
        )}

        {/* Destination — teardrop with label */}
        {destLat != null && (
          <Marker
            coordinate={{ latitude: destLat, longitude: destLng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={styles.destLabel}>
                <Text style={styles.destLabelText} numberOfLines={1}>
                  {trip?.destination || 'Destination'}
                </Text>
              </View>
              <View style={styles.destDot} />
              <View style={styles.destStem} />
            </View>
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

        {/* Vehicle marker */}
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

      {/* ── Top instruction card ── */}
      <View style={[styles.topSafe, { paddingTop: insets.top + 8 }]}>
        <Animated.View style={[styles.instructionCard, cardStyle]}>
          {/* Direction icon + text + voice toggle */}
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

          {/* Next-next step preview */}
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

      {/* ── Speed bubble ── */}
      <View style={[styles.speedBubble, { top: insets.top + 140 }]}>
        <Text style={styles.speedVal}>{Math.round(currentSpeed)}</Text>
        <Text style={styles.speedUnit}>KM/H</Text>
      </View>

      {/* ── Re-centre button ── */}
      {!isFollowingVehicle && (
        <Pressable
          onPress={handleReCenter}
          style={[styles.recenterBtn, { top: insets.top + 140 }]}
        >
          <Feather name="crosshair" size={20} color={C.navyPrimary} />
        </Pressable>
      )}

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

        {/* Drag handle */}
        <Pressable style={styles.dragHandle} onPress={togglePanel}>
          <View style={styles.dragPill} />
        </Pressable>

        <View style={styles.panelContent}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statVal}>{formatEta(eta)}</Text>
              <Text style={styles.statLbl}>ETA</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statVal}>{formatDistance(distanceToDest)}</Text>
              <Text style={styles.statLbl}>Remaining</Text>
            </View>
            <View style={[styles.statCell, { flex: 1.2 }]}>
              <Text style={[styles.statVal, { fontSize: 13, color: C.teal, textAlign: 'center' }]} numberOfLines={2}>
                {trip?.destination || 'Destination'}
              </Text>
              <Text style={styles.statLbl}>Destination</Text>
            </View>
          </View>

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

          {/* Mark arrived button */}
          <Animated.View style={arrivedBtnStyle}>
            <Pressable
              onPress={isWithin200m ? handleMarkArrived : null}
              disabled={!isWithin200m || isMarkingArrived}
              style={[
                styles.arriveBtn,
                {
                  backgroundColor: isWithin200m ? C.green : C.border,
                  shadowColor: isWithin200m ? C.green : 'transparent',
                  shadowOpacity: isWithin200m ? 0.35 : 0,
                },
              ]}
            >
              {isMarkingArrived ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather
                    name={isWithin200m ? 'map-pin' : 'navigation'}
                    size={18}
                    color={isWithin200m ? '#fff' : '#9CA3AF'}
                  />
                  <Text style={[styles.arriveBtnText, { color: isWithin200m ? '#fff' : '#9CA3AF' }]}>
                    {isWithin200m
                      ? 'Mark arrived'
                      : `${formatDistance(distanceToDest)} to destination`}
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

  // Markers
  originDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: C.green, borderWidth: 2.5, borderColor: '#fff',
  },
  destLabel: {
    backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, marginBottom: 4, maxWidth: 160,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  destLabelText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text1 },
  destDot:       { width: 18, height: 18, borderRadius: 9, backgroundColor: C.red, borderWidth: 3, borderColor: '#fff' },
  destStem:      { width: 3, height: 8, backgroundColor: C.red, borderRadius: 1.5, marginTop: -1 },
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

  // Top instruction card
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  instructionCard: {
    backgroundColor: '#fff', marginHorizontal: 12,
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
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
  },
  speedVal:  { fontFamily: 'Inter-Bold', fontSize: 20, color: C.text1 },
  speedUnit: { fontFamily: 'Inter-Regular', fontSize: 9, color: C.text3, letterSpacing: 0.5 },

  // Re-centre
  recenterBtn: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
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
  upcomingLabel:    { fontFamily: 'Inter-SemiBold', fontSize: 11, color: C.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  stepRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stepRowBorder:    { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  stepIconBox:      { width: 32, height: 32, borderRadius: 8, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  stepIconBoxActive:{ backgroundColor: C.navyPrimary },
  stepInstruction:  { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3 },
  stepDist:         { fontFamily: 'Inter-Medium', fontSize: 12, color: C.text3, marginLeft: 8 },

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
