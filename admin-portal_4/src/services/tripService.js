import api from "./api";
import { LIST_PAGE_SIZE } from "../constants/config";

export function getTrips(statusFilter) {
  // size is explicit: without it the backend's @PageableDefault caps this at 50 rows
  // silently, which quietly wrongs every KPI and report derived from it. See config.js.
  const params = { size: LIST_PAGE_SIZE };
  if (statusFilter && statusFilter !== "All") {
    params.status = statusFilter.toUpperCase();
  }
  return api.get("/trips", { params }).then((res) => res.data);
}

export function getTripById(id) {
  return api.get(`/trips/${id}`).then((res) => res.data);
}

export function createTrip(data) {
  return api.post("/trips", data).then((res) => res.data);
}

export function cancelTrip(id) {
  return api.put(`/trips/${id}/cancel`).then((res) => res.data);
}

export function getTripHistory(id) {
  return api.get(`/trips/${id}/history`).then((res) => res.data);
}

