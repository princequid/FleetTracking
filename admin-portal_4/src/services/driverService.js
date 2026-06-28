import api from "./api";

export function getAvailableDrivers() {
  return api.get("/drivers/available").then((res) => res.data);
}

