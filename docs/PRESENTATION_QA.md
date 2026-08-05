# FleetSync Pro — Evaluator Q&A

Answers to the 20 evaluator questions and the 10 engineer follow-ups, grounded in what the
code actually does. Every number and mechanism here was checked against the source, not
recalled — file references are included so you can open the proof mid-answer.

**How to use this.** Each answer has a **short answer** (what you say), the **mechanism**
(the detail that proves you understand it), and where relevant **if they push** — the
follow-up an examiner asks when your first answer is good.

**The single most important rule for this viva:** where something is not built, say so.
Question 16 and question 18 both contain a genuine gap in this project. An examiner who
finds a gap you claimed was covered will discount everything else you said. An examiner who
watches you name your own gap will trust the rest.

---

## 1. Problem statement

**What real-world problem does FleetSync Pro solve, and why is it better than manual methods?**

**Short answer.** A delivery company running vans has no reliable idea where they are. The
dispatcher's information comes from phone calls to drivers, a paper or spreadsheet log of who
took which vehicle, and a photo of a signature that lives on the driver's phone. FleetSync
Pro replaces all three with one system: live vehicle positions on a map, a trip lifecycle the
system enforces, and proof-of-delivery stored centrally.

**Why it beats the manual process** — three concrete things, not just "it's digital":

| Manual today | FleetSync Pro |
|---|---|
| "Where are you?" phone call | Live map, position updated roughly every 2 seconds |
| Vehicle double-booked because the spreadsheet was stale | Vehicle status is a state machine — an `IN_USE` vehicle cannot be assigned |
| POD photo sits on the driver's phone | Uploaded to object storage, attached to the trip, retrievable months later |
| "Was that delivery late?" — nobody knows | Every trip has a recorded ETA and actual completion time |

**If they push — "couldn't a WhatsApp group do most of this?"** For visibility, partly. Not
for the parts that need enforced state: WhatsApp cannot stop a dispatcher assigning a van
that is already out, cannot tell you the on-time rate across 200 trips, and cannot produce an
audit trail of who cancelled what. The value is in the constraints the system enforces, not
in the messaging.

---

## 2. System overview

**Explain the complete workflow of a delivery, from trip creation to completion.**

Walk it as a story. This is the answer most likely to be asked first, so know it cold.

1. **Dispatcher creates the trip** in the admin portal — picks a driver, a vehicle, origin,
   destination, and any intermediate stops.
2. **trip-service validates and reserves.** It calls driver-service and vehicle-service to
   confirm both are available, then sets the vehicle to `IN_USE` so nobody else can take it.
   The trip is written with status `ASSIGNED`.
3. **An event is recorded, not sent.** In the same database transaction as the trip, a
   `trip.created` row is written to an outbox table (see Q6 — this is the important bit).
4. **The driver's phone picks up the trip** and shows it in their app.
5. **The driver starts.** Status moves `ASSIGNED → STARTED → EN_ROUTE`. From this point the
   phone streams GPS positions about every 2 seconds.
6. **gps-service takes each ping**, rejects it if it is implausible (Q7), caches the latest
   position in Redis, writes it to Postgres, and pushes it out over a websocket.
7. **The dispatcher's map moves** in real time (Q8). If the driver strays off the planned
   route, deviation detection fires.
8. **The driver arrives** — a geofence check confirms they are within 50 m of the destination,
   and status becomes `ARRIVED`.
9. **Proof of delivery.** The driver photographs the delivery. The photo uploads directly to
   MinIO using a presigned URL, so the image never passes through the API.
10. **Completion.** trip-service verifies a POD exists, sets the trip `DELIVERED`, and
    **releases the vehicle back to `AVAILABLE`** so it can be dispatched again.
11. **Downstream reacts.** notification-service emails, audit-service records the trail.

**If they push — "what if the driver never marks it delivered?"** The trip stays open; the
ETA column shows it as overdue. And there is a reconciliation sweep (Q20) that catches
vehicles left stranded by any path that failed to release them.

---

## 3. Architecture decision — why microservices

**Why microservices instead of a monolith? Would you do it again?**

**Short answer.** Honestly: partly for the right reasons, partly because the module was about
distributed systems. Be straight about that — examiners respect it and it is the truthful
answer.

**The reasons that genuinely hold for this system:**

- **The load profile is wildly uneven.** gps-service takes a ping every 2 seconds from every
  active driver. vehicle-service handles maybe a few dozen requests an hour. In a monolith
  those share a thread pool and a connection pool, so a GPS surge starves the fleet screen.
  Separated, gps-service can be scaled or throttled on its own.
- **Failure isolation.** notification-service talking to Gmail is the least reliable part of
  the system. In a monolith a hung SMTP connection ties up request threads that trip creation
  needs. Separated, notifications degrade alone.
- **Independent deployment.** We shipped a vehicle-release fix by rebuilding two containers.
  The other fifteen kept running and nobody logged out.

**Would I do it again?** For this size of team and this traffic — **no, not eleven services.**
The honest cost was real: eleven `pom.xml` files, eleven Dockerfiles, service discovery,
cross-service HTTP calls where a SQL join would have done, and a bug (Q20) that only existed
because two services had to agree about one piece of state. I would build a **modular
monolith** — one deployable with strict internal module boundaries — and split out
**gps-service** alone, because that is the only component whose load profile actually differs.
That gets most of the benefit for a fraction of the operational cost.

---

## 4. Service responsibilities and schema ownership

**Why does each service own its own schema instead of sharing tables?**

**Short answer.** So that a change to one service's tables cannot silently break another
service. If trip-service could read `vehicle.vehicles` directly, then renaming a column in
vehicle-service breaks trip-service at runtime — with no compiler error and no test failure
to warn you. Forcing the access through an API turns that into a contract you can version.

**Mechanism.** One PostgreSQL instance, **ten schemas**, created by
`infrastructure_1/db/init/01_create_databases.sql`:

```
fleettrack_auth   driver   vehicle   trip   gps
media   incident   notif   audit   analytics
```

Each service's datasource sets its own `default_schema`. There are **no cross-schema foreign
keys** — that is the deliberate part, and it is what makes Q-bonus-4 (splitting into separate
database servers) possible later without a rewrite.

**If they push — "so how does trip-service know the vehicle exists?"** It asks
vehicle-service over HTTP (`VehicleServiceClient`). The trade-off is honest: we gave up
referential integrity that the database would have enforced for free, and bought the ability
to change each service independently. If vehicle-service is down, trip creation fails — which
is the correct behaviour, since we cannot verify the vehicle is free.

---

## 5. Synchronous vs. asynchronous communication

**When do services talk synchronously, and when asynchronously?**

The rule we applied: **if the caller cannot proceed without the answer, call it directly. If
the caller does not care about the result, publish an event.**

**Synchronous (HTTP, through the gateway with load-balanced service discovery):**

| Caller → callee | Why it must be synchronous |
|---|---|
| trip-service → vehicle-service (is this van free?) | You cannot create the trip without the answer |
| trip-service → driver-service (is this driver available?) | Same |
| trip-service → media-service (does a POD photo exist?) | Completion is blocked until it does |
| trip-service → OSRM (route and ETA) | The route is part of the trip being created |
| gateway → auth-service (is this token valid?) | The request cannot be routed until you know |

**Asynchronous (RabbitMQ events):**

| Event | Consumed by | Why async is right |
|---|---|---|
| `trip.created`, `trip.completed`, `trip.cancelled` | notification-service, audit-service | An email failing must never fail a delivery |
| `incident.reported` | notification-service | Alerting is a side effect of reporting |
| all events (wildcard) | audit-service | Audit must observe everything without any service knowing it exists |

**The tell of a good answer:** audit-service is subscribed with a **wildcard** consumer, so
no other service has any code that mentions auditing. That is the whole point of events —
you can add a consumer without touching a producer.

---

## 6. RabbitMQ goes offline mid-assignment

**RabbitMQ dies while a dispatcher assigns a trip. What happens? Does the trip still get created?**

**Short answer. Yes, the trip is created normally, and the event is not lost.** This is the
**Transactional Outbox** pattern and it is the strongest engineering answer in the project —
know it properly.

**Why the naive version is broken.** The obvious implementation is:

```
save trip to database
publish event to RabbitMQ     ← if this throws, what state are you in?
```

Two failure modes, both bad. If you publish inside the transaction and the transaction later
rolls back, you have announced a trip that does not exist. If you publish after commit and
the broker is down, the trip exists but nobody downstream ever hears — no email, no audit
record, silently.

**What we do instead.** The event is written to an **outbox table in the same database
transaction as the trip itself**:

```
BEGIN
  INSERT INTO trip.trips        (...)
  INSERT INTO trip.outbox_event (...)   -- the event, as a row
COMMIT
```

Both succeed or both fail — one transaction, so they can never disagree. A separate publisher
(`OutboxPublisherService`, `@Scheduled(fixedDelay = 30000)`) then reads unpublished rows every
30 seconds and pushes them to RabbitMQ, marking each one published only after the broker
accepts it.

**So with RabbitMQ down:** the dispatcher sees success, the trip is live, the driver gets it.
The event sits in the outbox. When the broker comes back, the next sweep drains the backlog
and the emails and audit records arrive late rather than never.

**If they push — "isn't 30 seconds slow?"** For notifications and audit, yes and it does not
matter — nobody needs the email in under 30 s. If it did matter we would publish immediately
after commit *and* keep the sweep as the safety net, which is a common refinement.

**If they push — "why not two-phase commit across the DB and the broker?"** XA transactions
are supported in theory but are slow, poorly supported in practice, and lock resources across
two systems. The outbox gets the same guarantee using only a database transaction, which is
why it is the standard pattern.

---

## 7. GPS noise and bad readings

**How do you stop inaccurate GPS producing wrong vehicle movement?**

**Short answer. Two filters, in order — one on the reading itself, one on the movement it
implies.** Both live in gps-service and run before anything is stored or broadcast.

**Filter 1 — reject low-confidence readings** (`GpsService.java:41`). Every ping carries the
phone's own accuracy estimate in metres. Anything worse than **50 m** is discarded outright.
This catches the classic case of a driver in an urban canyon or a covered loading bay, where
the phone reports a position it is not confident about.

**Filter 2 — reject physically impossible movement** (`PlausibilityCheckService.java`).
Compare each ping to the previous one and compute the distance using the **haversine formula**
(great-circle distance on a sphere — straight-line arithmetic on latitude/longitude is wrong
because a degree of longitude shrinks as you move away from the equator):

| Check | Threshold | Catches |
|---|---|---|
| `TELEPORT_DETECTED` | more than **5 km** in under **10 seconds** | Multipath reflection, a bad cell-tower fix, GPS reacquiring after a tunnel |
| `IMPLAUSIBLE_SPEED` | implied speed over **180 km/h** | Drift and jitter that is smaller but still not real |

**Why two thresholds and not one.** They catch different shapes of error. A jump of 5 km in
9 seconds is 2,000 km/h, so the speed check would catch it too — but a jump of 300 m in 1
second is 1,080 km/h and also caught, while a slow drift of 20 m per ping is under both and
correctly allowed through, because it might be real.

**If they push — "what about a driver genuinely on a highway?"** 180 km/h is deliberately
well above any legal road speed, so a real journey never trips it. The cost of a threshold
that is too tight is worse than one that is too loose: rejecting real positions makes the map
lie about where the van is.

**If they push — "do you smooth the track?"** No — no Kalman filter, no moving average. We
reject bad points rather than smoothing between them. Smoothing would be the next step if the
tracks still looked jittery in practice.

---

## 8. Live map updates

**How does the map update without refreshing? Why that approach?**

**Short answer.** A **WebSocket** — specifically STOMP over SockJS. The browser opens one
long-lived connection when the map loads and subscribes to position updates; gps-service
pushes each accepted ping down that connection. The page never polls and never reloads.

**Why not polling.** With 50 drivers and a 2-second refresh, polling means 30 HTTP requests a
minute per open dashboard, each with headers, a TLS record and a database query — and the
data is still up to 2 seconds stale. A websocket is one connection that stays open, and the
update arrives when the event happens rather than when the next poll comes round.

**Why SockJS on top of STOMP.** STOMP gives us topics and subscriptions — the client
subscribes to a specific trip rather than receiving every vehicle's position. SockJS is the
fallback layer: if a corporate proxy blocks websockets, it degrades to HTTP streaming instead
of the map simply not working.

**The deployment detail worth mentioning.** The socket goes through the same gateway and the
same domain as the API (`/ws/**` route), so it is covered by the same TLS certificate. Its
allowed origins come from `CORS_ALLOWED_ORIGINS` — the same variable as the REST CORS config,
because a mismatch there means the handshake is rejected and the map silently stays frozen.

---

## 9. PostgreSQL over MongoDB

**Why PostgreSQL instead of MongoDB?**

**Short answer.** Because this data is relational and the correctness requirements are
transactional. Trips reference drivers and vehicles; a trip without a valid vehicle is
meaningless. That is precisely the shape relational databases exist for.

**The specific features we depend on:**

| Feature | Where it matters |
|---|---|
| **ACID transactions** | The outbox pattern (Q6) is *only* correct because the trip row and the event row commit together. In a database without multi-document transactions the pattern does not work. |
| **Schemas** | Ten logical databases in one instance (Q4) — one server to run and back up, ten isolated namespaces. |
| **Constraints and enums** | Vehicle and trip status are constrained at the database level, so a bug cannot write a status that does not exist. |
| **Joins and aggregates** | Reports — on-time rate, trips per driver — are SQL. In a document store this becomes application code or a duplicated aggregate. |
| **Mature migrations** | Flyway runs versioned migrations on startup, so schema changes ship with the code that needs them. |

**The honest concession.** There is one part of the system that genuinely suits a different
store: `gps_pings` is high-volume, append-only, time-ordered data that is never updated — the
classic time-series shape. At scale that belongs in TimescaleDB, InfluxDB or a partitioned
table (Q15). Saying this unprompted shows you chose Postgres rather than defaulted to it.

---

## 10. Spoofing `X-User-Role: ADMIN`

**Someone sends `X-User-Role: ADMIN` manually. Why don't they become an admin?**

**Short answer. Because the gateway overwrites that header on every request before the
request reaches any service.** The client's value is discarded, whatever it was.

**Mechanism** (`JwtAuthFilter.java:76-81`). After the gateway validates the JWT with
auth-service, it mutates the request:

```java
var mutatedRequest = exchange.getRequest().mutate()
        .headers(h -> {
            h.set("X-User-Id", userId);   // set, NOT add
            h.set("X-User-Role", role);   // value comes from the validated token
        })
        .build();
```

The critical detail is **`set` rather than `add`.** `add` would append, leaving the attacker's
value present alongside the real one — and whichever the downstream service read first would
decide the outcome. `set` replaces. The role a service sees always originates from a
signed token that auth-service verified, never from the wire.

**The second layer, which is the better half of the answer.** Services also accept internal
service-to-service calls. A naive check would be "does this request carry the internal
secret?" — but the gateway stamps that secret on **every** proxied request, including an
ordinary user's. So the secret alone cannot distinguish a genuine internal call from a
user's request. `VehicleController.isGenuinelyInternal` requires **both** conditions:

```java
return internalServiceSecret.equals(internalKey)
        && (role == null || role.isBlank());   // a real internal call has NO user role
```

A user request always carries `X-User-Role`; a genuine service-to-service call never does.
Requiring the absence of the role is what closes the hole.

**If they push — "what if someone reaches a service directly, bypassing the gateway?"** They
cannot from outside. Business services use Docker `expose`, not `ports` — they are reachable
only on the internal Docker network, never published to the host, and the host itself only
exposes 80 and 443 through Caddy.

---

## 11. Access tokens and refresh tokens

**Why two tokens instead of one JWT?**

**Short answer.** They solve opposite problems, and one token cannot do both. A JWT is fast
to check because it is **stateless** — the gateway verifies the signature without a database
lookup. But statelessness means you **cannot revoke it**. If a token is stolen it is valid
until it expires, and nothing you do server-side stops it.

The two-token split resolves the tension:

| | Access token | Refresh token |
|---|---|---|
| Lifetime | **15 minutes** | **7 days** |
| Stored server-side | No | Yes, **hashed** |
| Used on | Every API request | Only to get a new access token |
| Revocable | No | Yes, immediately |

A stolen access token is useful for at most 15 minutes. A stolen refresh token is revocable
the moment it is used, because refresh tokens are stored and checked.

**The part that impresses — reuse detection.** Every refresh token carries a `familyId`
(`AuthService.java:160`). Refreshing rotates the token: the old one is revoked and a new one
issued in the same family. So if a **revoked** token is ever presented again, that means
someone is replaying a token that was already spent — the only realistic explanation is
theft. The response is not to reject that one request but to **revoke the entire family**
(`revokeAllByFamilyId`, line 189), logging out every session descended from that login.

The reasoning: if an attacker stole a token, you cannot tell whether the legitimate user or
the attacker is the one now being blocked — so you invalidate both and force a fresh login,
which only the real user can complete.

**Other auth hardening worth naming:** BCrypt with **cost factor 12**, and account lockout
after **5 failed attempts for 15 minutes** — with the counter incremented atomically in the
database, because a read-then-write would let parallel guessing exceed the limit without ever
tripping the lock.

---

## 12. OSRM over Google Maps Directions

**Why self-hosted OSRM instead of the Google Directions API?**

**Short answer.** Cost and request volume. This app does not ask for a route once per trip —
it re-routes whenever a driver deviates, and recomputes ETAs as they move. That is a
continuous stream of routing requests per active driver. On a metered API that is the single
largest running cost in the system. Self-hosted OSRM is a fixed 1 GB container and unlimited
requests.

**Advantages**

- **No per-request cost and no quota.** We can re-route as often as accuracy demands rather
  than as often as the budget allows.
- **No API key to leak.** One less secret in the mobile app.
- **Data privacy.** Customer delivery addresses never leave our infrastructure.
- **Works offline from the internet.** OSRM needs no external connectivity at all.

**Disadvantages — say these unprompted, it is the stronger answer**

- **No live traffic.** This is the real cost. OSRM routes on road geometry and speed limits,
  so our ETAs are "free-flowing" estimates. In Accra traffic they will be optimistic. Google's
  ETAs would be materially better.
- **Stale map data.** The Ghana extract is a point-in-time download from Geofabrik. A new road
  does not appear until we rebuild the graph.
- **Operational burden.** We build the routing graph ourselves (`osrm-extract`, `osrm-partition`,
  `osrm-customize`) and the data folder is gitignored — if you forget that step, the container
  crash-loops and all routing dies while the rest of the stack comes up looking fine.
- **No places, geocoding or lane guidance.**

**If they push — "so would you switch?"** For ETA quality in a congested city, a hybrid is
right: OSRM for the continuous re-routing and deviation checks, and a paid traffic-aware call
at trip creation for the customer-facing ETA. That keeps the request volume — and therefore
the bill — low, while spending money only where accuracy is visible to a customer.

---

## 13. Deployment path — browser to backend service

**Describe exactly how a request travels from the browser or phone to a backend service.**

Trace one request end to end. Full detail is in [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

1. **The admin portal is not on our server.** It is a static React bundle built by Vite and
   hosted on **Render**. The browser downloads HTML and JavaScript from Render's CDN.
2. **The app calls the API** at `https://fleettrack.duckdns.org` — a DuckDNS name whose A
   record points at our Google Cloud VM's external IP. (`VITE_API_BASE_URL` is baked in **at
   build time**, not read at runtime — changing it needs a rebuild, not a restart.)
3. **Port 443 on the VM reaches Caddy**, the only container facing the internet. Caddy
   terminates TLS with a certificate it obtained and renews automatically from Let's Encrypt.
4. **Caddy proxies to `api-gateway:8080`** over the internal Docker network — by container
   name, since Docker provides DNS between containers.
5. **The gateway authenticates.** It calls auth-service to validate the JWT, then overwrites
   `X-User-Id` and `X-User-Role` from the validated token (Q10).
6. **The gateway routes by path** — `/trips/**` → `lb://trip-service`. The `lb://` prefix means
   it asks **Eureka** which instances are registered and load-balances between them, rather
   than using a hardcoded address.
7. **trip-service handles it**, reading and writing only its own `trip` schema in the shared
   PostgreSQL instance.
8. **The response returns** back along the same path.

**Two routes deliberately skip the gateway**, and knowing why is the mark of understanding the
design:

- **Photos** go to `fleettrack-storage.duckdns.org` → MinIO. MinIO signs presigned URLs
  **against its own hostname**, so behind a path prefix the signature fails to validate. It
  needs a clean host of its own. This also means large uploads never pass through the API.
- **Turn-by-turn routing** goes to `fleettrack-routing.duckdns.org` → OSRM, called directly by
  the driver app. Routing during navigation is high-frequency and carries no user data, so
  putting it through the gateway would add JWT validation to every call for no benefit.

---

## 14. Personal contribution

**Which parts were you responsible for? What decisions did you make and what was hard?**

*This one is yours to write — nobody can answer it for you. What follows is the structure that
scores well, and material from this project you can draw on.*

**Structure:** name the area → name a decision you made and the alternative you rejected →
name a bug that was genuinely hard → say what you learned.

**Decisions in this codebase with a real "why", if you owned these areas:**

- **Vehicle release via a dedicated endpoint** rather than the generic status endpoint. The
  generic one would let a late-firing reconciliation sweep drag a van out of `MAINTENANCE` and
  back into dispatch. A narrow `PUT /vehicles/{id}/release` that only does `IN_USE → AVAILABLE`
  puts the rule in the service that owns the data, so no caller has to remember it.
- **Design tokens in three layers** in the admin portal, where dark mode remaps only the
  middle layer. Any component that hardcodes a colour fails to flip — the architecture makes
  the mistake visible instead of tolerable.
- **The accuracy filter before the plausibility filter** in gps-service — reject cheaply on a
  single reading before doing the more expensive comparison against history.

**Bugs from this project that make good "what was hard" answers** — the shape to use is
*symptom → what I assumed → what it actually was → how I proved it*:

- **Vehicles never returned to the fleet.** Completing a trip never released the vehicle, so
  every successful delivery permanently shrank the dispatchable fleet by one. What made it
  interesting is that it looked like a display bug — the vehicle was on screen, just wrong.
- **A dark-mode contrast bug that came from a token being used for the wrong job.**
  `--color-white` is a *surface* token; used as a *text* colour on a navy fill it measured
  1.46:1 in dark mode — invisible. The fix was conceptual, not cosmetic: text on a fill that
  does not invert must not invert either.
- **A stale-jar false positive during deployment.** I grepped the deployed jar for a string
  and found it, and concluded the fix was live — but the *old* code contained that same
  string. A fresh image timestamp reinforced the wrong conclusion. The real proof was reading
  the compiled constant pool: two constants meant old, one meant new. The lesson is about
  verification design, not about that bug: a check that cannot fail proves nothing.
- **The ETA column overlapping the Actions column.** `white-space: nowrap` on a 146px column
  where the content measured 203px. Measured both before and after against the built
  stylesheet rather than eyeballing it.

---

## 15. Scaling from 50 to 10,000 drivers

**Which component breaks first, and how do you fix it?**

**Short answer. The `gps_pings` table in PostgreSQL — by a wide margin.** Do the arithmetic
out loud; it is the most convincing thing you can do here.

```
10,000 drivers × 1 ping / 2 seconds = 5,000 writes/second
5,000 × 3,600 × 8-hour shift        ≈ 144 million rows per day
```

Everything else is comfortable at that scale. This is not.

**Why this breaks before anything else.** It is not the raw insert rate — Postgres can take
5,000 simple inserts a second on decent hardware. It is that the table is **unpartitioned**,
so every insert also updates indexes over a table growing by 144 million rows a day. Index
maintenance degrades, autovacuum falls behind, and query latency on the live map — which
reads the same table — climbs with it.

**Fixes, cheapest first:**

1. **Partition `gps_pings` by day or week** and drop old partitions instead of deleting rows.
   Dropping a partition is instant; `DELETE` on 144 M rows is not. Add a retention policy —
   nobody needs second-by-second history from six months ago.
2. **Batch on the client.** Send one request with 15 pings every 30 seconds instead of 15
   separate requests. Same data, one-fifteenth of the HTTP and transaction overhead. This is
   already on our roadmap and would buy a large multiple on its own.
3. **Separate reads from writes.** The live map does not need Postgres at all — the latest
   position is already in Redis. Serve the map entirely from Redis and let Postgres be the
   historical archive only.
4. **Move the time-series data to a store built for it** — TimescaleDB is a Postgres extension,
   so this is the least disruptive version of that change.
5. **Scale gps-service horizontally.** It is stateless, so this is easy — but do it only after
   the above, since more instances writing to one unpartitioned table makes the real problem
   worse, not better.

**The second bottleneck**, if they ask: the **websocket fan-out**. One dispatcher watching all
10,000 vehicles is 5,000 messages a second to one browser, which no browser will render. That
is a product problem before it is an engineering one — the map should stream only vehicles in
the current viewport.

---

## 16. Driver loses connectivity

**What happens to GPS data and POD photos when the phone goes offline?**

**This is the question where you must be honest — the two cases are genuinely different, and
one of them is a known gap.** Naming it yourself is worth more than a confident wrong answer,
and an examiner who opens `mobile/store/gpsQueueStore_2.js` will find a one-line stub.

**Photos — handled properly.** `services/mediaService_3.js` implements a persistent retry
queue backed by a JSON file on the device (`ft_upload_queue.json`), so it survives the app
being closed and the phone being restarted. It has the details that matter in a real queue:

| Property | Value | Why |
|---|---|---|
| Queue cap | **50 items**, oldest dropped first | Without a cap, a driver with no signal for a shift grows a file that is fully read and re-serialised on every capture |
| Retries | **3**, then the entry is dropped | Entries that exhausted retries were previously kept forever |
| Concurrency | Overlap guard | Retry runs on mount *and* on every foreground; two overlapping runs would upload the same photo twice |

So proof of delivery is safe: the driver photographs the delivery in a dead zone, the upload
fails, and it goes out when signal returns.

**GPS — not handled. Pings are lost.** `hooks/useDriverLocationTracker.js:31` catches the
failure and discards it:

```js
} catch { /* ignore — will retry on next mount */ }
```

`store/gpsQueueStore_2.js` was intended to be the queue but is a stub — a single comment line.
So a driver who goes through a tunnel leaves a gap in the recorded track that is never filled.

**What I would build**, and why it is not merely copying the photo queue: GPS is
higher-volume and lower-value-per-item. A 30-minute dead zone is ~900 pings, so it needs a
ring buffer with a hard cap and it should batch on flush rather than replaying 900 individual
requests. Because each ping carries its own `recordedAt`, the server orders correctly on
arrival — the map back-fills the missing segment rather than showing a teleport.

**A second, related gap worth owning.** Tracking uses `Location.watchPositionAsync`, which is
**foreground-only**. If the driver switches to WhatsApp or locks the phone, tracking stops.
Production would need `startLocationUpdatesAsync` with a TaskManager background task and a
persistent notification (see bonus Q6).

---

## 17. Security audit findings

**What vulnerabilities were found, and how were they fixed?**

We ran a structured audit across the portal, backend, infrastructure, CI and documentation.
Roughly 40 issues were found and fixed. The ones worth presenting:

| Finding | Risk | Fix |
|---|---|---|
| **Redis had no password** | An unauthenticated Redis reachable on the network is a well-known remote-code-execution primitive via `CONFIG SET` | `--requirepass`, plus loopback-only binding |
| **Internal secret alone treated a request as internal** | The gateway stamps that secret on *every* proxied request, including a normal user's — so a user request could be mistaken for a service call | Require the secret **and** the absence of `X-User-Role` (Q10) |
| **Internal services published to the host** | Anyone reaching the host could bypass the gateway and its JWT check | `expose` instead of `ports`; `HOST_BIND=127.0.0.1` for the rest |
| **Redis and Postgres OOM-killed under their own limits** | Availability: Postgres was killed mid-transaction and `restart: unless-stopped` masked it as a blip | Raised the caps above each engine's real working set; gave Redis a `maxmemory` below its cgroup cap so it evicts rather than dying |
| **Trip cancellation had no confirmation** | One mis-click permanently cancelled a live delivery and notified the driver | Confirmation dialog, matching the already-guarded path elsewhere |
| **Dark-mode contrast failures** (multiple) | Accessibility — one measured **1.46:1** against a 4.5:1 requirement | Correct semantic tokens; verified with axe-core |
| **Dashboard counted every driver as active** | `d.active` was read where the DTO field is `isActive`, so the expression was `undefined` — falsy, but counted | Corrected against the actual DTO |
| **Metrics rendered with no backing API** | Driver stats showed a hardcoded `0` for fields that do not exist on the DTO, which reads as a measurement | Removed; genuinely-null values render as an em-dash with an explanatory sub-line rather than a misleading `0%` |

**Still open, and you should say so:** `JWT_SECRET` and the Google Maps Android key are in git
history and need rotating; purging the Maps key from history is what currently keeps the CI
secret scan red. There are also **no automated backups** (Q18).

**The security posture that was already right:** BCrypt cost 12, atomic failed-attempt
counting, refresh-token rotation with family revocation, rate limiting, JWT validated at the
gateway, and TLS everywhere via Caddy.

---

## 18. Missing features and limitations

**What is missing, why, and what would you build with one more month?**

**Missing, ranked by how much they would actually hurt in production:**

1. **No backups.** Zero. If the VM's disk fails, every trip, photo and audit record is gone.
   Not built because it needs somewhere to put them and a tested restore, and we prioritised
   features. **This is the most serious gap in the project.**
2. **Offline GPS queue and background tracking** (Q16). Tracking stops when the driver leaves
   the app.
3. **No observability.** No metrics, no structured logs, no alerting. Diagnosis is
   `docker compose logs`. We would find out about an outage from a user.
4. **`gps_pings` is unpartitioned** with no retention policy (Q15).
5. **analytics-service is an unimplemented stub** — no `pom.xml`, no main class. Its schema
   exists and nothing writes to it. It is deliberately not deployed.
6. **No push notifications** by default — in-app polling covers the current need.
7. **Single point of failure** — one VM, one Postgres, no replica.

**With one extra month, in order:**

- **Week 1 — backups.** `pg_dump` plus a MinIO mirror to Cloud Storage on a cron, **and a
  tested restore**, because an untested backup is not a backup. Highest value per hour of any
  work available, because it converts an unrecoverable failure into an inconvenient one.
- **Week 2 — background GPS and the offline queue.** The feature is called live tracking and
  it currently stops when the driver locks their phone.
- **Week 3 — observability.** Actuator plus Micrometer plus Prometheus, and alerting on
  service health. You cannot operate what you cannot see.
- **Week 4 — partition `gps_pings`,** add retention, and batch pings from the client.

Note that none of these are features. They are all the difference between a system that demos
and a system that runs — which is the point worth making.

---

## 19. Testing

**What automated tests exist? What is well covered, what is not?**

**Backend — 42 JUnit 5 tests** with Mockito and AssertJ. Be precise about what they cover:

| Area | Tests | What they guard |
|---|---|---|
| Vehicle release | 7 | `IN_USE → AVAILABLE` only; **`MAINTENANCE`/`DECOMMISSIONED`/`AVAILABLE` never overwritten**; idempotency; missing and null ids |
| Trip lifecycle | 6 | Release on complete and on cancel; a vehicle-service outage must not fail a completed delivery; the reconciliation sweep frees stranded vehicles and skips vehicles on live trips |
| Trip authorization | 4 | Role enforcement on trip endpoints |
| Auth and email | rest | Security fixes from the audit |

**Frontend — Playwright with axe-core**, across three viewports (desktop 1440, tablet 768,
mobile Pixel 7): route smoke tests, horizontal-overflow and tap-target checks, and WCAG 2.1 AA
auditing in **both light and dark themes**.

**Well tested:** the vehicle-release rule — deliberately, because it has two opposite failure
modes. Not releasing strands vehicles; releasing too eagerly puts an unroadworthy van back
into dispatch. The parameterised test over the other statuses exists specifically to stop a
future "simplification" back to a blanket status write.

**Weakly tested — say this plainly:**

- **No integration tests.** Everything is unit-level with mocked collaborators. Nothing
  verifies that trip-service and vehicle-service actually work together over HTTP.
  **Testcontainers** is the right tool and is the biggest single gap.
- **No mobile tests at all.**
- **The Playwright specs run with the API down** — deliberately, since that exercises the
  loading, empty and error states, which are the most neglected surface. But it means they
  **structurally cannot catch data-dependent bugs**. The ETA-column overflow was exactly such
  a bug, and it had to be measured directly against the built stylesheet instead.

**A worked example of testing done right.** When the vehicle release moved to a dedicated
endpoint, three existing tests failed — correctly, because they asserted the old call. A
fourth still *passed*, but only because it stubbed an exception on a method the code no longer
called, so it was asserting nothing. A test that cannot fail is worse than no test, because it
reports confidence it does not have. That one was rewritten to genuinely exercise the outage
path.

---

## 20. One architectural decision you would change

**Looking back, what would you change?**

Give one answer with real reasoning rather than three shallow ones.

**The change: eleven services was too many. I would build a modular monolith and split out
gps-service alone.**

**The evidence, from a bug this project actually had.** Completed trips never returned their
vehicle to the fleet, so every successful delivery permanently shrank the dispatchable fleet.
The reason that bug was possible is architectural: **one piece of state — is this van in use —
had to be kept consistent across two services with no shared transaction.** trip-service
commits the trip; vehicle-service owns the status; nothing makes the second happen if the
first succeeds. In a monolith that is one transaction and the bug cannot exist.

**What it cost to fix properly across a service boundary:**

- Release after commit on both the complete and cancel paths
- A dedicated endpoint enforcing `IN_USE → AVAILABLE` so a late call cannot pull a van out of
  `MAINTENANCE`
- A scheduled reconciliation sweep for when vehicle-service is briefly unreachable
- Thirteen tests to hold all of it in place

That is a lot of machinery for one boolean. It is the correct machinery *given* the
architecture — but it is a cost the architecture created.

**What I would keep.** gps-service genuinely deserves to be separate: its write volume is
three orders of magnitude above anything else, and it is the one component whose scaling story
is different. That is the real test for a service boundary — **not "is this a different noun?"
but "does this need to scale, fail, or deploy differently?"** Vehicles and trips do not. GPS
does.

**The honest framing:** I would rather have made this mistake and understood why than have
guessed right without the reasoning.

---

# Bonus — engineer-level follow-ups

## B1. Why the outbox only in trip-service?

**Because trip-service is the only service where losing an event loses information nothing
else can reconstruct.** A trip's lifecycle transitions are the source of truth for
notifications, audit and analytics.

The others publish events that are either already durable elsewhere or reconstructible:
incident-service writes the incident to its own table first, so a lost event costs an email,
not the record.

**The honest part:** it is also incremental adoption. The outbox is real work — a table, a
publisher, a scheduled sweep — and we applied it where the cost of loss was highest. If
incident alerts became business-critical, incident-service should get one too. What we should
*not* claim is that the current split came from an exhaustive analysis.

## B2. Why Redis rather than querying Postgres for every GPS update?

**Because the access pattern is "give me the newest row per trip", which is one of the worst
queries you can ask a growing table for.** In SQL it is a `DISTINCT ON` or a window function
over a table with millions of rows, run every time a dashboard repaints.

In Redis it is a single key, `trip:latest-ping:<tripId>`, overwritten on every ping — an O(1)
read of the current value with no scan.

**The correctness detail worth mentioning:** pings can arrive out of order, so the write is
guarded by `isNewerThanCachedLatest` — an older ping arriving late must not overwrite a newer
cached position and make the map jump backwards.

**Redis is also used for state that should expire on its own:** the deviation detector counts
consecutive off-route pings with a **5-minute TTL**, so a driver who deviates once and returns
has that counter disappear without any cleanup code. Expiry as a feature is something Postgres
does not give you for free.

## B3. Preventing duplicate event processing

**A `ProcessedEvent` table in each consuming service** — audit-service, notification-service,
auth-service and analytics-service each have one. Every event carries a unique id; the
consumer records it after processing and skips any id it has already seen.

**Why this is necessary and not paranoia.** RabbitMQ guarantees *at-least-once* delivery. If a
consumer processes a message and then crashes before acknowledging it, the broker redelivers.
Without deduplication, a driver gets the same "trip assigned" email twice.

**Why deduplication lives in the consumer, not the broker.** Only the consumer knows what
"already done" means for its own work. Handling it centrally would require the broker to
understand every consumer's side effects.

## B4. Migrating from one Postgres with schemas to separate databases

**This migration is already most of the way done, and that was the point of the schema split.**

The hard part of such a migration is normally untangling cross-service joins and foreign keys.
We have **none** — no schema references another. So the steps are mechanical:

1. Stand up a new Postgres instance for the service being moved.
2. `pg_dump` that one schema and restore it into the new instance.
3. Change that service's `SPRING_DATASOURCE_URL`. Nothing else in the codebase changes.
4. Redeploy that service alone.
5. Drop the old schema once you are confident.

**What you would lose, and should say:** cross-service reporting that currently *can* be done
in one SQL statement — even though we avoid it — becomes impossible. And you now have N
databases to back up, monitor and patch. That is the real reason not to do this until a
service's load actually justifies it.

## B5. Why authenticate at the gateway rather than in every service?

**Four reasons, in order of importance:**

1. **One implementation to get right.** JWT validation is security-critical code. Eleven
   copies means eleven chances to make a subtle mistake and eleven places to patch.
2. **One place to change policy.** Adding a claim or rotating the signing key is a gateway
   change, not a fleet-wide redeploy.
3. **Services stay simple.** A service trusts `X-User-Role` and implements only
   *authorization* — what this role may do — not *authentication*.
4. **Unauthenticated traffic is rejected at the edge**, before it can consume a thread or a
   connection anywhere downstream.

**The risk this creates, which you should name:** it is a single point of trust. If a service
were reachable without going through the gateway, it would trust a forged header completely.
That is exactly why business services are `expose`-only and never published to the host — the
network topology enforces what the header alone cannot.

## B6. Implementing background GPS in Expo

**What we have now:** `Location.watchPositionAsync` — foreground only. Lock the phone or
switch apps and tracking stops. This is a real gap (Q16).

**What it needs:**

1. `Location.startLocationUpdatesAsync` with a **TaskManager** background task, which survives
   the app leaving the foreground.
2. **A persistent notification**, which Android requires for background location — and which
   is honest anyway: the driver should see that they are being tracked.
3. `ACCESS_BACKGROUND_LOCATION` permission, requested **separately and after** foreground
   permission. Android deliberately makes this a second, harder prompt.
4. **Batching**, because waking the radio for every ping destroys battery. Buffer locally,
   flush every 30 seconds or so.
5. **The offline queue** (Q16) — background tracking without one just loses data unattended.

**The non-technical obstacle worth mentioning:** aggressive OEM battery optimisation on
Xiaomi, Huawei and Samsung devices will kill background tasks regardless of what the code
does. Real fleet apps ship device-specific instructions telling drivers to exempt the app.

## B7. Why Docker Compose instead of Kubernetes?

**Because Kubernetes solves problems we do not have, at a cost we cannot absorb.**

Kubernetes exists for multi-node scheduling, rolling updates across replicas, self-healing
across machines, and autoscaling. We run **one VM**. On a single node, a scheduler has nothing
to schedule.

The cost is real: a control plane consuming 1–2 GB of our 8 GB, plus manifests, ingress
controllers, secret management and a much steeper failure-diagnosis path. On this machine, k3s
would have taken memory directly from the services doing the work.

**Compose gives us what we actually need:** declarative service definitions, dependency
ordering with health checks, resource limits, restart policies and an internal network.

**When we would switch:** the moment we need a second node. That is the honest boundary — not
scale in the abstract, but the point at which "which machine does this run on?" becomes a
question someone has to answer.

## B8. Monitoring microservices in production

Currently **nothing** — `docker compose logs` is the only tool, which means we would learn
about an outage from a user. What it should be, in build order:

1. **Health** — Spring Boot Actuator on every service, with `/health` wired into Compose
   health checks so a wedged service is restarted rather than left silently broken.
2. **Metrics** — Micrometer exporting to Prometheus, with Grafana on top. The four that matter
   here: request rate, error rate, latency percentiles (p95/p99, not averages — an average
   hides the tail that users feel), and JVM heap per service.
3. **Logs** — structured JSON with a **correlation id** propagated from the gateway through
   every downstream call, so one user's request can be traced across services. Without that,
   correlating eleven log streams by timestamp is guesswork.
4. **Tracing** — OpenTelemetry, once "which service made this slow?" becomes a real question.
5. **Alerting** — on symptoms users feel (error rate, latency), not on causes (CPU). Alerting
   on causes produces noise nobody reads.

**The domain-specific metric I would add first:** GPS pings received per minute versus active
trips. If that ratio drops, tracking is broken — and no generic infrastructure metric would
show it.

## B9. Zero-downtime deployment

**We do not have it today.** `docker compose up -d --build` stops the old container and starts
the new one; that service is unavailable for the tens of seconds a Spring Boot container takes
to boot and register with Eureka.

**Why it does not hurt much yet:** the gateway routes via Eureka, so a service that
deregisters cleanly gets no traffic — and it only affects the one service being replaced.

**What true zero-downtime needs:**

1. **More than one instance per service** — this is the prerequisite, and we have one each.
2. **Rolling replacement** — start the new instance, wait for it to register and pass health
   checks, then stop the old one.
3. **Graceful shutdown** — deregister from Eureka *first*, finish in-flight requests, then
   exit. Otherwise the gateway sends requests to a container that is already shutting down.
4. **Backward-compatible migrations.** This is the one people miss. Flyway runs on startup, so
   during a rolling deploy old and new code run against the *same* schema simultaneously.
   Every migration must therefore be additive — add a column, deploy code that writes both,
   backfill, then remove the old column in a *later* release. A migration that renames a column
   breaks the still-running old instances.

## B10. If one service becomes unavailable, what still works?

**The system degrades in proportion to what the failed service owned** — that is the payoff
for the architecture, so answer it concretely rather than in the abstract.

| Service down | What breaks | What keeps working |
|---|---|---|
| **notification-service** | Emails | Everything. Events queue in RabbitMQ and are consumed when it returns |
| **audit-service** | New audit records | Everything. Durable queues hold the events |
| **media-service** | Photo upload; trips cannot be *completed* (POD check fails) | Tracking, trip creation, the map |
| **gps-service** | Live map, deviation detection | Trip creation and completion, the whole admin portal |
| **vehicle-service** | Trip creation (cannot verify a vehicle is free); vehicles are not released on completion — but the reconciliation sweep repairs this when it returns | Existing trips, tracking, delivery |
| **auth-service** | **Everything** — the gateway validates every token against it | Nothing new. Open websockets survive |
| **api-gateway** | **Everything from outside** | Internal service-to-service calls |
| **Postgres** | **Everything** | Nothing |

**The honest summary:** auth-service, the gateway and Postgres are hard dependencies — if any
of them is down, so is the product. The peripheral services degrade gracefully.

**The mitigations already in place:** durable queues with dead-letter queues mean async
consumers can be down without losing work; `restart: unless-stopped` recovers from crashes;
the vehicle-release path is best-effort with a reconciliation sweep, so a transient
vehicle-service outage self-heals rather than needing a human.

**The mitigation missing, if they ask:** circuit breakers (Resilience4j). Right now a slow
downstream service ties up caller threads until timeout rather than failing fast.

---

## Quick-reference numbers

Worth memorising — being able to give a specific figure instead of "quite a lot" is what
separates a confident answer from a vague one.

| | |
|---|---|
| Backend services / total containers | 11 Java · 17 containers in production |
| Database | PostgreSQL 16, **10 schemas**, one instance |
| Gateway routes | 9 (audit-service is event-driven, no route) |
| Access / refresh token lifetime | **15 minutes** / **7 days** |
| Password hashing | BCrypt, **cost 12** |
| Account lockout | **5** failed attempts → **15** minutes |
| GPS ping interval | ~**2 seconds** (8 m minimum distance) |
| GPS accuracy rejection | worse than **50 m** |
| Plausibility thresholds | **180 km/h**; **5 km in under 10 s** |
| Geofence radius | **50 m** |
| Outbox publisher sweep | every **30 seconds** |
| Vehicle reconciliation sweep | every **10 minutes** |
| Photo retry queue | **50** items, **3** retries |
| Backend tests | **42** |
| VM | `e2-standard-2` — 2 vCPU, 8 GB RAM |
| Public ports | **22, 80, 443** only |
| Cost during trial | **$0** |
