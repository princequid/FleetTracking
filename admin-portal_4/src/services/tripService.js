import api from "./api";

export function getTrips(statusFilter) {
  const params = {};
  if (statusFilter && statusFilter !== "All") {
    params.status = statusFilter;
  }
  return api.get("/trips", { params }).then((res) => res.data);
}

export function getTripById(id) {
  return api.get(`/trips/${id}`).then((res) => res.data);
}

export function createTrip(data) {
  return api.post("/trips", data).then((res) => res.data);
}

