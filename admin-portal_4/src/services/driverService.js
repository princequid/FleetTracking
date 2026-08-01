import api from "./api";
import { LIST_PAGE_SIZE } from "../constants/config";
import { cached, invalidate, peek } from "./listCache";

// Synchronous cache read for a page's useState initialiser — see listCache.peek().
export const peekDrivers = () => peek("drivers");

// size is explicit on both list calls — the backend caps unparameterised requests at 50
// rows with nothing in the response to say so. See constants/config.js.
export function getDrivers(opts) {
  return cached("drivers", () =>
    api.get("/drivers", { params: { size: LIST_PAGE_SIZE } }).then((res) => res.data), opts);
}

export function getAvailableDrivers(opts) {
  return cached("drivers:available", () =>
    api.get("/drivers/available", { params: { size: LIST_PAGE_SIZE } }).then((res) => res.data), opts);
}

export function getDriverById(id) {
  return api.get(`/drivers/${id}`).then((res) => res.data);
}

export function getDriverStats(id) {
  return api.get(`/drivers/${id}/stats`).then((res) => res.data);
}

export function createDriverProfile(data) {
  return api.post("/drivers", data).then((res) => {
    invalidate("drivers");
    return res.data;
  });
}

export function deactivateDriver(id) {
  return api.put(`/drivers/${id}/deactivate`).then((res) => {
    invalidate("drivers");
    return res.data;
  });
}
