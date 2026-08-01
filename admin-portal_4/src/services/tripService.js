import api from "./api";
import { LIST_PAGE_SIZE } from "../constants/config";
import { cached, invalidate, peek } from "./listCache";

export const peekTrips = (statusFilter) =>
  peek(`trips:${statusFilter && statusFilter !== "All" ? statusFilter.toUpperCase() : "all"}`);

export function getTrips(statusFilter, opts) {
  // size is explicit: without it the backend's @PageableDefault caps this at 50 rows
  // silently, which quietly wrongs every KPI and report derived from it. See config.js.
  const params = { size: LIST_PAGE_SIZE };
  if (statusFilter && statusFilter !== "All") {
    params.status = statusFilter.toUpperCase();
  }
  // Filter is part of the key — each status returns a different list.
  const key = `trips:${params.status || "all"}`;
  return cached(key, () => api.get("/trips", { params }).then((res) => res.data), opts);
}

export function getTripById(id) {
  return api.get(`/trips/${id}`).then((res) => res.data);
}

export function createTrip(data) {
  return api.post("/trips", data).then((res) => {
    // Assigning a trip also puts its vehicle IN_USE and consumes the driver, so the
    // vehicle and driver lists are stale too — not just trips.
    invalidate("trips", "vehicles", "drivers");
    return res.data;
  });
}

export function cancelTrip(id) {
  return api.put(`/trips/${id}/cancel`).then((res) => {
    invalidate("trips", "vehicles", "drivers");
    return res.data;
  });
}

export function getTripHistory(id) {
  return api.get(`/trips/${id}/history`).then((res) => res.data);
}
