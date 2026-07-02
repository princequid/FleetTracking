import api from "./api";

export function getVehicles() {
  return api.get("/vehicles").then((res) => res.data);
}

export function getAvailableVehicles() {
  return api.get("/vehicles/available").then((res) => res.data);
}

export function createVehicle(data) {
  return api.post("/vehicles", data).then((res) => res.data);
}

export function updateVehicle(id, data) {
  return api.put(`/vehicles/${id}`, data).then((res) => res.data);
}
