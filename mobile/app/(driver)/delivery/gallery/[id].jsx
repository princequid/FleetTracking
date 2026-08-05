import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, Modal, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../../theme/ThemeContext';
import { useTripPhotosStore } from '../../../../store/tripPhotosStore';
import EmptyState from '../../../../components/common/EmptyState';
import ErrorState from '../../../../components/common/ErrorState';

/**
 * Every photo captured for one trip, full-bleed.
 *
 * This screen existed as a hardcoded "No photos yet" — it never called the API,
 * and nothing in the app linked to it, so a driver could not reach their own
 * delivery evidence for a past trip from anywhere. Both halves are fixed here:
 * it now reads the same cache the trip detail screen uses, and the detail
 * screen's photo section links to it once a trip has more than two photos.
 *
 * Reusing `useTripPhotosStore` rather than fetching directly is the point.
 * Presigned URLs are re-signed on every API call, and React Native's <Image>
 * keys its cache on the whole URI string — so a fresh fetch here would produce
 * new URLs, miss the cache, and re-download several megabytes of camera
 * originals the device already has. Through the store, the thumbnails the
 * driver just looked at on the detail screen are the same strings, already
 * resident.
 */

const PHOTO_ORDER = { PRE_DISPATCH: 1, STOP_POD: 2, POD: 3 };

const TYPE_LABEL = {
  PRE_DISPATCH: 'Pre-dispatch',
  STOP_POD: 'Stop delivery',
  POD: 'Proof of delivery',
};

const COLUMNS = 2;
const GUTTER = 12;

/** Matches the trip detail screen — see PhotoThumb there for the reasoning. */
const IMAGE_TIMEOUT_MS = 20_000;

/** Stable reference, so an unfetched trip does not hand a new [] to the selector each render. */
const EMPTY = [];

function formatTaken(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString([], {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Mirrors the detail screen's thumbnail: a spinner while the bytes arrive and a
 * muted glyph if they never do. A photo that fails to load must not render as
 * an empty box — that is indistinguishable from a layout bug.
 */
function Thumb({ uri, size, C }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // See the matching note on the detail screen's PhotoThumb: `onError` never fires
  // for a host that hangs rather than refuses, so without this the tile spins
  // indefinitely and the driver cannot tell a slow photo from a broken one.
  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => { setLoading(false); setFailed(true); }, IMAGE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading, uri]);

  return (
    <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', backgroundColor: C.border }}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        progressiveRenderingEnabled
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
      />
      {(loading || failed) && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          {failed
            ? <Feather name="image" size={20} color="rgba(255,255,255,0.5)" />
            : <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />}
        </View>
      )}
    </View>
  );
}

export default function GalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const { id } = useLocalSearchParams();
  const tripId = String(id);

  const [lightbox, setLightbox] = useState(null);

  const photos = useTripPhotosStore((s) => s.byTrip[tripId]?.photos ?? EMPTY);
  const loading = useTripPhotosStore((s) => {
    const entry = s.byTrip[tripId];
    return !entry || (entry.loading && entry.photos.length === 0);
  });
  const error = useTripPhotosStore((s) => {
    const entry = s.byTrip[tripId];
    return entry && entry.error && entry.photos.length === 0 ? entry.error : null;
  });
  const fetchPhotos = useTripPhotosStore((s) => s.fetch);

  // On focus, not on mount: the driver arrives here from the detail screen and
  // may go back, capture a photo, and return to an already-mounted instance.
  useFocusEffect(
    useCallback(() => { fetchPhotos(tripId); }, [tripId]),
  );

  const ordered = useMemo(
    () => photos
      .filter((p) => PHOTO_ORDER[p.photoType])
      .sort((a, b) => {
        const byType = PHOTO_ORDER[a.photoType] - PHOTO_ORDER[b.photoType];
        // Several stop PODs share a type, so fall back to capture time — otherwise
        // their order is whatever the API happened to return.
        if (byType !== 0) return byType;
        return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
      }),
    [photos],
  );

  const { width } = Dimensions.get('window');
  const tileSize = (width - 32 - GUTTER * (COLUMNS - 1)) / COLUMNS;

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={{ width: tileSize }}
      activeOpacity={0.85}
      onPress={() => setLightbox(item)}
      accessibilityRole="imagebutton"
      accessibilityLabel={TYPE_LABEL[item.photoType] || 'Delivery photo'}
      accessibilityHint="Opens the photo full screen"
    >
      <Thumb uri={item.photoUrl} size={tileSize} C={C} />
      <Text style={styles.caption} numberOfLines={1}>
        {TYPE_LABEL[item.photoType] || 'Photo'}
      </Text>
      {formatTaken(item.uploadedAt) && (
        <Text style={styles.captionMeta} numberOfLines={1}>{formatTaken(item.uploadedAt)}</Text>
      )}
    </TouchableOpacity>
  ), [tileSize, C, styles]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: Math.max(16, insets.top + 12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Photo Gallery</Text>
          <Text style={styles.subtitle}>
            Trip #{tripId}
            {ordered.length > 0 && ` · ${ordered.length} photo${ordered.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={C.navyPrimary} />
          <Text style={styles.centreText}>Loading photos…</Text>
        </View>
      ) : error ? (
        <ErrorState
          variant="offline"
          title="Couldn’t load photos"
          message="Your photos are still stored safely. Check your connection and try again."
          onRetry={() => fetchPhotos(tripId, { force: true })}
        />
      ) : ordered.length === 0 ? (
        <EmptyState
          icon="image"
          title="No photos for this trip"
          message="Pre-dispatch and proof-of-delivery photos captured for this trip will appear here."
        />
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: GUTTER }}
          contentContainerStyle={{ padding: 16, gap: GUTTER, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={!!lightbox}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(null)}
      >
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightbox(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          {lightbox && (
            <>
              <Image source={{ uri: lightbox.photoUrl }} style={styles.lightboxImage} resizeMode="contain" />
              <Text style={styles.lightboxLabel}>
                {TYPE_LABEL[lightbox.photoType] || 'Photo'}
                {formatTaken(lightbox.uploadedAt) ? ` · ${formatTaken(lightbox.uploadedAt)}` : ''}
              </Text>
            </>
          )}
          <Text style={styles.lightboxHint}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  header: {
    backgroundColor: C.navyDark, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#fff' },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centreText: { fontFamily: 'Inter-Medium', fontSize: 14, color: C.text3 },

  caption: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.text1, marginTop: 8 },
  captionMeta: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.text3, marginTop: 1 },

  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14,
  },
  lightboxImage: { width: '100%', height: '72%' },
  lightboxLabel: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#fff' },
  lightboxHint: { fontFamily: 'Inter-Regular', fontSize: 13, color: 'rgba(255,255,255,0.55)' },
});
