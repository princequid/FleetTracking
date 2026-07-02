import api from "./api";

export function getFleetSummary() {
  return api.get("/analytics/fleet/summary").then((r) => r.data);
}

export function getDeliveryTrend(start, end) {
  return api
    .get("/analytics/deliveries/daily", { params: { start, end } })
    .then((r) => r.data);
}

export function getDriverLeaderboard() {
  return api.get("/analytics/drivers/leaderboard").then((r) => r.data);
}
