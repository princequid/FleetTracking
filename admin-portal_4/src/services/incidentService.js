import api from "./api";
import { LIST_PAGE_SIZE } from "../constants/config";
import { cached, invalidate, peek } from "./listCache";

export const peekIncidents = (status) =>
  peek(`incidents:${status && status !== "All" ? status : "all"}`);

export function getIncidents(status, opts) {
  // size is explicit: the backend caps unparameterised requests at 50 rows silently,
  // which under-counts the incident feed and dashboard. See constants/config.js.
  const params = { size: LIST_PAGE_SIZE };
  if (status && status !== "All") params.status = status;
  const key = `incidents:${params.status || "all"}`;
  return cached(key, () => api.get("/incidents", { params }).then((r) => r.data), opts);
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
    .then((r) => {
      invalidate("incidents");
      return r.data;
    });
}
