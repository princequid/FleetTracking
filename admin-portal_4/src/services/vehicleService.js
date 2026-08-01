import api from "./api";
import { LIST_PAGE_SIZE } from "../constants/config";
import { cached, invalidate, peek } from "./listCache";

export const peekVehicles = () => peek("vehicles");

// size is explicit on both list calls — the backend caps unparameterised requests at 50
// rows with nothing in the response to say so. See constants/config.js.
export function getVehicles(opts) {
  return cached("vehicles", () =>
    api.get("/vehicles", { params: { size: LIST_PAGE_SIZE } }).then((res) => res.data), opts);
}

export function getAvailableVehicles(opts) {
  return cached("vehicles:available", () =>
    api.get("/vehicles/available", { params: { size: LIST_PAGE_SIZE } }).then((res) => res.data), opts);
}

export function createVehicle(data) {
  return api.post("/vehicles", data).then((res) => {
    invalidate("vehicles");
    return res.data;
  });
}

export function updateVehicle(id, data) {
  return api.put(`/vehicles/${id}`, data).then((res) => {
    invalidate("vehicles");
    return res.data;
  });
}
