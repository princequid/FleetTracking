import api from "./api";

export function getIncidents(status) {
  const params = {};
  if (status && status !== "All") params.status = status;
  return api.get("/incidents", { params }).then((r) => r.data);
}

export function getIncidentById(id) {
  return api.get(`/incidents/${id}`).then((r) => r.data);
}

export function getIncidentsByTrip(tripId) {
  return api.get(`/incidents/trips/${tripId}`).then((r) => r.data);
}

export function updateIncidentStatus(id, status, resolutionNotes) {
  return api
    .put(`/incidents/${id}/status`, { status, resolutionNotes })
    .then((r) => r.data);
}
