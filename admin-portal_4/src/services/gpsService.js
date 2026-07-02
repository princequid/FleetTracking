import api from "./api";

export function getActivePositions() {
  return api.get("/gps/trips/active").then((res) => res.data);
}
