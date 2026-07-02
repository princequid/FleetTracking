import api from "./api";

export function getTripPodStatus(tripId) {
  return api.get(`/media/photos/trips/${tripId}/status`).then((res) => res.data);
}

export function getTripPhotos(tripId) {
  return api.get(`/media/photos/trips/${tripId}`).then((res) => res.data);
}
