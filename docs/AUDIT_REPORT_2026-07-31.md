# FleetTrack Pro — Memory, Performance & Security Audit (2026-07-31)

Static audit of `mobile/`, `admin-portal_4/`, `backend/` (11 services) and `infrastructure_1/`.
Supersedes nothing — read alongside [`AUDIT_REPORT.md`](AUDIT_REPORT.md) (2026-07-14), whose
findings are re-verified in §1 below.

**Scope honesty — read this first.** No stack was running during this audit, so:

- **Part 13 (benchmarks) could not be measured.** There are no before/after numbers in this
  report because producing them without a running system would mean inventing them. §9 gives
  the exact commands to capture each metric instead.
- **No CVE scanner was run** (`npm audit` / OWASP dependency-check need network + install).
  §8 reports dependency *ages and support status*, which are verifiable from the manifests,
  and flags where a scan is required before any production claim.
- Estimated gains in §5–§6 are reasoned from code shape (allocation counts, request counts,
  row counts) and are labelled as estimates, not measurements.

Severity: **Critical** (exploitable now / data loss now) · **High** · **Medium** · **Low**

---

## 1. Headline: the 2026-07-14 audit was largely acted on

Before anything else — most of the previous report is **fixed**. Verified in current code:

| Previous finding | Status |
|---|---|
| Trip IDOR (any driver controls any trip) | ✅ Fixed — `checkOwnership(trip, requesterDriverId)` on start/arrive/complete/get ([TripService.java:155](../backend/trip-service_2/src/main/java/com/fleettrack/trip/service/TripService.java#L155)) |
| Client-supplied `X-User-Id` spoofing | ✅ Fixed — gateway `h.set(...)` overwrites, not adds ([JwtAuthFilter.java:76-81](../backend/api-gateway_1/src/main/java/com/fleettrack/gateway/filter/JwtAuthFilter.java#L76-L81)) |
| notification-service zero authz | ✅ Fixed — identity derived from gateway headers ([NotificationController.java:73-82](../backend/notification-service_5/src/main/java/com/fleettrack/notification/controller/NotificationController.java#L73-L82)) |
| Weak `${VAR:-default}` secret fallbacks | ✅ Fixed — now `${VAR:?must be set}`, fails loudly |
| No pagination on list endpoints | ⚠️ Fixed server-side **only** — see **C-1**, this is now a correctness bug |
| External call inside DB transaction | ✅ Fixed — deferred to `afterCommit` ([TripService.java:126-138](../backend/trip-service_2/src/main/java/com/fleettrack/trip/service/TripService.java#L126-L138)) |
| Redis blocking `KEYS` scan | ✅ Fixed — cursor-based `SCAN` |
| No inter-service timeouts | ✅ Fixed — `.timeout(Duration.ofSeconds(5))` on gateway; `RestTemplateConfig` documents its own |
| Containers running as root | ✅ Fixed — all 11 Dockerfiles `USER spring:spring` |
| No JVM heap tuning | ✅ Fixed — `JAVA_TOOL_OPTIONS` set per service (and the `JAVA_OPTS`-was-a-no-op trap is documented) |
| No Eureka healthcheck / startup races | ✅ Fixed — healthcheck + `condition: service_healthy` |
| Mobile offline queues write-only | ✅ Fixed — `retryFailedUploads` on mount+foreground, `flushOfflinePings` on map open |
| Mobile 401-refresh race | ✅ Fixed — shared `refreshPromise` single-flight |
| Admin hardcoded `localhost:8080` ×3 | ✅ Fixed — centralised in `constants/config.js` |
| Admin duplicate STOMP connection | ✅ Fixed — `NotificationBell` polls, doesn't open a second socket |
| No rate limiting / security headers | ✅ Added — `LoginRateLimitFilter`, `SecurityHeadersFilter` |

Also newly present and good: outbox pattern for event publishing, per-account lockout,
right-most `X-Forwarded-For` parsing (a subtle detail most teams get wrong), Vite
`manualChunks` bundle splitting, and `Page`-based repository methods.

**This changes the shape of the audit.** The remaining findings are fewer and more specific
than last time, and the single most important one is a *side effect of a previous fix*.

---

## 2. Executive summary

| Dimension | Score | Basis |
|---|---:|---|
| **Overall health** | **72 / 100** | Strong security posture, solid infra; one silent data-correctness bug and no test coverage |
| Security | 80 | Authz, headers, secrets, rate limiting, non-root containers all in place. Held back by tokens in `localStorage`, a live credential on disk, and an EOL framework |
| Performance (CPU/network) | 65 | Backend is sound; the mobile nav loop does O(N) work per GPS fix and the portal re-fetches full lists on a timer |
| Memory efficiency | 70 | Heap limits tuned, Redis SCAN, streaming mostly right. Two unbounded caches (one now fixed) and unbounded table growth |
| Maintainability | 68 | **Correction (2026-07-31):** an earlier draft said "zero automated tests." Wrong — there are **35 passing backend tests** across 4 services plus 12 Playwright specs. They are *untracked*, so CI never runs them, which is the real problem. Still held back by a 2,900-line `map.jsx` and ~30 stub files |
| Scalability | 55 | In-memory rate limiting won't survive a second gateway replica; no data retention; `getAllTrips` fans out |

**Production readiness: not yet — one Critical blocker (C-1) and one Critical secret rotation
(C-2).** Both are hours of work, not weeks. With those two resolved and a retention job added,
this is a credible production deployment for a fleet of moderate size.

---

## 3. Critical issues

### C-1 — Every admin list and every derived metric is silently capped at 50 rows

**Severity: Critical (data correctness) · CWE-1284 · Not a security issue — a wrongness issue**

The previous audit's pagination fix was applied to the controllers but **no client was
updated to send `page`/`size`**, and the controllers return a bare `List`, discarding the
`Page` wrapper — so there is no `totalElements` for a client to even notice truncation.

- Server: `@PageableDefault(size = 50)` on [TripController.java:50](../backend/trip-service_2/src/main/java/com/fleettrack/trip/controller/TripController.java#L50), and identically on driver, vehicle and incident controllers.
- Server: `getAllTrips` returns `trips.getContent()` — a `List`, not a `Page` ([TripService.java:294](../backend/trip-service_2/src/main/java/com/fleettrack/trip/service/TripService.java#L294)).
- Client: **not one** call site sends a paging param. `getTrips()` in [tripService.js](../admin-portal_4/src/services/tripService.js) sends only `status`. Same for drivers, vehicles, incidents. Mobile has 6 bare `api.get('/trips')` call sites.

**Failure scenario.** The fleet reaches 51 trips. `DashboardPage`'s KPI tiles, `ReportsPage`'s
aggregations, the `TripsPage` client-side paginator, and `getDerivedNotifications()`'s feed
all compute over the first 50 rows the database happens to return. Every number on the
dashboard is wrong, and nothing anywhere indicates it. The Trips page's own pagination
control pages through 50 rows while the other trips are unreachable in the UI entirely.

**Compounding bug — no deterministic sort.** `@PageableDefault(size = 50)` sets no `sort`, and
`findAll(pageable)` without an `ORDER BY` lets PostgreSQL return rows in any order (it changes
after `UPDATE`s and `VACUUM`). So *which* 50 you get varies between identical requests, and
once clients do start paging, rows will be duplicated across pages and others skipped.

**Fix (recommended, not applied — it changes response shape and row ordering):**

```java
// TripController.java — deterministic ordering, newest first
@PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC)
Pageable pageable
```

Then pick one of two client strategies, per endpoint:

1. **Aggregates** (dashboard KPIs, reports, on-time rate) should not page at all — add
   dedicated `GET /trips/stats` endpoints that aggregate in SQL. Pulling every row to the
   browser to `.filter().length` it is the underlying design problem; paging just exposed it.
2. **Lists** (Trips/Drivers/Vehicles tables) should return `Page` and drive server-side
   pagination from the existing UI control.

As an immediate stopgap while the above is built, have the services send an explicit
`{ params: { size: 500 } }`. This restores correct numbers today and is one line per service
file — but it is a stopgap, not the fix, and it re-creates the payload problem in §5.

---

### C-2 — A live Gmail app password is sitting in `infrastructure_1/.env`

**Severity: Critical · CWE-798 · OWASP A07:2021**

```
GMAIL_USERNAME=princequarm27@gmail.com
GMAIL_APP_PASSWORD=pssz kizw tess ogai
REDIS_PASSWORD=7f92e0f970d722b3392567229b173d6a50ee35c749918267
```

**The good news, verified:** `.env` is gitignored and `git ls-files` confirms **no `.env` file
has ever been committed** — only `.env.example`. This is not a repository leak.

**Why it is still Critical:** a Google **app password is a full-account credential** for
SMTP/IMAP. Anyone who obtains it can read and send mail as that account — it is not scoped to
sending, and it bypasses 2FA. It is now in plaintext on at least one developer laptop, and it
was pasted into this session.

**Action, in order:**

1. Revoke it now at <https://myaccount.google.com/apppasswords> — revocation is instant and
   free; issue a fresh one for the server only.
2. Rotate `REDIS_PASSWORD`, `JWT_SECRET` and `INTERNAL_SERVICE_SECRET` at the same time.
   Note `JWT_SECRET=dev-only-change-this-to-a-long-random-string-before-prod` — if this file
   is what the deployed stack loads, every issued JWT is forgeable by anyone who has read the
   repo's `.env.example` conventions. **Verify which `.env` the production host uses.**
3. Move production secrets out of a `.env` file into Docker secrets or the host's secret
   manager. `.env` is fine for local dev; it is not a production secret store.
4. Consider a dedicated no-reply mailbox rather than a personal Gmail account for
   transactional mail.

---

## 4. Security findings

| # | Sev | CWE / OWASP | Location | Issue | Fix |
|---|---|---|---|---|---|
| S-1 | High | CWE-522 / A02 | [authStore.js:37](../admin-portal_4/src/store/authStore.js#L37) | Access **and refresh** tokens persisted to `localStorage` via zustand `persist`. Any XSS — including one in a dependency — exfiltrates a full session including the long-lived refresh token | Refresh token → `HttpOnly; Secure; SameSite=Strict` cookie; access token in memory only. If that's too large a change, at minimum shorten refresh TTL and add §S-2 |
| S-2 | High | CWE-1021 / A05 | Admin portal hosting (Render) | The **gateway** sets CSP/HSTS/X-Frame-Options, but those headers apply to API responses. The portal's own HTML is served by Render with **no CSP** — which is exactly the control that would contain S-1 | Add a `_headers`/`static.json` with `Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://fleettrack.duckdns.org https://router.project-osrm.org; frame-ancestors 'none'` |
| S-3 | High | CWE-1188 / A05 | [config.js:13](../admin-portal_4/src/constants/config.js#L13), [map.jsx:40](../mobile/app/(driver)/trip/[id]/map.jsx#L40) | OSRM defaults to the **public** `router.project-osrm.org`. Mobile `.env` correctly overrides it; the admin portal's does not. Live driver/vehicle coordinates go to a third party | Self-hosted OSRM is already deployed (`fleettrack-routing.duckdns.org`) — set `VITE_OSRM_URL`. Better: make the default `undefined` and fail loudly, so this can't regress silently |
| S-4 | Medium | CWE-770 / A04 | [LoginRateLimitFilter.java:34](../backend/api-gateway_1/src/main/java/com/fleettrack/gateway/filter/LoginRateLimitFilter.java#L34) | Counters live in a per-instance `ConcurrentHashMap`. Scale the gateway to N replicas and the effective limit becomes N×10/min; a restart resets it to zero | Move to Redis (already deployed) with an `INCR`+`EXPIRE` window |
| ~~S-5~~ | — | — | [profile.jsx:121](../mobile/app/(driver)/profile.jsx#L121) | **NOT A FINDING — I got this wrong.** I carried it forward from 2026-07-14 #6 without re-reading the file. `confirmSignOut` already does `await authService.logout()`, which POSTs `/auth/logout` to revoke the refresh token server-side before deleting either token from SecureStore. Verified 2026-07-31 | None |
| S-6 | Medium | CWE-1104 | All `pom.xml` | Spring Boot **3.2.5** (April 2024) across 10 of 11 services; `eureka-server_1` is on 3.3.4, so the stack is already inconsistent. 3.2.x is past its OSS support window — no free security patches are being issued for it | Align all services on a supported 3.3.x/3.5.x line. **Run a real scan first** (§8) |
| S-7 | Low | CWE-16 | [CorsConfig.java:35](../backend/api-gateway_1/src/main/java/com/fleettrack/gateway/config/CorsConfig.java#L35) | `setAllowCredentials(true)` but auth is bearer-token, not cookie — it grants nothing and widens the CORS contract | Set to `false` unless/until S-1 moves to cookies |
| S-8 | Low | CWE-532 | `JwtAuthFilter` | `logging.level.com.fleettrack.gateway: DEBUG` in the shipped `application.yml`, and DEBUG lines log `userId`/`role` per request | Set INFO for non-dev profiles |

**Checked and clean:** no `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in the
portal (XSS surface is genuinely small); no SQL string concatenation — all repository access
is JPA/derived queries; mobile tokens are in `expo-secure-store` (Keychain/Keystore), not
AsyncStorage; gateway identity headers are set-not-added; `.env` never committed;
`google-services.json` is correctly *not* gitignored and the reasoning in `.gitignore` is right.

**Not implemented (accept or schedule, not "findings"):** MFA, certificate pinning, root/
jailbreak detection, `FLAG_SECURE` screenshot blocking. Reasonable omissions for this stage —
list them as known gaps rather than silently carrying them.

---

## 5. Memory findings

| # | Sev | Location | Issue | Est. impact |
|---|---|---|---|---|
| **M-1** | High | [map.jsx:54](../mobile/app/(driver)/trip/[id]/map.jsx#L54) | **`routeCache` was unbounded.** Module-level `Map` holding each trip's full decoded OSRM polyline + turn list; entries removed only on trip completion | A 300 km route decodes to thousands of `{latitude, longitude}` objects. ~0.5–2 MB per cached trip; 10 opened-but-incomplete trips ≈ **5–20 MB retained** for the app session | 
| **M-2** | Medium | [mediaService_3.js](../mobile/services/mediaService_3.js) | **Upload retry queue was unbounded**, and retry-exhausted entries were kept forever. The whole JSON blob is read + parsed + re-serialised on every capture and every foreground | Grows without limit across a no-signal shift; O(N) parse cost on a hot path |
| **M-3** | High | `gps_pings`, `audit_logs`, `processed_events`, outbox tables | **No retention or purge job anywhere.** Only `@Scheduled` jobs are `IntegrityCheckJob`, `DailySummaryScheduler` and the outbox publisher — none of them delete | GPS pings at ~1 per 2 s per active vehicle = **43,200 rows/vehicle/day**. A 20-vehicle fleet at 8 h/day ≈ **288k rows/day, ~105M rows/year**. This will dominate DB size and slow every unindexed scan long before anything else does |
| M-4 | Medium | [map.jsx](../mobile/app/(driver)/trip/[id]/map.jsx) `onPositionUpdate` | `fullCoords.slice(0, closestIdx + 1)` allocates a **new array of up to N points on every accepted GPS fix**, then `setCompleted()` re-renders the screen with it | At a fix every 2 s over a 4 h drive: ~7,200 allocations of a multi-thousand-element array. Significant sustained GC pressure on the exact screen that must stay smooth |
| M-5 | Low | `LoginRateLimitFilter` | Cleanup only fires when `size > 50_000`, so the map holds every login-attempting IP until then | Bounded at ~4 MB. Acceptable; noting it because the bound is implicit |
| M-6 | Low | `infrastructure_1/docker-compose.yml` | Summed container limits ≈ **9.2 GB** (2 GB Postgres + 1 GB OSRM + 9×512 MB services + …) | Won't co-run with a dev environment on a 16 GB laptop. Right-size or split into core/full profiles |

---

## 6. Performance findings

| # | Sev | Location | Issue | Est. gain if fixed |
|---|---|---|---|---|
| **P-1** | High | [map.jsx](../mobile/app/(driver)/trip/[id]/map.jsx) `onPositionUpdate` | **Three full O(N) scans of the route polyline per GPS fix**: nearest-vertex search over `fullCoords`, then a second scan over `remaining` for the off-route check, plus a scan of `dirs`. All recomputed from scratch every 2 s | The driver's position moves monotonically along the route — search a **±50-point window around the last index** instead of the whole array. On a 5,000-point route that is ~50× fewer haversine calls per fix. Combined with M-4, this is the single biggest battery/thermal win available in the app |
| **P-2** | High | `onPositionUpdate` | Four `setState` calls per fix (`setPosition`, `setHeading`, `setSpeed`, `setCompleted`) each re-render a **2,900-line component** | Batch into one state object, and skip `setCompleted` when `closestIdx` is unchanged (it usually is between adjacent fixes). Est. **~4× fewer renders** on the nav screen |
| **P-3** | Medium | [NotificationBell.jsx:14](../admin-portal_4/src/components/common/NotificationBell.jsx#L14), [DashboardPage.jsx:222](../admin-portal_4/src/pages/DashboardPage.jsx#L222) | Bell polls **all trips + all incidents every 20 s**; Dashboard polls 3 endpoints every 30 s; neither pauses on `document.hidden`. A backgrounded tab polls all day | Add a `visibilitychange` guard — **~100% of idle-tab traffic** eliminated. Cheap, low risk |
| P-4 | Medium | `getDerivedNotifications()` | Builds the notification feed by fetching **entire** trip and incident lists client-side, then filtering to 40 items in JS | A `GET /notifications/recent` endpoint returning 40 rows replaces two full list fetches every 20 s |
| P-5 | Medium | `mapTripsWithStops` (trip-service) | Maps a page of trips and loads each trip's stops — classic **N+1** shape (50 trips → 51 queries) | `@EntityGraph` or a single `findByTripIdIn(ids)` batch. ~50× fewer round-trips per list call |
| ~~P-6~~ | — | `gps_pings` | **RESOLVED ON INSPECTION — no action needed.** `V1__create_gps_tables.sql:17` already creates `idx_gps_trip_time ON gps_pings(trip_id, recorded_at ASC)`. The `ASC` is not a problem: with `trip_id` fixed by equality, `ORDER BY recorded_at DESC` is served by a backward scan of the same btree. It covers all three hot queries (`getRoute`, `getLatestPing`, the plausibility check's previous-ping lookup) | — |
| P-7 | Low | Mobile: 4 independent `GET /trips` pollers | `useAlertsPoller` (25 s), dashboard, notifications (15 s), trip history — all fetch the same list and re-filter | The `driverStore_1` shared-cache pattern already in the codebase is the answer; extend it to trips. ~4× fewer requests |
| P-8 | Low | `TieredStopAtLevel=1` in all `JAVA_TOOL_OPTIONS` | Correct for dev (fast cold start) but **caps the JIT at C1 in production too**, costing steady-state throughput | Drop this flag in the prod compose overlay |

---

## 7. Code changes applied

Two changes, both self-contained memory fixes with no UI or business-logic impact.
`npx eslint` on both files: **0 errors** (9 pre-existing a11y warnings, untouched).

### Change 1 — bound `routeCache` (M-1)

**File:** [`mobile/app/(driver)/trip/[id]/map.jsx`](../mobile/app/(driver)/trip/[id]/map.jsx)

*Before* — a `Map` that only ever shrank when a trip was completed:
```js
const routeCache = new Map();
// …
routeCache.set(tripId, { trip, fullCoords, completedCoords, directions, … });
```

*After* — a 3-entry LRU, exploiting `Map`'s insertion-order guarantee:
```js
const ROUTE_CACHE_MAX = 3;
const routeCache = new Map();

function cacheRoute(tripId, snapshot) {
  routeCache.delete(tripId);        // re-insert ⇒ moves to most-recent
  routeCache.set(tripId, snapshot);
  while (routeCache.size > ROUTE_CACHE_MAX) {
    routeCache.delete(routeCache.keys().next().value);
  }
}
```

**Reason:** each entry retains a full decoded polyline. Eviction is behaviourally invisible —
a miss just takes the same load path the first open already takes. 3 covers the realistic
"switch between a couple of trips" case.

### Change 2 — bound the upload retry queue + single-flight it (M-2)

**File:** [`mobile/services/mediaService_3.js`](../mobile/services/mediaService_3.js)

- `writeQueue()` now caps at `MAX_QUEUE_ITEMS = 50`, keeping the **newest** entries.
- `retryFailedUploads()` is now single-flight via a module-level `retryInFlight` promise.
  It is called on mount *and* on every foreground; a slow run could previously still be
  in-flight when the next started, so both read the same queue, **uploaded the same photos
  twice**, and the slower one's final `writeQueue()` clobbered the faster one's result.

**Deliberately NOT changed:** entries that exhaust `MAX_RETRIES` are still **kept**, not
dropped. I initially wrote the drop and reverted it — these are POD and pre-dispatch photos,
and silently discarding one destroys delivery evidence. The queue is bounded by
`MAX_QUEUE_ITEMS` instead. **The real fix is a product decision:** surface stranded uploads to
the driver ("3 photos failed to upload — retry?") rather than stranding them in a file. Logged
as R-1 below.

---

## 8. Dependencies

**No CVE scan was run.** These are manifest facts; run the commands in §9 before drawing
security conclusions.

| Component | Version | Note |
|---|---|---|
| Spring Boot | **3.2.5** (10 services) / 3.3.4 (eureka) | April 2024. Past OSS support; inconsistent across the stack. See S-6 |
| Spring Cloud | 2023.0.1 / 2023.0.3 | Same inconsistency |
| jjwt | 0.12.5 | Current-ish; fine |
| React | 19.2.7 (portal) / 19.1.0 (mobile) | Current |
| Expo SDK | 54 | Current |
| Vite | ^5.4.1 | 6.x and 7.x exist; 5.x still maintained |
| zustand | ^4.4.0 | 5.x available; no urgency |
| `sockjs-client` | ^1.6.1 | Legacy. Needs the `global: "globalThis"` shim already in `vite.config.js`. Modern browsers all support native WebSocket — dropping SockJS would remove a dependency *and* a build workaround |
| `@expo/ngrok` | ^4.1.3 | **A dev tunnelling tool in `dependencies`, not `devDependencies`.** Move it — it has no business in a production bundle |
| `admin-portal/` (no suffix) | — | Deleted in git index but `node_modules/` remains on disk. Remove the directory |

---

## 9. How to actually measure (Part 13)

Nothing here was measured. Run these to get real numbers:

```powershell
# Dependency CVEs
cd admin-portal_4; npm audit --production
cd ../mobile;      npm audit --production
cd ../backend/trip-service_2; mvn org.owasp:dependency-check-maven:check

# Bundle size + composition
cd admin-portal_4; npm run build          # Vite prints per-chunk gzip sizes

# JVM heap / GC per service
docker stats --no-stream
docker exec <container> jcmd 1 GC.heap_info

# DB: slow queries + missing indexes
#   in psql — confirm P-6's index exists and check table growth
EXPLAIN ANALYZE SELECT * FROM gps.gps_pings WHERE trip_id = 1 ORDER BY recorded_at DESC LIMIT 100;
SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

# Mobile: render counts + JS thread
#   React DevTools Profiler on the map screen, and Perf Monitor for JS FPS while driving
```

Capture these **before** the §10 work so the after-numbers mean something.

---

## 10. Prioritised action plan

### Immediate (this week)
1. ~~**C-2**~~ — **local half done 2026-07-31.** Fresh `JWT_SECRET`/`INTERNAL_SERVICE_SECRET`/`REDIS_PASSWORD` written to `infrastructure_1/.env`; the Gmail app password removed and left blank. **Two things remain and only you can do them:** revoke the old app password in Google, and rotate the *server's* `.env` (verified separate — `deploy-v1.yml` SSHes in and uses the host's own file; CI never carries app secrets).
2. ~~**C-1**~~ — **stopgap done 2026-07-31.** Explicit `size` on all six admin + six mobile list calls, plus a deterministic `createdAt DESC` sort on the four paginated controllers. The proper fix (aggregate endpoints + server-driven pagination) is still outstanding.
3. **M-3** — add a retention job for `gps_pings` (e.g. delete pings older than 90 days, keep a downsampled route). Every week this waits makes the first run more painful. *(~half a day)*
4. **S-5** — one-line `authService.logout()` call. *(~10 minutes)*

### High priority (this month)
5. **P-1 + P-2 + M-4** — the `onPositionUpdate` rewrite: windowed search, batched state, skip no-op `setCompleted`. Biggest single perf win in the product. *(~1 day, needs real-device road testing)*
6. **S-2** — CSP on the portal's own hosting. *(~1 hour)*
7. **S-3** — point the portal at the self-hosted OSRM; make the public default fail loudly. *(~30 minutes)*
8. **P-3** — `visibilitychange` guards on both pollers. *(~1 hour)*
9. ~~**P-6**~~ — **verified 2026-07-31: `idx_gps_trip_time` already exists and is correct. No action.**

### Medium term (this quarter)
10. **S-1** — refresh token to `HttpOnly` cookie. Touches auth on both clients; do it deliberately.
11. **S-6** — align every service on one supported Spring Boot line, after a dependency-check run.
12. **P-5** — fix the `mapTripsWithStops` N+1.
13. **S-4** — Redis-backed rate limiting before the gateway is ever scaled past one replica.
14. **Commit the tests, then wire them into CI.** Corrected 2026-07-31: the tests exist and pass —
    `TripControllerAuthorizationTest` (4), `AuthServiceSecurityTest` (11),
    `StompSubscribeAuthorizationTest` (14), `LoginRateLimitFilterTest` (6), plus 12 Playwright
    specs. **All untracked**, so CI has never run one. Committing them is most of the work;
    after that, add `mvn test` to `test-and-build.yml`. Note the existing suites would *not*
    have caught C-1 — none asserts the pagination contract, so add that case.

### Nice to have
15. **R-1** — surface stranded photo uploads to the driver (see §7).
16. Split `map.jsx` (2,900 lines) into the hook/component seams the empty stubs in `hooks/` already sketch out.
17. Delete the ~30 stub files and the orphaned `admin-portal/` directory.
18. Drop `sockjs-client` for native WebSocket; move `@expo/ngrok` to devDependencies.
19. Remove `TieredStopAtLevel=1` from the production compose overlay (P-8).

---

## 11. Expected improvement after the plan

Estimates, reasoned from code shape — validate against §9 baselines.

| Metric | Expected change | Driver |
|---|---|---|
| Mobile JS thread during navigation | **~50–80% less work per GPS fix** | P-1 windowed search, P-2 batched renders |
| Mobile retained heap (long session) | **~5–20 MB lower** | M-1 (applied), M-4 |
| Admin idle-tab network | **→ ~0** | P-3 visibility guards |
| Admin active network | **~60–70% lower** | P-4 dedicated endpoint replacing two full list fetches per 20 s |
| Trip-list API round-trips | **~50× fewer** | P-5 N+1 fix |
| DB size growth | **Bounded instead of unbounded** | M-3 retention |
| Dashboard correctness | **Wrong → right** | C-1 — the one that actually matters |
| Security posture | Good → strong | C-2, S-1, S-2, S-3 |

The honest summary: **this is a well-built system that has visibly absorbed its last audit.**
The security work is real and mostly done. What is left is one silent correctness bug born of
a half-applied fix, one credential to rotate, unbounded data growth, a hot loop that does far
more work than it needs to — and a test suite that does not exist yet, which is what would
have caught the first of those.
