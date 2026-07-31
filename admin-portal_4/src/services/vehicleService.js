import api from "./api";
import { LIST_PAGE_SIZE } from "../constants/config";

// size is explicit on both list calls — the backend caps unparameterised requests at 50
// rows with nothing in the response to say so. See constants/config.js.
export function getVehicles() {
  return api.get("/vehicles", { params: { size: LIST_PAGE_SIZE } }).then((res) => res.data);
}

export function getAvailableVehicles() {
  return api.get("/vehicles/available", { params: { size: LIST_PAGE_SIZE } }).then((res) => res.data);
}

export function createVehicle(data) {
  return api.post("/vehicles", data).then((res) => res.data);
}

export function updateVehicle(id, data) {
  return api.put(`/vehicles/${id}`, data).then((res) => res.data);
}
