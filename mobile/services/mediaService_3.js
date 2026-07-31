import api from './api_1';
// The top-level 'expo-file-system' export deprecated getInfoAsync/readAsStringAsync/
// writeAsStringAsync in SDK 54 in favor of new File/Directory classes. The 'legacy'
// subpath keeps the exact same API this file already uses, just without the warning —
// a full migration to the new class-based API is a separate, bigger change.
import * as FileSystem from 'expo-file-system/legacy';

const QUEUE_FILE = `${FileSystem.documentDirectory}ft_upload_queue.json`;

// Hard cap on the retry queue. Every failed capture appends an entry, and entries that
// exhausted their retries were previously kept forever (see retryFailedUploads) — so a
// driver with no signal for a shift accumulated a queue that only ever grew, each entry
// pinning a fileUri into a JSON blob that is fully read and re-serialised on every
// capture and every foreground. Oldest entries are dropped first.
const MAX_QUEUE_ITEMS = 50;
const MAX_RETRIES = 3;

// Guards against overlapping retryFailedUploads() runs. It is invoked on mount AND on
// every foreground transition, and a slow run can still be mid-flight when the next one
// starts — both would read the same queue, upload the same photos twice, and the slower
// one's final writeQueue() would clobber the faster one's result.
let retryInFlight = null;

async function readQueue() {
  try {
    const info = await FileSystem.getInfoAsync(QUEUE_FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(QUEUE_FILE);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeQueue(queue) {
  try {
    // Keep only the newest MAX_QUEUE_ITEMS — an unbounded queue grows the JSON blob
    // that every capture and every foreground read/parses in full.
    const bounded = queue.length > MAX_QUEUE_ITEMS ? queue.slice(-MAX_QUEUE_ITEMS) : queue;
    await FileSystem.writeAsStringAsync(QUEUE_FILE, JSON.stringify(bounded));
  } catch {}
}

// Turns whatever fullUploadFlow threw into a message that actually says what went
// wrong (server validation error, timeout, storage-PUT failure, etc.) instead of the
// generic "check your connection" every capture screen used to show regardless of
// cause — that made a real 4xx (e.g. photo too large) indistinguishable from the
// phone genuinely being offline.
export function describeUploadError(error) {
  const apiMessage = error?.response?.data?.error || error?.response?.data?.message;
  if (apiMessage) return apiMessage;
  if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
    return 'Upload timed out — check your connection and try again.';
  }
  if (!error?.response && error?.message === 'Network Error') {
    return 'Cannot reach the server. Check your network connection.';
  }
  if (error?.message) return error.message;
  return 'Upload failed. Check your connection.';
}

export const mediaService = {
  async presignUpload(tripId, photoType, mimeType) {
    const response = await api.post('/media/presign', { tripId, photoType, mimeType });
    return response.data;
  },

  async uploadToMinio(presignedUrl, fileUri, mimeType = 'image/jpeg') {
    // Fetch the file as a binary blob — NOT base64 string
    const fileResponse = await fetch(fileUri);
    const blob = await fileResponse.blob();
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Photo upload to storage failed (${uploadResponse.status})`);
    }
    return true;
  },

  // Photos already uploaded for a trip (pre-dispatch / POD / stop PODs), each with a
  // fresh presigned view URL. The backend authorizes a DRIVER to read only their OWN trip.
  async getTripPhotos(tripId) {
    const res = await api.get(`/media/photos/trips/${tripId}`);
    return Array.isArray(res.data) ? res.data : [];
  },


  async registerPhoto(tripId, photoKey, photoType, mimeType, fileSizeBytes, lat, lng, takenAt, stopId) {
    const response = await api.post('/media/photos', {
      tripId, stopId, photoKey, photoType, mimeType, fileSizeBytes, lat, lng, takenAt,
    });
    return response.data;
  },

  // Main entry point called by camera screens.
  // onProgress: ({ step: string, percent: number }) => void
  // options.stopId: set only for an (optional) STOP_POD captured at an intermediate stop.
  async fullUploadFlow(tripId, photoType, fileUri, location, onProgress, options = {}) {
    const { stopId = null } = options;
    try {
      onProgress?.({ step: 'Preparing upload...', percent: 10 });

      // Step 1 — presign
      const { uploadUrl, photoKey } = await this.presignUpload(tripId, photoType, 'image/jpeg');
      onProgress?.({ step: 'Uploading photo...', percent: 45 });

      // Step 2 — upload binary to MinIO
      await this.uploadToMinio(uploadUrl, fileUri);
      onProgress?.({ step: 'Verifying...', percent: 80 });

      // Step 3 — register with SHA-256 hash
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const { latitude, longitude } = location || {};
      const result = await this.registerPhoto(
        tripId, photoKey, photoType, 'image/jpeg',
        fileInfo.size || 0, latitude, longitude, new Date().toISOString(), stopId,
      );

      onProgress?.({ step: 'Complete', percent: 100 });
      return { success: true, photoKey, photo: result };
    } catch (error) {
      // Save to offline queue so we can retry later
      try {
        const queue = await readQueue();
        queue.push({
          tripId, photoType, fileUri, stopId,
          lat: location?.latitude, lng: location?.longitude,
          takenAt: new Date().toISOString(),
          retryCount: 0,
        });
        await writeQueue(queue);
      } catch {}
      throw error;
    }
  },

  async retryFailedUploads() {
    // Single-flight: a second caller joins the run already in progress instead of
    // starting a competing one over the same queue.
    if (retryInFlight) return retryInFlight;
    retryInFlight = (async () => {
      const queue = await readQueue();
      if (!queue.length) return;

      const remaining = [];
      for (const item of queue) {
        // Retries exhausted — stop attempting, but KEEP the entry. These are POD /
        // pre-dispatch photos and dropping one silently destroys delivery evidence.
        // MAX_QUEUE_ITEMS is what bounds the file; see the note in retryFailedUploads'
        // caller about surfacing these to the driver instead of stranding them here.
        if ((item.retryCount || 0) >= MAX_RETRIES) {
          remaining.push(item);
          continue;
        }
        try {
          await this.fullUploadFlow(
            item.tripId, item.photoType, item.fileUri,
            item.lat ? { latitude: item.lat, longitude: item.lng } : null,
            null,
            { stopId: item.stopId ?? null },
          );
        } catch {
          remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
        }
      }
      // Authoritative rewrite: fullUploadFlow's own catch re-appended each failed item
      // to the file as it went, so this overwrite is what keeps the queue from doubling.
      await writeQueue(remaining);
    })().finally(() => { retryInFlight = null; });
    return retryInFlight;
  },
};

export default mediaService;
