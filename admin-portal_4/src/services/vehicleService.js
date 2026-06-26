import api from "./api";

export function getAvailableVehicles() {
  return api.get("/vehicles/available").then((res) => res.data);
}

