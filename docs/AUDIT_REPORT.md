# FleetTrack Pro — Codebase Audit (2026-07-14)

Five parallel read-only audits covering the mobile app, admin portal, and all backend
microservices/infra. No files were modified as part of the audit itself (separate mobile
performance work done the same session is noted at the bottom).

Severity legend: **Critical** (exploitable now / service down) · **High** · **Medium** · **Low**

---

## 🔴 Cross-cutting top priorities (read this first)

1. **Trip IDOR — any driver can control any other driver's trip.** `trip-service_2` never checks
   that the authenticated driver is actually assigned to the `{id}` in start/arrive/complete/cancel
   — only role is checked, not ownership. Combined with GPS-service and media-service having the
   same gap (see below), a driver account can currently view/manipulate trips, GPS routes, and
   photos that aren't theirs by guessing IDs.
2. **Privilege escalation at registration.** `POST /auth/register` in `auth-service_1` trusts a
   client-supplied `role` field, so any anonymous caller can register as `SUPER_ADMIN`.
3. **Two backend services are not deployable at all.** `analytics-service_5` is 100% empty stub
   code (no `pom.xml`, no main class); `notification-service_5` has no `Dockerfile` and no
   docker-compose entry. Neither can currently run.
4. **Mobile "Mark arrived" bypasses geofencing.** The dashboard quick-action button hits
   `/trips/{id}/arrive` with no location payload at all, sidestepping the 50m geofence check that
   the map screen correctly enforces — undermines this session's own geofencing work.
5. **Notification-service has no authorization at all.** Any signed-in user can read/mark-read
   another user's notifications, and can register a push token that hijacks another user's device
   for push delivery — no ownership check, no `SecurityConfig`, no internal-key filter.

---

## 1. Mobile App (`mobile/`)

| # | Sev | Category | Location | Issue | Fix |
|---|-----|----------|----------|-------|-----|
|1| Critical | Security/Bug | `app/(driver)/dashboard_2.jsx` ~L335 (`handleMarkArrived`) | "Mark arrived" quick action calls `/trips/{id}/arrive` with no lat/lng, bypassing the geofence check the map screen enforces | Route through the same geofence-gated flow, or remove the shortcut |
|2| High | Bug | `hooks/usePushNotifications.js:16` | Builds route `/(driver)/trip/${tripId}_2` — stray "_2" suffix only works because a downstream screen strips it back off | Fix the route string; drop the compensating `.replace()` |
|3| High | Bug | `services/mediaService_3.js:91` | `retryFailedUploads()` is fully implemented but never called — failed POD photo uploads are queued and permanently lost | Invoke on app foreground / network reconnect |
|4| High | Bug | `app/(driver)/trip/[id]/map.jsx` ~L906 | GPS pings sent via bare `.catch(() => {})`; the offline-queue-and-flush logic in `tripService_2.js` (`sendGpsPing`/`flushOfflinePings`) exists but is unused | Route pings through the existing offline queue |
|5| High | Bug/Security | `services/api_1.js` ~L34-70 | 401-refresh interceptor has no shared in-flight lock — concurrent 401s can race and invalidate a sibling's just-received rotating refresh token, causing spurious forced logouts | Add one shared in-flight refresh promise |
|6| Medium | Security | `app/(driver)/profile.jsx` ~L123 (`confirmSignOut`) | Deletes local tokens directly instead of calling `authService.logout()` — server-side session/refresh token is never revoked | Call `authService.logout()` |
|7| Medium | Bug | `app/(driver)/dashboard_2.jsx` ~L294, ~L566 | "TODAY'S TRIPS" renders the first 8 of the *entire* unfiltered trip list — no date filtering | Filter by today's date or relabel |
|8| Medium | Performance | dashboard, `useAlertsPoller`, notifications, trip history | Four independent places call `GET /trips` and re-filter client-side with overlapping poll intervals, no shared cache | Consolidate into one shared trips store |
|9| Medium | Security | `delivery/pod/[id].jsx`, `pre-dispatch/[id].jsx` | Geofence check uses `Location.getCurrentPositionAsync({})` with no explicit accuracy, unlike the tracker elsewhere (`Accuracy.High`) | Request `Accuracy.High` explicitly |
|10| Medium | Security/Privacy | `trip/[id]/map.jsx` L28, L195 | Defaults to public `router.project-osrm.org` + always calls public Nominatim — live coordinates/addresses sent to third parties by default | Require self-hosted OSRM/geocoder in production |
|11| Medium | Code Quality | `delivery/pre-dispatch/[id].jsx` & `pod/[id].jsx` | ~300 near-identical lines duplicated between the two screens; empty stub hooks (`useCamera.js`, `useS3Upload_3.js`) look like where this was meant to live | Extract shared logic into those hooks |
|12| Low | Code Quality | ~20 files across `hooks/`, `services/`, `store/`, `components/` | Stub files containing only a comment; real screens re-implement the same logic inline instead | Implement and adopt, or delete |
|13| Low | Code Quality | `app/_layout_1.jsx` | Orphaned duplicate of `app/_layout.jsx`, missing `ThemeProvider`/`SafeAreaProvider` | Delete |
|14| Low | Code Quality | `trip/[id]/index.jsx:138`, `pod/[id].jsx:98`, `pre-dispatch/[id].jsx:101` | Defensively strip a `'_2'`/`'_3'` suffix that (aside from #2) nothing ever appends | Remove once #2 is fixed |
|15| Low | Code Quality | `trip/[id]/map.jsx` (`locSubRef`) | Ref declared but never assigned — GPS is owned by the shared tracker singleton — every `.remove?.()` call is a no-op | Remove dead ref |
|16| Low | Bug | `dashboard_2.jsx` ~L251 (`showToastMsg`) | Bare `setTimeout` with no stored id/cleanup — can set state after unmount | Store and clear the timeout id |
|17| Low | Code Quality | `incident/report/[tripId].jsx` ~L14 | "Delay" and "Other" incident tiles both map to the same backend enum value `OTHER` | Confirm intent |
|18| Low | Code Quality | `incident/[id].jsx`, `dashcam/session/[tripId].jsx`, `trip/reroute/[id].jsx`, `delivery/gallery/[id].jsx` | "Coming soon" placeholders, currently unreachable from anywhere in the app | Confirm these are intentionally deferred |
|19| Low | Performance | `app/(driver)/_layout.jsx` | Four always-mounted hooks run for the whole session; alerts poller overlaps with dashboard's own fetch (see #8) | Consolidate data layer |

**Fix first:** #1 (geofence bypass), #3+#4 (offline queues are write-only — silent, permanent data loss), #5+#6 (auth refresh race + sign-out doesn't revoke server session).

---

## 2. Admin Portal (`admin-portal_4/`)

| # | Sev | Category | Location | Issue | Fix |
|---|-----|----------|----------|-------|-----|
|1| High | Performance | `src/pages/IncidentsPage.jsx:75-122` | Constants/functions re-declared *inside* the per-row filter predicate — rebuilt on every array element on every render | Delete the duplicated block; use the module-level constants |
|2| Medium | Bug | `TripTable.jsx:11` vs `TripDetailPage.jsx:187` | `CANCELLABLE_STATUSES` in the table lists three statuses that don't exist and is missing `EN_ROUTE`/`ARRIVED` — cancel option available on one screen but not the other for the same trip | Derive both from one shared helper |
|3| Medium | Bug | `constants/tripStatus.js:1,3-11` | `FILTER_TABS` omits `EN_ROUTE`/`REROUTED` — those trips are invisible under every tab except "All" | Add matching tabs |
|4| Medium/High | Bug | `components/drivers/DriverForm.jsx:18-43` | Two-step create (register user → create profile) has no rollback; a step-2 failure orphans the account with no resume path, and retry creates a duplicate | Make atomic, or persist `userId` to allow resuming |
|5| Medium | Bug | `pages/DashboardPage.jsx:162` | `onTimeRate` is the literal string `"87.5%"` — fabricated, not computed from data | Compute from real trip data like ReportsPage does |
|6| Medium | Security/Code Quality | `services/api.js:4`, `useFleetWebSocket.js:6`, `NotificationBell.jsx:13` | Backend origin `http://localhost:8080` hardcoded in three separate places — a prod build still points at localhost | Centralize in one env-driven config module |
|7| Medium | Performance | `NotificationBell.jsx:137-188` vs `useFleetWebSocket.js` | Duplicates a full STOMP/SockJS client instead of reusing the existing hook — every page opens two websocket connections | Share one connection/hook |
|8| Medium | Reliability | `LocationAutocomplete.jsx`, `MapPickerModal.jsx`, `TripRouteMap.jsx` | Three independent hand-rolled Nominatim `fetch` calls, no `User-Agent` header (violates Nominatim usage policy), no shared cache | Extract one geocoding client with caching |
|9| Low/Medium | Code Quality | `constants/colors.js` vs `DashboardPage.jsx:34-45` | Two different driver-avatar-color algorithms — same driver shows different colors on different pages | Standardize on `getAvatarColor` |
|10| Medium | Design system | Dashboard/Drivers/Reports pages | Hardcoded hex colors in JS violate `CLAUDE.md`; some are also stale vs. the actual shipped teal | Pull from CSS custom properties / token map |
|11| Low/Medium | Code Quality | `index.css:2-11` vs `CLAUDE.md` | Shipped palette no longer matches the documented one (source of #10) | Reconcile doc vs. CSS |
|12| Medium | Responsive | `index.css:4004` `.incidents-filters-bar` | No `flex-wrap`, no matching media query — filters can overflow on narrow viewports | Add `flex-wrap` / stack via media query |
|13| Low/Medium | Responsive | `index.css:2853` `.page-header-row` | No wrap/responsive override for title + action button | Add `flex-wrap: wrap; gap` |
|14| Low | Code Quality | `index.css:4329-4340` | `.trips-table-card` given padding then immediately overridden to 0 — contradictory rules from the same pass | Remove the dead rule |
|15| Medium | Performance/Bug | Drivers/Vehicles pages vs Trips page | Trips paginates client-side; Drivers/Vehicles render the entire filtered list with no pagination | Reuse the Trips pagination pattern |
|16| Low/Medium | Performance | `GlobalSearchModal.jsx:47-80` | Fetches full unpaged trips/drivers/vehicles/incidents on every open, before typing | Defer fetch until query has a few chars, or cache |
|17| Low | Performance | `DashboardPage.jsx:150-154` | 30s poll of 3 endpoints with no `visibilitychange` guard | Pause/resume on tab visibility |
|18| Low | Security | `AssignTripForm.jsx:9,61-94` | Entire dispatch draft persisted unencrypted to `localStorage` until submit/discard | Consider `sessionStorage` or per-user scoping |
|19| Low | Code Quality | 6 unrouted stub pages (`AssignTripPage`, `DashcamPage`, `IncidentLogPage`, `MfaSetupPage`, `NotificationsPage`, `PODReviewPage`) | Stubs not wired into routing anywhere | Wire in or delete |
|20| Low | Code Quality | 9 unused stub components (`FleetMap`, `VehicleMarker`, chart components, `PODGallery`, etc.) | Never imported; `LiveMapPage` reimplements its own map inline instead | Remove or finish and adopt |
|21| Low | Code Quality | `store/mapStore.js`, `hooks/useWebSocket.js`, `constants/config.js` | Zero-import stub files | Remove |
|22| Low | Code Quality | `EmptyState.jsx`, `Skeleton.jsx` | Built but never adopted — every list page hand-rolls the same markup inline instead | Consolidate and adopt |
|23| Low | Security/Robustness | `useFleetWebSocket.js:32-53` | STOMP client activates even when `accessToken` is falsy, attempting an unauthenticated connection | Guard on token presence |
|24| Low | Code Quality | `ReportsPage.jsx:189-202` | CSV export has no field escaping/quoting — fine today (numeric fields only) but will corrupt if a text column is added | Add a CSV-escape helper |

**Fix first:** #1 (real perf bug, trivial fix), #2/#3 (inconsistent, genuinely broken cancel UX), #6/#7 (blocks any non-localhost deploy, doubles websocket load).

---

## 3. Backend — Core Services (`api-gateway_1`, `auth-service_1`, `trip-service_2`)

| # | Sev | Category | Location | Issue | Fix |
|---|-----|----------|----------|-------|-----|
|1| Critical | Security (IDOR) | `trip-service_2` `TripController`/`TripService` (start/arrive/complete/cancel/get) | Role is checked but never ownership — any driver can control/view any trip by ID | Verify `trip.getDriverId()` matches the caller's own driver id when role is `DRIVER` |
|2| Critical | Security | `auth-service_1` `AuthService.java:45`, `RegisterRequest.java:26` | Public `/auth/register` trusts client-supplied `role` — anyone can register as `SUPER_ADMIN` | Ignore client-supplied role on public registration; require an authenticated admin-only endpoint for elevated accounts |
|3| High | Performance | `trip-service_2` RestTemplateConfig/EtaService, `api-gateway_1` JwtAuthFilter | No timeouts anywhere on inter-service calls (RestTemplate defaults to infinite; gateway's WebClient call to `/auth/validate` has no `.timeout()`) | Set explicit connect/read timeouts everywhere |
|4| High | Bug (transactional boundary) | `trip-service_2` `TripService.java:48-115` (`createTrip`) | External call to vehicle-service happens inside a DB `@Transactional` — a later DB failure leaves the vehicle stranded `IN_USE` with no compensating rollback; also holds a DB connection open across a blocking network call | Persist trip first, call vehicle-service after, add compensation on failure |
|5| Medium | Performance | `trip-service_2` `getAllTrips`/`getTripsByDriver` | No pagination — full-table scans as trip volume grows | Add `Pageable` |
|6| Medium | Security/Code Quality | `GlobalExceptionHandler` in auth-service and trip-service | Every `RuntimeException` → HTTP 400 with the raw exception message; nothing is logged server-side | Use typed exceptions with correct status codes; log before responding |
|7| Medium | Security | All `application.yml` in these 3 services | `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, DB/RabbitMQ creds all default to weak, identical, committed values | Fail fast if env vars unset in non-dev profiles |
|8| Medium | Security | `auth-service_1` `AuthService.java:55-71` | Login short-circuits differently for "no such user" vs "wrong password" vs "locked" — user enumeration + timing side-channel | Equalize timing (dummy hash comparison) and return a generic message |
|9| Low | Code Quality | `CreateTripRequest.java:28`, `StopRequest.java` | Documented "max 7 stops" never enforced via validation; blank stop names silently dropped rather than rejected | Add `@Size(max=7)` and field constraints |
|10| Low | Bug | `TripService.java:234,244` | Invalid `status` query param throws uncaught `IllegalArgumentException` → opaque 500 instead of 400 | Validate explicitly, throw `ResponseStatusException(BAD_REQUEST)` |
|11| Low | Code Quality | `TripService.java:223-227` (`cancelTrip`) | Vehicle-status reconciliation failure caught and silently swallowed — comment claims it's logged, but nothing is | Add the missing log statement |
|12| Low | Code Quality | Various (`RerouteEventRepository`, `MfaService`, `PasswordResetService`, extensionless duplicate DTOs) | Dead/unimplemented stub files, some with invalid package syntax that silently exclude them from the build | Delete or track as backlog items |
|13| Low | Code Quality | `trip-service_2` `SecurityConfig.java:21` | Spring Security permits everything; all authorization is ad hoc per-controller (`requireRole`) — easy to forget on new endpoints, as happened here | Consider centralized method-security |
|14| Low | Code Quality | `DriverServiceClient.java:32-46` | Manually sets `X-Internal-Service-Key` even though the shared interceptor already does | Remove the redundant manual header |
|15| Low | Code Quality | `api-gateway_1` `application.yml:28-32` vs `JwtAuthFilter.java:24` | `gateway.public-paths` YAML is dead config — the real list is hardcoded in Java | Wire it up or delete the YAML |

**Fix first:** #1 (live, exploitable trip IDOR), #2 (anyone can become SUPER_ADMIN), #3+#4 (no timeouts + external call inside a DB transaction — real availability/consistency risk).

---

## 4. Backend — Business Services (`driver-service_1`, `vehicle-service_1`, `media-service_3`, `incident-service_3`)

| # | Sev | Category | Location | Issue | Fix |
|---|-----|----------|----------|-------|-----|
|1| Critical | Security | `media-service_3` `MediaController.java:48` (`getTripPhotoStatus`) | No role check at all — any caller can fetch POD status + the photo's exact GPS geotag for any trip ID | Add role/ownership check consistent with `getTripPhotos` |
|2| Critical | Security (IDOR) | `media-service_3` `MediaService.registerPhoto`, `client/TripServiceClient.java` | `TripServiceClient` is an empty stub — nothing verifies the driver is assigned to the trip they're registering a photo for | Implement the ownership check; cross-validate `photoKey` against `tripId` |
|3| Critical | Security | `vehicle-service_1` `VehicleController.java:57` (`updateStatus`) | No `requireRole` at all on a state-mutating endpoint — any caller can change any vehicle's status | Add `requireRole` like the sibling `updateVehicle` |
|4| High | Security | `media-service_3` `MediaService.java:45` (`generatePresignedUrl`) | Same root cause as #2 — any driver can get an upload URL for any trip's photo slot | Verify trip assignment before minting the URL |
|5| High | Security | `vehicle-service_1` `VehicleController.java:45` (`getVehicleById`) | Also missing `requireRole`, inconsistent with sibling list endpoints | Add role check |
|6| High | Security | `media-service_3` `service/PhotoValidationService.java` | Empty stub — no server-side file size/MIME/magic-byte validation ever runs; client-supplied metadata is trusted blindly | Implement real validation against MinIO's actual object metadata |
|7| High | Security (IDOR) | `driver-service_1` `DriverController.java:55`, `DriverService.java:76` (`getDriverStats`) | Any caller with role `DRIVER` can query any *other* driver's stats by ID — sibling endpoint correctly does a self-or-admin check, this one doesn't | Use the same self-or-admin check |
|8| High | Security | `incident-service_3` `IncidentController.java:28`, `IncidentService.java:26` | `createIncident` never verifies the trip belongs to the reporting driver | Validate trip/driver assignment before saving |
|9| Medium | Bug (recurrence) | `media-service_3` `MediaService.java:102` | Persisted `photoUrl` still hardcoded to `http://localhost:9000/...` — the exact bug already fixed for presigned URLs elsewhere, now the fallback path degrades right back to it | Build from `minio.external-endpoint`, or stop storing/trusting this field |
|10| Medium | Security | `driver-service_1` `DriverService.java:22`, `client/AuthServiceClient.java` | Empty stub — driver profiles created for any client-supplied `userId` with no verification it exists in auth-service | Implement the verification call |
|11| Medium | Bug | `driver-service_1` `DriverService.java:76` (`getDriverStats`) | Entirely hardcoded — always returns zeros regardless of driver; `DriverStatsService` is an empty stub | Implement real stats aggregation |
|12| Medium | Performance | `media-service_3` `MediaService.java:87` | `getObject(...).readAllBytes()` loads entire file into memory to hash it | Stream the hash via `DigestInputStream` |
|13| Medium | Performance | `media-service_3` `IntegrityCheckJob.java:37` | Loads and filters the whole photo table in memory instead of a scoped query | Add a repository method with the date filter in SQL |
|14| Medium | Bug | All 4 services' `GlobalExceptionHandler`/service layer | Generic `RuntimeException` mapped to 400 for everything, including not-found cases that should be 404 | Use typed exceptions / correct status codes |
|15| Medium | Performance | `driver-service_1`, `vehicle-service_1` list endpoints | No pagination | Add `Pageable` |
|16| Low | Security | `vehicle-service_1` `GlobalExceptionHandler.java:21` | 500 body includes `ex.getClass().getSimpleName() + ": " + ex.getMessage()` — leaks internal detail | Redact like driver-service's handler |
|17| Low | Code Quality | `media-service_3` dashcam/event-publisher stubs | Dead stub classes; no `media.uploaded` event is ever actually published | Implement or remove |
|18| Low | Security | `MinioConfig.java:21`, `application.yml:51` | MinIO creds default to hardcoded weak values | Fail fast if unset in non-dev |
|19| Low | Code Quality | 4x duplicated `InternalKeyFilter`/`SecurityConfig` | Byte-for-byte identical across all four services, already drifting (vehicle-service's copy lacks message redaction) | Extract to a shared library |
|20| Low | Code Quality | `incident-service_3` `model/dto/UpdateStatusRequest.java` | Dead duplicate of `UpdateIncidentStatusRequest`, unused | Remove |

**Fix first:** the three no-role-check endpoints (#1, #3, #5 — trivial one-line fixes with outsized exposure), the media-service ownership gap (#2/#4), and the recurring localhost-URL bug (#9) which quietly breaks the fallback path of an earlier fix.

---

## 5. Backend — Support Services & Infra (`gps-service_2`, `notification-service_5`, `audit-service`/`audit-service_5`, `analytics-service_5`, `eureka-server_1`, `shared-events_5`, `infrastructure_1`)

| # | Sev | Category | Location | Issue | Fix |
|---|-----|----------|----------|-------|-----|
|1| Critical | Config | `infrastructure_1/docker-compose.yml` | `notification-service_5` and `analytics-service_5` have no compose entries — can't be started | Add entries, or explicitly document as not-yet-deployed |
|2| Critical | Code Quality/Bug | `analytics-service_5/` | Every class is an empty stub; no `pom.xml`, no main class, no Dockerfile — doesn't compile | Treat as unimplemented scaffolding |
|3| High | Config | `notification-service_5/` | Has real logic and a `pom.xml` but **no Dockerfile** — can't be built even if a compose entry were added | Add a Dockerfile (mirror gps-service_2's multi-stage pattern) |
|4| Medium | Code Quality | `audit-service` vs `audit-service_5` | Confirmed: `audit-service` (no suffix) is the real, deployed implementation; `audit-service_5` is a stale 5-file skeleton | Delete `audit-service_5` |
|5| Critical | Security (IDOR) | `notification-service_5` `NotificationController.java:23-43` | `GET /users/{userId}`, mark-read endpoints take `userId`/`id` from the path with no check against the caller's identity | Derive recipient id from the gateway-verified `X-User-Id` header, not the path |
|6| Critical | Security | `notification-service_5` `DeviceController.java:19`, `DeviceTokenRequest.java` | `recipientId` taken from request body — any caller can register a push token for an arbitrary user, hijacking their push delivery | Bind registration to the authenticated caller's id |
|7| High | Security | `notification-service_5/` (whole service) | No `SecurityConfig`, no internal-key filter, no `spring-security` dependency at all | Add the same internal-key filter pattern used in gps-service_2 |
|8| Medium | Security (IDOR) | `gps-service_2` `GpsController.java` | No check that the caller is the driver assigned to `tripId`; `/trips/active` returns every active vehicle's position fleet-wide with no scoping | Verify trip/driver association before accepting/returning data |
|9| Medium | Security | `gps-service_2` `WebSocketConfig.java:22` | STOMP endpoint allows any origin (`setAllowedOriginPatterns("*")`) | Restrict to known app/admin-portal origins |
|10| Medium | Security | `docker-compose.yml` (multiple lines) | Every secret (Postgres, RabbitMQ, MinIO, JWT, internal-service) has a weak hardcoded `${VAR:-default}` fallback | Drop fallbacks outside local dev so compose fails loudly instead of running insecurely |
|11| Medium | Security | `docker-compose.yml:64-78` | Redis published on host port with no password/ACL | Bind to loopback or require a password; stop publishing the port |
|12| Medium | Config | `docker-compose.yml:376` | `MINIO_EXTERNAL_ENDPOINT` hardcoded LAN IP (`10.6.8.229`) — has already changed 3 times this session and broken things each time | Source from an env var with no hardcoded fallback |
|13| High | Bug | `gps-service_2` `DeviationDetectionService.java:60-80` | Malformed/missing route geometry returns `0` ("on route") instead of skipping the check — fails open, silently suppressing all deviation detection | Propagate a "cannot evaluate" signal instead |
|14| Medium | Bug | Same file | Deviation computed as distance to nearest route *vertex*, not nearest *segment* — false positives on sparse routes | Use point-to-segment distance |
|15| Medium | Bug | `gps-service_2` `GpsService.java:66-84` (`saveBulkPings`) | Offline/bulk-synced pings skip plausibility checking, deviation detection, and live-location publishing entirely | Run the same checks/publish path for bulk pings |
|16| Medium | Performance | `gps-service_2` `GpsService.java:29-64` (`savePing`) | `@Transactional` method makes a blocking, timeout-less RestTemplate call to trip-service inside the transaction | Move the external call out of the transaction; add timeouts |
|17| Medium | Config/Bug | `infrastructure_1/db/init/01_create_databases.sql:35` vs `notification-service_5/application.yml` | Init script creates schema `notif`; service config targets schema `notification` — only works via Flyway's undocumented auto-create | Rename one side to match the other |
|18| High | Reliability | `notification-service_5` & `audit-service` `RabbitMQConfig.java` | Queues have no dead-letter-exchange; malformed messages are `nack`'d with `requeue=false` and permanently discarded | Add DLX/DLQ |
|19| Medium | Reliability | `notification-service_5` `FcmService.java:50-84` | No retry/backoff on transient FCM errors — failure just logs and moves on | Add retry with backoff for transient error codes |
|20| Medium | Performance | `gps-service_2` `GpsService.java:98` (`getActivePositions`) | Uses blocking `KEYS` scan on Redis instead of `SCAN` | Switch to `SCAN` |
|21| Medium | Performance | `gps-service_2` `GpsPingRepository`/`getRoute` | Returns entire unbounded ping history per trip | Paginate or cap by time range |
|22| Medium | Performance | `docker-compose.yml` | No healthcheck on `eureka-server`; dependents only wait for container start, not Eureka readiness — contributes to the startup races already seen this session | Add a healthcheck and switch dependents to `condition: service_healthy` |
|23| Low/Medium | Performance | `docker-compose.yml` | Summed memory limits across all 16 containers ≈ 7GB — worth checking against actual host RAM given prior slow-startup issues | Right-size limits or stagger startup |
|24| Low | Performance | `audit-service` `ProcessedEventRepository` | No retention/cleanup job — idempotency table and audit logs (fed by a catch-all binding) grow unbounded | Add a scheduled purge |
|25| Low | Bug | `gps-service_2`, `audit-service` `GlobalExceptionHandler` | `Map.of("error", ex.getReason())` throws NPE if reason/message is null, turning a clean 400 into a 500 | Null-safe map builder |
|26| Low | Code Quality | `notification-service_5` `IncidentEventConsumer.java`, `ManualNotifController.java` | Empty stubs; queue binding only routes `trip.#`, not `incident.#` — incident-driven notifications are unimplemented | Implement or track as backlog |
|27| Low | Code Quality | `shared-events_5` (`*_2.java`, `*_3.java` milestone placeholders) | 6 empty placeholder event classes shipped inside the real shared JAR every service depends on | Remove |
|28| Low | Code Quality | `infrastructure_1/rabbitmq_5/definitions.json`, `redis_2/redis.conf`, `nginx_5/fleettrack.conf`, `minio_3/setup.sh` | Stub files never mounted/referenced by compose | Flesh out or remove |

**Fix first:** #1+#2 (two services literally can't run), #5+#6 (notification-service has zero access control — real user data/push hijack exposure), #18+#13 (no DLQ + deviation detection fails open — events and safety signals are silently lost).

---

## Mobile performance work completed this session (context, not a finding)

While the audits above ran, the following was implemented directly (see conversation for detail):

- **Fixed a cold-start correctness bug**: `authStore_1.js` held `userId` in memory only; after an
  app force-quit + relaunch with a still-valid token, `splash.jsx` skipped login but never restored
  `userId`, so profile/stats requests silently hit `/drivers/user/undefined`. Now persisted to
  SecureStore and rehydrated in `splash.jsx` before navigating.
- **New shared cache** (`store/driverStore_1.js`) for driver profile + stats — deduped in-flight
  requests and a short TTL so splash/dashboard/profile share one network call instead of three.
- **Splash now prefetches** the driver profile as soon as the token is confirmed valid, in parallel
  with navigation.
- **`dashboard_2.jsx`** reads/writes through the shared cache instead of its own separate call.
- **`profile.jsx`**'s fetch waterfall (profile → `.then` → stats, both always refetched) now reads
  cached data instantly and only refetches what's stale.
- Cache is cleared on logout in both the manual sign-out flow and the axios 401-refresh-failure path.

Note: finding #6 in the mobile audit table above (`confirmSignOut` doesn't call `authService.logout()`)
is a related, separate gap in the same sign-out flow and was not fixed as part of the perf work.
