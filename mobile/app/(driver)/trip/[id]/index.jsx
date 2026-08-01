import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated, Easing, Image, Modal, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../../../services/api_1';
import { mediaService } from '../../../../services/mediaService_3';
import { useTheme } from '../../../../theme/ThemeContext';
import { TRIP_PAGE_SIZE } from '../../../../constants/config';

// Delivery-photo types shown on the trip, in capture order (incident/profile excluded).
const PHOTO_ORDER = { PRE_DISPATCH: 1, STOP_POD: 2, POD: 3 };

function labelForPhoto(photo, trip) {
  if (photo.photoType === 'STOP_POD') {
    const idx = trip?.stops?.findIndex((s) => s.id === photo.stopId);
    if (idx != null && idx >= 0) {
      const name = trip.stops[idx].name;
      return `Stop ${idx + 1}${name ? ` — ${name}` : ''}`;
    }
    return 'Stop delivery';
  }
  if (photo.photoType === 'PRE_DISPATCH') return 'Pre-dispatch';
  if (photo.photoType === 'POD') return 'Proof of delivery';
  return 'Photo';
}

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

/**
 * How far the trip got, and what it's doing now — two separate questions.
 *
 * These used to be one number, with everything unrecognised falling through to
 * `return 4`. CANCELLED hit that fallback, so a cancelled trip rendered
 * identically to a delivered one: four green ticks reading "Completed" under a
 * delivery that never happened.
 *
 * `doneCount` is how many steps genuinely completed. `activeIndex` is the step
 * in progress, or -1 when the trip is over — a finished trip has no current
 * step, whether it finished well or not.
 */
function tripProgress(trip) {
  const status = trip?.status;

  if (status === 'CANCELLED') {
    // Once cancelled, `status` no longer records how far the driver got, so the
    // timestamps are the only honest source. When they're missing we claim
    // nothing was done — the safe direction to be wrong in, since overstating
    // progress is what caused this bug.
    let done = 0;
    if (trip?.startedAt) done = 2;                       // pre-dispatch + started
    if (trip?.arrivedAt) done = 3;                       // + arrived
    return { doneCount: done, activeIndex: -1, cancelled: true };
  }

  // A delivered trip has every step behind it, including the last one. The old
  // code left "Complete trip" showing as the *current* step forever.
  if (status === 'DELIVERED') {
    return { doneCount: STEPS.length, activeIndex: -1, cancelled: false };
  }

  let step = 0;
  if (status === 'STARTED' || status === 'EN_ROUTE' || status === 'REROUTED') step = 1;
  else if (status === 'ARRIVED') step = 2;

  return { doneCount: step, activeIndex: step, cancelled: false };
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

function StepCard({ step, index, activeIndex, doneCount, cancelled, styles, C }) {
  const isDone   = index < doneCount;
  // activeIndex is -1 for a finished trip, so nothing pulses or claims to be
  // "current" once the trip is over.
  const isActive = index === activeIndex;
  // A step that never happened on a cancelled trip is not "locked, coming up" —
  // it's never going to happen. Rendered muted rather than pending.
  const abandoned = cancelled && !isDone;
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
  const locked = !isDone && !isActive;

  /**
   * Upcoming steps used to be dimmed with `opacity: 0.4`, which put the label at
   * 2.14:1 in dark mode and 1.70:1 in light — both far under the 4.5:1 AA floor
   * for 14px text, and visibly unreadable on a phone in daylight.
   *
   * The de-emphasis now comes from colour choice instead: C.text3 at full
   * opacity measures 6.20:1 dark / 4.83:1 light, still clearly quieter than the
   * green "done" and navy "current" rows but actually legible. Opacity is the
   * wrong tool for hierarchy when it drags contrast below the floor.
   */
  const numberColor = locked ? C.text2 : '#fff';

  return (
    <Animated.View
      style={[styles.stepCard, { backgroundColor: bg, transform: [{ scale: breathe }] }]}
      accessible
      accessibilityRole="text"
      // One announcement per step, including its state — a screen reader user
      // can't see the green tick or the muted badge.
      accessibilityLabel={
        `Step ${index + 1}: ${step.label}. ` +
        (isDone ? 'Completed.'
          : isActive ? 'Current step.'
          : abandoned ? 'Not completed — trip was cancelled.'
          : 'Not yet available.')
      }
    >
      <View style={[
        styles.stepBadge,
        isDone   ? styles.stepBadgeDone   :
        isActive ? styles.stepBadgeActive : styles.stepBadgeLocked,
      ]}>
        {isDone
          ? <Feather name="check" size={14} color="#fff" />
          // White on the locked badge (C.border) was near-invisible in light
          // mode; text2 reads on both the light and dark border fills.
          : <Text style={[styles.stepNum, { color: numberColor }]}>{index + 1}</Text>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepLabel, { color: isDone ? C.green : isActive ? C.navyPrimary : C.text3 }]}>
          {step.label}
        </Text>
        {isDone    && <Text style={styles.stepDoneText}>Completed</Text>}
        {isActive  && <Text style={styles.stepActiveText}>Current step</Text>}
        {abandoned && <Text style={styles.stepAbandonedText}>Not completed</Text>}
      </View>
      <Feather name={step.icon} size={18} color={isDone ? C.green : isActive ? C.navyPrimary : C.text3} />
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
const EMPTY_PHOTOS = [];

/**
 * Thumbnail with its own loading state.
 *
 * These are full-resolution camera originals — `takePictureAsync` is called with
 * a `quality` but no size cap — so even an 88px thumbnail pulls the whole file.
 * Until they're resized server-side or at capture (see the note in the report),
 * the least this can do is look like it is loading rather than looking broken.
 *
 * `progressiveRenderingEnabled` lets Android paint a progressive JPEG as it
 * streams instead of waiting for the final byte. It is a no-op on iOS and on
 * baseline JPEGs, so it costs nothing where it doesn't apply.
 */
const PhotoThumb = React.memo(function PhotoThumb({ uri, style, placeholderColor }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <View style={style}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        progressiveRenderingEnabled
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
      />
      {(loading || failed) && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: placeholderColor }]}>
          {failed
            ? <Feather name="image" size={18} color="rgba(255,255,255,0.5)" />
            : <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />}
        </View>
      )}
    </View>
  );
});

export default function TripDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams();
  const tripId = String(id);

  const [trip, setTrip] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  // Another of the driver's trips that's already in progress (started but not finished).
  // Only one trip may be STARTED at a time, so an ASSIGNED trip can't be started while
  // this is set — the driver can still view it, just not move to pickup / start it.
  const [otherActiveTrip, setOtherActiveTrip] = useState(null);

  // A stable empty array, so an unfetched trip doesn't hand a new `[]` to the
  // selector on every render and force a re-render each time.
  const photos = useTripPhotosStore((s) => s.byTrip[String(tripId)]?.photos ?? EMPTY_PHOTOS);
  const photosLoading = useTripPhotosStore((s) => {
    const entry = s.byTrip[String(tripId)];
    // Only a genuine first load counts as loading; a background refresh keeps
    // the existing thumbnails on screen.
    return !entry || (entry.loading && entry.photos.length === 0);
  });
  const fetchPhotos = useTripPhotosStore((s) => s.fetch);

  // Re-fetch the trip + its photos every time this screen comes into focus, not just on
  // mount — the driver reaches this screen via back-navigation from the live-nav map
  // after capturing a pre-dispatch/POD photo, so the screen instance is already mounted
  // and a mount-only effect would keep showing the stale (pre-upload) photo list.
  useFocusEffect(
    useCallback(() => {
      api.get(`/trips/${tripId}`)
        .then((r) => setTrip(r.data))
        .catch(() => {});

      // Photos come from the cache. It still refetches when the list is stale or
      // right after an upload, but it reuses the presigned URL strings it already
      // handed to <Image>, so the images resolve from the device cache instead of
      // being re-downloaded on every visit. See tripPhotosStore for why that
      // mattered so much here.
      fetchPhotos(tripId);
    }, [tripId]),
  );

  useEffect(() => {
    // /trips is scoped to the signed-in driver server-side, so this only sees their trips.
    api.get('/trips', { params: { size: TRIP_PAGE_SIZE } })
      .then((r) => {
        const raw = r.data;
        const all = Array.isArray(raw) ? raw
          : Array.isArray(raw?.content) ? raw.content
          : Array.isArray(raw?.data) ? raw.data
          : [];
        const other = all.find((t) =>
          String(t.id) !== tripId && ['STARTED', 'EN_ROUTE', 'ARRIVED'].includes(t.status)
        );
        setOtherActiveTrip(other || null);
      })
      .catch(() => {});
  }, [tripId]);

  const { doneCount, activeIndex, cancelled } = tripProgress(trip);
  const canOpenNav = trip && !['DELIVERED', 'CANCELLED'].includes(trip.status);
  // Block starting THIS trip only while it's still ASSIGNED and another trip is running.
  // Once this trip is itself the active one, the button becomes "Continue navigation".
  const blockedByOtherTrip = trip?.status === 'ASSIGNED' && !!otherActiveTrip;

  // Delivery photos to show, ordered pre-dispatch → stop PODs → destination POD.
  // Memoised: it feeds the prefetch effect below, and an array rebuilt on every
  // render would re-trigger that effect on every render.
  const displayPhotos = useMemo(
    () => photos
      .filter((p) => PHOTO_ORDER[p.photoType])
      .sort((a, b) => PHOTO_ORDER[a.photoType] - PHOTO_ORDER[b.photoType]),
    [photos],
  );


  useEffect(() => {
    // Prefetch uses the same URL string as <Image>, and those strings are now
    // stable across visits — so this warms exactly the entry the lightbox will
    // ask for, instead of a URL that has already been re-signed.
    displayPhotos.forEach((photo) => {
      if (photo.photoUrl) Image.prefetch(photo.photoUrl).catch(() => {});
    });
  }, [displayPhotos]);

  const navButtonLabel = (() => {
    if (!trip) return 'Open live navigation';
    if (trip.status === 'ASSIGNED') return 'Move to pickup';
    if (trip.status === 'STARTED' || trip.status === 'EN_ROUTE') return 'Continue navigation';
    if (trip.status === 'ARRIVED') return 'Continue to complete trip';
    return 'Open live navigation';
  })();

  return (
    <View style={{ flex: 1, backgroundColor: C.navyDark }}>
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top + 12) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
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
          {/* Icon-only, so without a label it announces as nothing at all. */}
          <TouchableOpacity
            style={styles.expandBtn}
            accessibilityRole="button"
            accessibilityLabel="Expand map"
            accessibilityHint="Opens the full-screen navigation map"
            onPress={() => router.push({ pathname: '/(driver)/trip/[id]/map', params: { id: tripId } })}
          >
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

          {/* Stated once, plainly, above the steps. Without this the only cue
              that a trip was cancelled is the absence of ticks — too subtle for
              something this consequential. */}
          {cancelled && (
            <View
              style={styles.cancelledBanner}
              accessible
              accessibilityRole="alert"
              accessibilityLabel="This trip was cancelled and was not completed."
            >
              <Feather name="x-circle" size={16} color={C.red} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelledTitle}>Trip cancelled</Text>
                <Text style={styles.cancelledSub}>
                  {doneCount > 0
                    ? 'The remaining steps were not completed.'
                    : 'This trip was cancelled before it started.'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.stepsCol}>
            {STEPS.map((step, i) => (
              <StepCard
                key={step.key}
                step={step}
                index={i}
                activeIndex={activeIndex}
                doneCount={doneCount}
                cancelled={cancelled}
                styles={styles}
                C={C}
              />
            ))}
          </View>
        </View>

        {displayPhotos.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>DELIVERY PHOTOS</Text>
            <View style={styles.photosRow}>
              {displayPhotos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  activeOpacity={0.85}
                  onPress={() => setLightboxPhoto(photo)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={photo.caption || photo.type || 'Delivery photo'}
                  accessibilityHint="Opens the photo full screen"
                >
                  <PhotoThumb
                    uri={photo.photoUrl}
                    style={styles.photoThumb}
                    placeholderColor={C.border}
                  />
                  <Text style={styles.photoCaption} numberOfLines={1}>
                    {labelForPhoto(photo, trip)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {canOpenNav && (
          blockedByOtherTrip ? (
            <View>
              <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                <Feather name="lock" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
                <Text style={[styles.actionBtnText, { color: '#9CA3AF' }]}>Finish your active trip first</Text>
              </View>
              <Text style={styles.blockedHint}>
                You already have trip #{otherActiveTrip.id} in progress. You can view this trip’s
                details, but you can only start one trip at a time.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push({ pathname: '/(driver)/trip/[id]/map', params: { id: tripId, focus: 'driver' } })}
              accessibilityRole="button"
              accessibilityLabel={navButtonLabel}
              accessibilityHint="Opens turn-by-turn navigation"
            >
              <Feather name="navigation" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>{navButtonLabel}</Text>
            </TouchableOpacity>
          )
        )}

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Having a problem?</Text>
          <Text style={styles.dangerSub}>Report any issues or incidents during this trip</Text>
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => router.push(`/(driver)/incident/report/${tripId}`)}
            accessibilityRole="button"
            accessibilityLabel="Report incident"
            accessibilityHint="Opens the incident report form for this trip"
          >
            <Text style={styles.reportBtnText}>Report incident</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Tap-to-enlarge lightbox */}
      <Modal
        visible={!!lightboxPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxPhoto(null)}
      >
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightboxPhoto(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          accessibilityHint="Returns to the trip details"
        >
          {lightboxPhoto && (
            <Image
              source={{ uri: lightboxPhoto.photoUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.lightboxHint}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </View>
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
  // Muted, not red: the step didn't fail, it simply never happened. Red here
  // would read as five errors instead of one cancelled trip.
  stepAbandonedText: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, marginTop: 2 },

  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: C.redLight,
    borderWidth: 1,
    borderColor: C.red,
  },
  cancelledTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.red },
  cancelledSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text2, marginTop: 2 },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: C.teal, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.teal, shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  actionBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff', letterSpacing: -0.2 },
  actionBtnDisabled: { backgroundColor: C.border, shadowOpacity: 0, elevation: 0 },
  blockedHint: {
    fontFamily: 'Inter-Regular', fontSize: 12.5, color: C.text3,
    textAlign: 'center', lineHeight: 18, marginTop: 8, paddingHorizontal: 8,
  },

  /* Delivery photos */
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoItem: {
    width: (width - 32 - 20) / 3, // 3 across within the 16px page padding + 10px gaps
    backgroundColor: C.surface, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
  },
  photoThumb: { width: '100%', height: 88, backgroundColor: C.border },
  photoCaption: {
    fontFamily: 'Inter-Medium', fontSize: 11, color: C.text2,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  lightboxImage: { width: '92%', height: '75%' },
  lightboxHint: { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  dangerCard: { backgroundColor: C.redLight, borderWidth: 1, borderColor: C.redLight, borderRadius: 14, padding: 16, gap: 4 },
  dangerTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.text1 },
  dangerSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: C.text3, marginBottom: 10 },
  reportBtn: { borderWidth: 1.5, borderColor: C.red, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  reportBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: C.red },
});
