import api from "./api";

export function getDrivers() {
  return api.get("/drivers").then((res) => res.data);
}

export function getAvailableDrivers() {
  return api.get("/drivers/available").then((res) => res.data);
}

export function getDriverById(id) {
  return api.get(`/drivers/${id}`).then((res) => res.data);
}

export function getDriverStats(id) {
  return api.get(`/drivers/${id}/stats`).then((res) => res.data);
}

export function createDriverProfile(data) {
  return api.post("/drivers", data).then((res) => res.data);
}

export function deactivateDriver(id) {
  return api.put(`/drivers/${id}/deactivate`).then((res) => res.data);
}
