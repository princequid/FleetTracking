import api from './api_1';
import * as FileSystem from 'expo-file-system';

const QUEUE_FILE = `${FileSystem.documentDirectory}ft_upload_queue.json`;

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
    await FileSystem.writeAsStringAsync(QUEUE_FILE, JSON.stringify(queue));
  } catch {}
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
    const queue = await readQueue();
    if (!queue.length) return;

    const remaining = [];
    for (const item of queue) {
      if (item.retryCount >= 3) {
        remaining.push(item); // give up after 3 tries
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
    await writeQueue(remaining);
  },
};

export default mediaService;
