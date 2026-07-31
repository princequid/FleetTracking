/**
 * Deterministic fleet fixtures for the "populated" stub mode.
 *
 * These exist because auditing only the empty state certifies half the portal.
 * Table rows are where the badges, avatars, action buttons and status chips
 * live — i.e. most of the surface a contrast or keyboard audit cares about —
 * and none of it renders when every collection comes back `[]`.
 *
 * Shapes mirror the Spring Boot DTOs the services actually consume. Note
 * `isActive` (not `active`) on the driver profile: Lombok emits getIsActive()
 * for `Boolean isActive`, so Jackson serialises that key, and DashboardPage
 * reads it verbatim.
 *
 * Times are generated relative to now so "3h ago" style rendering exercises its
 * real branches rather than always printing a date.
 */

const MINUTE = 60_000;
const ago = (minutes) => new Date(Date.now() - minutes * MINUTE).toISOString();
const ahead = (minutes) => new Date(Date.now() + minutes * MINUTE).toISOString();

const TRIP_STATUSES = ["ASSIGNED", "STARTED", "EN_ROUTE", "ARRIVED", "DELIVERED", "CANCELLED"];

const ORIGINS = ["Tema Harbour Industrial Area", "Accra Central Market", "Kumasi Suame Depot"];
const DESTINATIONS = [
  "East Legon Warehouse Complex",
  "Takoradi Port Terminal",
  "Ho Distribution Hub",
];

export const DRIVERS = [
  "Kwame Mensah",
  "Ama Boateng",
  "Yaw Osei",
  "Akua Darko",
  "Kofi Antwi",
  "Efua Asante",
].map((fullName, i) => ({
  id: i + 1,
  userId: 100 + i,
  fullName,
  phone: `+233 24 ${100 + i} 4567`,
  licenceNo: `GH-DL-${20000 + i}`,
  // One inactive driver, so the "Inactive" badge and the hidden-Deactivate
  // branch both render.
  isActive: i !== 3,
}));

export const VEHICLES = [
  ["Isuzu NPR", "AVAILABLE"],
  ["Toyota Dyna", "IN_USE"],
  ["Mercedes Sprinter", "MAINTENANCE"],
  ["Hino 300", "AVAILABLE"],
  ["Ford Transit", "DECOMMISSIONED"],
].map(([model, status], i) => ({
  id: i + 1,
  plateNumber: `GT-${4000 + i * 37}-2${i}`,
  model,
  capacity: 1200 + i * 450,
  status,
}));

export const TRIPS = Array.from({ length: 24 }, (_, i) => ({
  id: 1000 + i,
  driverId: (i % DRIVERS.length) + 1,
  vehicleId: (i % VEHICLES.length) + 1,
  origin: ORIGINS[i % ORIGINS.length],
  destination: DESTINATIONS[i % DESTINATIONS.length],
  status: TRIP_STATUSES[i % TRIP_STATUSES.length],
  eta: ahead(45 - i * 3),
  createdAt: ago(i * 137),
  // Every fourth trip is multi-stop so the "N stops" badge renders.
  stops:
    i % 4 === 0
      ? [{ id: 9000 + i, name: "Spintex Road Drop", lat: 5.6305, lng: -0.1123, description: "" }]
      : [],
  destLat: 5.6037,
  destLng: -0.187,
  routeGeometry: null,
  description: "Palletised dry goods",
}));

export const INCIDENTS = Array.from({ length: 9 }, (_, i) => ({
  id: 500 + i,
  tripId: 1000 + i,
  driverId: (i % DRIVERS.length) + 1,
  incidentType: ["VEHICLE_BREAKDOWN", "ROAD_ACCIDENT", "CARGO_DAMAGE"][i % 3],
  severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"][i % 4],
  status: ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"][i % 4],
  description: "Reported by the driver during transit near the Motorway roundabout.",
  resolutionNotes: i % 4 === 2 ? "Recovered by the workshop team; cargo intact." : null,
  resolvedAt: i % 4 === 2 ? ago(i * 60) : null,
  createdAt: ago(i * 95),
}));

export const STAFF = [
  ["ops@fleetsync.test", "SUPER_ADMIN"],
  ["admin@fleetsync.test", "ADMIN"],
  ["dispatch@fleetsync.test", "DISPATCHER"],
  ["lead@fleetsync.test", "ADMIN"],
].map(([email, role], i) => ({
  id: i + 1,
  email,
  role,
  createdAt: ago(i * 4000),
}));

/** Live GPS pings for the four trips that are actually moving. */
export const POSITIONS = TRIPS.slice(0, 4).map((trip, i) => ({
  tripId: trip.id,
  driverId: 100 + (trip.driverId - 1),
  lat: 5.6 + i * 0.02,
  lng: -0.19 + i * 0.02,
  speedKmh: 32 + i * 9,
  // The last one is deliberately stale (>5min) so the stale-marker branch renders.
  recordedAt: i === 3 ? ago(20) : ago(i),
}));

const TRIP_HISTORY = [
  { id: 1, status: "ASSIGNED", changedAt: ago(300), changedBy: "dispatch@fleetsync.test" },
  { id: 2, status: "STARTED", changedAt: ago(180), changedBy: "Kwame Mensah" },
  { id: 3, status: "EN_ROUTE", changedAt: ago(120), changedBy: "Kwame Mensah" },
];

const DRIVER_STATS = {
  totalTrips: 42,
  completedTrips: 38,
  cancelledTrips: 2,
  totalIncidents: 1,
};

/**
 * Maps a request path to its populated body. Order matters: the `/\d+$/` detail
 * routes must be tested before the bare collection routes they'd otherwise match.
 */
export function populatedBodyFor(pathname) {
  if (/\/trips\/\d+\/history$/.test(pathname)) return TRIP_HISTORY;
  if (/\/media\/photos\/trips\/\d+$/.test(pathname)) return [];
  if (/\/incidents\/trips\/\d+$/.test(pathname)) return INCIDENTS.slice(0, 1);
  if (/\/trips\/\d+$/.test(pathname)) return TRIPS[0];
  if (/\/drivers\/\d+\/stats$/.test(pathname)) return DRIVER_STATS;
  if (/\/drivers\/\d+$/.test(pathname)) return DRIVERS[0];

  if (/\/trips$/.test(pathname)) return TRIPS;
  if (/\/drivers(\/available)?$/.test(pathname)) return DRIVERS;
  if (/\/vehicles(\/available)?$/.test(pathname)) return VEHICLES;
  if (/\/incidents$/.test(pathname)) return INCIDENTS;
  if (/\/auth\/staff$/.test(pathname)) return STAFF;
  if (/\/gps\/trips\/active$/.test(pathname)) return POSITIONS;

  // Analytics endpoints are consumed as arrays; the dashboard derives its own
  // figures from /trips, so empty here is correct rather than lazy.
  if (/\/analytics\//.test(pathname)) return [];

  return {};
}
