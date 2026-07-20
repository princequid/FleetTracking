import api from './api_1';
// See mediaService_3.js — the legacy subpath keeps the same getInfoAsync/readAsStringAsync/
// writeAsStringAsync API this file uses, without the top-level export's deprecation warning.
import * as FileSystem from 'expo-file-system/legacy';

const PING_QUEUE_FILE = `${FileSystem.documentDirectory}ft_offline_pings.json`;

async function readPingQueue() {
  try {
    const info = await FileSystem.getInfoAsync(PING_QUEUE_FILE);
    if (!info.exists) return [];
    return JSON.parse(await FileSystem.readAsStringAsync(PING_QUEUE_FILE));
  } catch {
    return [];
  }
}

async function writePingQueue(queue) {
  try {
    await FileSystem.writeAsStringAsync(PING_QUEUE_FILE, JSON.stringify(queue));
  } catch {}
}

export const tripService = {
  async getTrip(tripId) {
    const response = await api.get(`/trips/${tripId}`);
    return response.data;
  },

  async startTrip(tripId) {
    const response = await api.put(`/trips/${tripId}/start`);
    return response.data;
  },

  async markArrived(tripId) {
    const response = await api.put(`/trips/${tripId}/arrive`);
    return response.data;
  },

  async completeTrip(tripId) {
    const response = await api.put(`/trips/${tripId}/complete`);
    return response.data;
  },

  // Fire-and-forget GPS ping — queues offline if network fails
  async sendGpsPing(tripId, pingData) {
    try {
      const response = await api.post(`/gps/trips/${tripId}/ping`, pingData);
      return response.data;
    } catch (error) {
      // Save to offline queue (non-blocking)
      const queue = await readPingQueue();
      queue.push({ tripId, ...pingData });
      // Keep queue bounded
      if (queue.length > 200) queue.splice(0, queue.length - 200);
      await writePingQueue(queue);
      throw error;
    }
  },

  async flushOfflinePings() {
    const queue = await readPingQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      try {
        const { tripId, ...ping } = item;
        await api.post(`/gps/trips/${tripId}/ping`, ping);
      } catch {
        remaining.push(item);
      }
    }
    await writePingQueue(remaining);
  },
};

export default tripService;
