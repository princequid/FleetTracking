import { create } from 'zustand';
import mediaService from '../services/mediaService_3';

/**
 * Cache for a trip's delivery photos (pre-dispatch / POD / stop PODs).
 *
 * ## Why viewing photos was slow
 *
 * `GET /media/photos/trips/{id}` returns **a fresh presigned view URL every
 * call** — that is what the endpoint is for. A presigned URL carries its
 * signature in the query string:
 *
 *     https://…/pod-42.jpg?X-Amz-Date=20260731T101500Z&X-Amz-Expires=900&X-Amz-Signature=abc…
 *
 * React Native's `<Image>` keys its cache on the **entire URI string**. The trip
 * detail screen re-fetched the photo list on every focus, so every visit
 * produced a different `X-Amz-Date` and `X-Amz-Signature`, which meant a
 * different cache key, which meant a **complete cache miss and a full
 * re-download of every photo, every single time the screen was opened** — even
 * though the bytes were already on the device from thirty seconds earlier.
 *
 * The photos are multi-megapixel camera originals (`takePictureAsync` is called
 * with a `quality` but no size cap), and the same original backs both the ~80px
 * thumbnail and the full-screen lightbox. So each cache miss re-pulls several MB
 * over whatever signal the driver has.
 *
 * ## What this does about it
 *
 * Holds the list per trip and, when refetching, **keeps the URL string already
 * in the cache for photos we have seen before** — as long as that URL has not
 * expired. Identical string, identical cache key, image loads from disk.
 *
 * A URL is only swapped for the newly-issued one once it is close to expiring,
 * which is the one time the old string genuinely stops working.
 */

/** Refetch the list at most this often; new photos still appear promptly. */
const LIST_STALE_AFTER_MS = 30_000;

/** Replace a cached URL this long before it actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

/** If a URL carries no parseable expiry, assume this much life from first sight. */
const ASSUMED_LIFETIME_MS = 10 * 60_000;

/**
 * Reads the real expiry out of an AWS SigV4 presigned URL.
 *
 * `X-Amz-Date` is an ISO-8601 basic timestamp (20260731T101500Z) and
 * `X-Amz-Expires` is a lifetime in seconds. Parsing them means the cached URL is
 * held for exactly as long as it is valid, rather than guessing.
 */
function signedUrlExpiresAt(url) {
  try {
    const q = new URL(url).searchParams;
    const date = q.get('X-Amz-Date');
    const expires = Number(q.get('X-Amz-Expires'));
    if (!date || !Number.isFinite(expires)) return Date.now() + ASSUMED_LIFETIME_MS;

    // 20260731T101500Z -> 2026-07-31T10:15:00Z
    const iso = date.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      '$1-$2-$3T$4:$5:$6Z',
    );
    const signedAt = Date.parse(iso);
    if (Number.isNaN(signedAt)) return Date.now() + ASSUMED_LIFETIME_MS;
    return signedAt + expires * 1000;
  } catch {
    return Date.now() + ASSUMED_LIFETIME_MS;
  }
}

/**
 * Merges a freshly-fetched list over the cached one, preserving URL strings.
 *
 * This is the whole point of the store: an unchanged photo keeps byte-identical
 * `photoUrl`, so `<Image>` treats it as the same resource and serves it from
 * cache instead of re-downloading it.
 */
function mergePreservingUrls(cached, incoming) {
  const previous = new Map(cached.map((p) => [p.id, p]));
  const now = Date.now();
  let changed = cached.length !== incoming.length;

  const merged = incoming.map((photo) => {
    const old = previous.get(photo.id);
    if (old && old._expiresAt - EXPIRY_MARGIN_MS > now) {
      // Keep the URL we already handed to <Image>; take any other field updates.
      const next = { ...photo, photoUrl: old.photoUrl, _expiresAt: old._expiresAt };
      if (!changed && old.photoUrl !== next.photoUrl) changed = true;
      return next;
    }
    changed = true;
    return { ...photo, _expiresAt: signedUrlExpiresAt(photo.photoUrl) };
  });

  // Returning the previous array when nothing moved lets the screen's render
  // bail out entirely rather than rebuilding the thumbnail grid.
  return changed ? merged : cached;
}

export const useTripPhotosStore = create((set, get) => ({
  /** { [tripId]: { photos, fetchedAt, loading, inflight } } */
  byTrip: {},

  getPhotos: (tripId) => get().byTrip[String(tripId)]?.photos ?? [],
  isLoading: (tripId) => {
    const entry = get().byTrip[String(tripId)];
    // Only "loading" when there is genuinely nothing to show yet.
    return !entry || (entry.loading && entry.photos.length === 0);
  },
  /**
   * The last fetch failed AND we have nothing cached to fall back on — i.e. the
   * screen has nothing to show and it is not because the trip has no photos.
   * A failed *refresh* over a populated cache is deliberately not an error here:
   * the driver can still see their evidence, so there is nothing to interrupt.
   */
  getError: (tripId) => {
    const entry = get().byTrip[String(tripId)];
    return entry && entry.error && entry.photos.length === 0 ? entry.error : null;
  },

  fetch: async (tripId, { force = false } = {}) => {
    const key = String(tripId);
    const entry = get().byTrip[key];

    if (entry?.inflight) return entry.inflight;
    if (!force && entry && Date.now() - entry.fetchedAt < LIST_STALE_AFTER_MS) {
      return entry.photos;
    }

    const request = mediaService
      .getTripPhotos(tripId)
      .then((incoming) => {
        const current = get().byTrip[key];
        const photos = mergePreservingUrls(current?.photos ?? [], incoming);
        set((s) => ({
          byTrip: {
            ...s.byTrip,
            [key]: { photos, fetchedAt: Date.now(), loading: false, inflight: null, error: null },
          },
        }));
        return photos;
      })
      .catch((err) => {
        // Leave whatever is cached on screen — a failed refresh should not empty
        // a gallery of delivery evidence the driver can still look at.
        //
        // But DO record that it failed. Swallowing this was why "I can't see my
        // photos" was undiagnosable: the screen rendered nothing at all, which is
        // byte-for-byte what a trip with no photos looks like. A driver — and
        // anyone debugging — could not tell an outage from an empty trip.
        set((s) => ({
          byTrip: {
            ...s.byTrip,
            [key]: {
              ...(s.byTrip[key] ?? { photos: [] }),
              loading: false,
              inflight: null,
              // NOT Date.now(). Marking a failed fetch as freshly-fetched meant the
              // staleness guard above short-circuited every retry for the next 30
              // seconds, so re-opening the screen after a blip did nothing at all.
              fetchedAt: 0,
              error: err,
            },
          },
        }));
        return get().byTrip[key]?.photos ?? [];
      });

    set((s) => ({
      byTrip: {
        ...s.byTrip,
        [key]: {
          photos: entry?.photos ?? [],
          fetchedAt: entry?.fetchedAt ?? 0,
          loading: true,
          inflight: request,
          error: null,
        },
      },
    }));

    return request;
  },

  /**
   * Called right after a successful upload so the next view picks the new photo
   * up immediately instead of waiting out the staleness window.
   */
  invalidate: (tripId) =>
    set((s) => {
      const key = String(tripId);
      if (!s.byTrip[key]) return s;
      return { byTrip: { ...s.byTrip, [key]: { ...s.byTrip[key], fetchedAt: 0 } } };
    }),

  reset: () => set({ byTrip: {} }),
}));

export default useTripPhotosStore;
