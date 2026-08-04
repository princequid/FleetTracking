# FleetSync Pro — Complete Project Guide

**A plain-English walkthrough of the whole system.** Written to be read start-to-finish
before a presentation, and to be searched during questions.

Everything here was verified against the code, not remembered. Where the honest answer is
"this isn't finished", it says so — being caught out by a question you couldn't answer is
worse than volunteering a limitation yourself.

---

## 1. What the product actually is

A **fleet delivery management platform**. Three pieces:

| Piece | Who uses it | What they do |
|---|---|---|
| **Mobile app** | Drivers | See assigned trips, navigate, take proof-of-delivery photos, report incidents |
| **Admin portal** | Dispatchers & admins | Create trips, assign drivers/vehicles, watch a live map, review incidents, run reports |
| **Backend** | Nobody directly | 10 services that hold the data and the rules |

**The one-sentence version:** a dispatcher assigns a delivery to a driver, the driver's phone
streams GPS while they drive, and the dispatcher watches it happen on a live map until the
driver uploads a delivery photo and the trip closes.

---

## 2. The architecture, and why

### Microservices — what that means here

Instead of one big program, the backend is **10 separate programs** that talk over the
network. Each owns one subject and its own slice of the database.

```
                        ┌─────────────┐
   Mobile app ───┐      │             │
                 ├─────▶│ API Gateway │──┐
   Admin portal ─┘      │  (port 8080)│  │   one front door for everything
                        └─────────────┘  │
                                         ▼
        ┌──────────┬──────────┬──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼          ▼          ▼
     auth      driver     vehicle      trip       gps       media
     8081       8082        8083       8084       8085       8086
        ▼          ▼          ▼          ▼          ▼          ▼
     incident  notification  audit
      8087        8088       8090
```

### Why microservices instead of one application?

The honest answer, and a fair one: **because the team is five people and each owns a
service.** M1 took auth/gateway/vehicles/drivers, M2 trips and GPS, M3 media and incidents,
M4 the admin portal, M5 notifications and analytics. Splitting the backend let five people
work without standing on each other.

The textbook benefits also apply — you could scale GPS ingestion independently of everything
else, and a crash in one service doesn't take the rest down — but the team structure is the
real driver, and saying so is more credible than reciting advantages.

**If asked "was that the right call?"** — a monolith would have been simpler to build, test
and deploy for a system this size. Microservices bought parallel development and cost
operational complexity. That's a legitimate trade, and it's the honest answer.

### Every service, one line each

| Service | Port | Responsibility |
|---|---|---|
| **api-gateway** | 8080 | The only public entrance. Checks the token, routes the request |
| **eureka-server** | 8761 | Phone book — services register here so they can find each other |
| **auth-service** | 8081 | Accounts, login, tokens, password reset, staff management |
| **driver-service** | 8082 | Driver profiles, licences, availability |
| **vehicle-service** | 8083 | The fleet — plates, capacity, status |
| **trip-service** | 8084 | The heart. Creates trips, drives the status lifecycle |
| **gps-service** | 8085 | Receives location pings, streams them to the live map |
| **media-service** | 8086 | Proof-of-delivery photos, stored in MinIO |
| **incident-service** | 8087 | Incidents drivers report on the road |
| **notification-service** | 8088 | Push notifications and emails |
| **audit-service** | 8090 | Listens to everything, writes an immutable trail |

Two more directories that aren't running services:

- **shared-events** — a small library of event classes shared by services, not a service
- **analytics-service** — ⚠️ **scaffolding only.** Empty classes, no `pom.xml`, can't be
  built or started. Be upfront: it's planned, not delivered

---

## 3. The technology, and why each was chosen

| Layer | Technology | Why |
|---|---|---|
| Backend | **Java 17 + Spring Boot 3.2.5** | Team knew Java; Spring Boot is the standard for services |
| Service discovery | **Netflix Eureka** | Services find each other by name, not hardcoded IPs |
| Gateway | **Spring Cloud Gateway** | One entrance; authentication in one place |
| Database | **PostgreSQL 16** | Reliable, free, strong with geographic data |
| Messaging | **RabbitMQ** | Services announce events without waiting for each other |
| Cache | **Redis** | Last-known vehicle positions, read constantly, written constantly |
| File storage | **MinIO** | S3-compatible object store for photos, self-hosted |
| Routing | **OSRM** | Self-hosted road routing with Ghana map data |
| Admin portal | **React 19 + Vite** | Fast builds; standard for dashboards |
| Mobile | **React Native + Expo 54** | One codebase for Android and iOS |
| Deployment | **Docker Compose on one GCP VM** | Everything defined in one file, reproducible |

### Two answers worth rehearsing

**"Why Postgres and not MongoDB?"** — the data is deeply relational. A trip references a
driver, a vehicle, stops, photos, incidents and a status history. Foreign keys and
transactions matter more here than schema flexibility.

**"Why self-host OSRM instead of Google Directions?"** — cost and control. Route requests
happen on every trip and every reroute; a hosted API is billed per call. OSRM with Ghana's
map data runs free on our own VM.

---

## 4. Synchronous vs asynchronous — the key concept

This trips people up in questions, so learn the distinction.

**Synchronous (HTTP)** — "I need an answer before I continue."

> trip-service asks driver-service *"does driver 7 exist and are they available?"* and waits.
> Without that answer it can't create the trip.

**Asynchronous (RabbitMQ events)** — "This happened; whoever cares can react."

> trip-service announces *"trip 42 was assigned"* and moves on. notification-service pushes
> to the driver's phone; audit-service records it. Neither delays the dispatcher.

**Why it matters:** if notification-service is down, trips still get created. The event waits
in the queue and is delivered when it recovers. If it were synchronous, a broken notification
service would stop dispatching entirely.

### The six events

`TripAssignedEvent` · `TripStartedEvent` · `TripCompletedEvent` · `TripCancelledEvent` ·
`TripDeviatedEvent` · `IncidentReportedEvent`

### The transactional outbox — a good thing to be asked about

There's a subtle problem with events. Suppose trip-service saves a trip *and* publishes
"trip assigned". What if the save succeeds and the publish fails? The trip exists but the
driver is never notified — silently.

**The solution:** don't publish directly. In the *same database transaction* that saves the
trip, write the event into an `outbox_events` table. Either both succeed or both fail. A
background job then reads unpublished rows and sends them to RabbitMQ.

This is the **transactional outbox pattern**, and it's implemented in trip-service. Worth
knowing it's the pattern's proper name, and worth admitting the other services publish
directly and don't have this guarantee yet.

---

## 5. The database — schema-per-service

One PostgreSQL server, **ten separate schemas** (namespaces):

```
fleettrack_auth · driver · vehicle · trip · gps
media · incident · notif · analytics · audit
```

Each service can only touch its own schema. If trip-service needs driver data, it asks
driver-service over HTTP — it never reads the `driver` schema directly.

**Why?** It keeps ownership clean. driver-service can change its tables freely because
nothing else reads them.

**The honest trade-off, if pushed:** true microservices would use separate database
*servers*. One server is a single point of failure and a shared resource. Sharing one server
with separate schemas was a pragmatic choice for a student project on one VM — it keeps the
ownership discipline without the cost of ten databases.

---

## 6. How a delivery actually works

Follow this end-to-end; most questions are somewhere along it.

**1 · Dispatcher creates a trip** (admin portal → trip-service)
- Checks the driver exists and is available (asks driver-service)
- Checks the vehicle exists and is free (asks vehicle-service)
- Asks OSRM for the route and estimated arrival time
- Saves the trip as `ASSIGNED`, writes `TripAssignedEvent` to the outbox

**2 · Driver is notified** (notification-service consumes the event) — push to their phone

**3 · Driver starts the trip** → status `STARTED`
- Requires a pre-dispatch photo first (media-service confirms one exists)

**4 · Phone streams GPS** (mobile → gps-service, roughly every 2 seconds)
- Each ping is stored, and the latest position cached in Redis
- gps-service checks whether the driver has strayed from the planned route; if so it
  publishes `TripDeviatedEvent`

**5 · Dispatcher watches live** — gps-service pushes positions over **WebSocket** to the
portal's map. WebSocket is a two-way connection that stays open, so the server can push
without the browser asking.

**6 · Driver arrives** → status `ARRIVED`, checked against a **50-metre geofence** so it
can't be marked from the wrong place

**7 · Driver completes** → status `DELIVERED`
- Requires a proof-of-delivery photo
- Publishes `TripCompletedEvent`; vehicle-service frees the vehicle; audit-service records it

**The seven trip statuses:**
```
ASSIGNED → STARTED → EN_ROUTE → ARRIVED → DELIVERED
              ↘ REROUTED ↗
      (CANCELLED possible until DELIVERED)
```

---

## 7. Security — the part most likely to be probed

### Logging in

1. Driver sends email + password
2. auth-service checks it with **BCrypt** (cost factor 12 — deliberately slow, so guessing is expensive)
3. Returns two tokens:
   - **Access token** — 15 minutes, sent with every request
   - **Refresh token** — 7 days, used only to get a new access token

**Why two?** The short-lived one limits damage if it leaks. The long-lived one means the
driver isn't asked to log in every 15 minutes.

### Refresh token rotation — a strong detail to mention

Every time a refresh token is used, it's **destroyed and replaced**. If an attacker steals one
and uses it, the real user's next refresh fails — and because tokens are tracked in
"families", detecting that reuse **revokes the entire family**, logging the attacker out too.

Refresh tokens are stored **hashed** (SHA-256), so a database leak doesn't hand over working
tokens.

### Who can do what

Four roles: `DRIVER` · `DISPATCHER` · `ADMIN` · `SUPER_ADMIN`

The gateway validates the token and stamps `X-User-Id` and `X-User-Role` headers onto the
request. Services read those headers to decide access.

**A sharp question you should be ready for:** *"If services trust a header, could someone just
send that header themselves?"*

The gateway **overwrites** those headers on every request rather than adding to them, so a
client-supplied value is discarded. Services are also not published to the internet — only the
gateway is — and they additionally require a shared internal key. That's three layers.

Be honest that it's defence-in-depth rather than cryptographic proof: a truly robust design
would have each service verify the JWT itself.

### Other measures worth naming

- **Rate limiting** on login — 10 attempts per minute per IP
- **Account lockout** after 5 failed attempts
- **Timing-equalised login** — an unknown email takes the same time as a wrong password, so
  attackers can't discover which emails are registered by measuring response time
- **Non-enumerable password reset** — always the same response, whether the email exists or not
- **HTTPS everywhere** via Caddy with automatic Let's Encrypt certificates

---

## 8. The mobile app

**Expo + React Native**, one codebase for both platforms. Routing is file-based:
`app/(driver)/trip/[id]/map.jsx` is the screen at `/driver/trip/42/map`.

### GPS — the technically interesting part

The phone reports location every ~2 seconds while navigating. Naively streaming every reading
would be noisy and wasteful, so there are filters:

- **Accuracy gate** — readings worse than ~35 m are discarded
- **Adaptive deadband** — small movements are ignored, scaled to the reading's accuracy, so a
  parked vehicle doesn't appear to drift
- **Two-fix confirmation** — movement must be confirmed by a second reading before it's
  accepted, so GPS jitter doesn't look like driving

### Offline handling

Delivery routes lose signal. Failed pings are queued on the device and replayed on reconnect.
Photos that fail to upload are retried when the app next comes to the foreground.

### Be upfront about this limitation

**Location tracking only works while the app is open and the screen is on.** True background
tracking needs `expo-task-manager` and an Android foreground service, which aren't
implemented yet. If the driver locks their phone, tracking pauses.

Volunteering this is far better than being caught by it. The fix is known and scoped — it's
next on the roadmap.

---

## 9. The admin portal

**React 19 + Vite.** Pages: Dashboard, Live Map, Dispatch, Trips, Drivers, Vehicles,
Incidents, Reports, Staff.

### Design system — a good answer if asked about the UI

Colours, spacing and typography come from a **three-layer token system** in CSS, not
hardcoded values:

1. **Primitives** — raw colour ramps
2. **Semantic** — role-named (`--color-bg`, `--color-text-1`)
3. **System** — type scale, spacing, shadows, motion

Dark mode works by **remapping layer 2 only**. Every component reads semantic tokens, so the
whole app flips coherently from one block of CSS.

Accessibility is audited automatically with **Playwright + axe-core** against WCAG 2.1 AA,
across desktop, tablet and mobile viewports.

### Live map

Leaflet for rendering. Vehicle positions arrive over WebSocket (SockJS + STOMP) from
gps-service. Routes are drawn from OSRM geometry.

---

## 10. Deployment

**One Google Cloud VM** running everything via Docker Compose. The admin portal is deployed
separately on **Render**.

```
Internet → Caddy (HTTPS, automatic certificates) → API Gateway → services
                                                        ↓
                          Postgres · RabbitMQ · Redis · MinIO · OSRM
```

Everything is defined in `infrastructure_1/docker-compose.yml` — sixteen containers, resource
limits on each, health checks on the datastores. Secrets live in a `.env` file that is never
committed, and services **refuse to start** if a secret is missing rather than falling back to
a default.

### Database migrations

Schema changes are versioned SQL files run by **Flyway** on startup. Every environment gets
the same schema in the same order, and `ddl-auto: validate` means the app refuses to start if
the schema doesn't match what the code expects.

---

## 11. Testing

**35 automated tests** covering the security-critical paths:

| Area | Tests | What they prove |
|---|---|---|
| WebSocket authorization | 14 | A driver can't watch another driver's live location |
| Authentication | 11 | Registration can't escalate role; lockout works; no user enumeration |
| Rate limiting | 6 | A spoofed header can't bypass the login limit |
| Trip authorization | 4 | A driver can't read another driver's statistics |

**Be honest:** these were written specifically to cover security fixes. Broad coverage of
business logic doesn't exist yet. If asked "what's your test coverage?", the truthful answer
is *"targeted rather than broad — the security-critical paths are covered, the rest isn't
yet."*

CI runs on every pull request: builds all 11 services, builds the portal, runs the tests,
audits dependencies, and scans for committed secrets.

---

## 12. Questions you should expect

**"What was the hardest part?"**
GPS reliability. Raw phone GPS is noisy — a parked vehicle appears to wander, and tunnels
produce wild readings. The accuracy gate, adaptive deadband and two-fix confirmation were all
tuned against real-world failures.

**"What would you do differently?"**
Write tests from the start. We added them late, after an audit, and by then several bugs had
already shipped and been fixed twice. Also: probably a monolith first, splitting into services
only where scaling actually demanded it.

**"How does it handle failure?"**
Layered. Events queue in RabbitMQ if a consumer is down. Offline GPS pings queue on the phone.
Failed photo uploads retry. **Honest gap:** there are no circuit breakers, so a slow service
can still tie up its callers.

**"Can it scale?"**
Horizontally in principle — services are stateless and behind a gateway. **In practice, not
yet:** GPS ingestion makes three internal calls per ping, which saturates the connection pool
around 1,000 concurrent drivers. The fix is known (cache the ownership check, batch the pings).
Being specific about the limit is more convincing than claiming it scales.

**"How do you know it's secure?"**
It was audited against the OWASP Top 10. Findings: zero SQL injection (all queries use bound
parameters), zero XSS sinks, layered file-upload validation. Fixed during the audit: a
WebSocket authorization gap, a rate-limit bypass, two access-control issues.

**"What's not finished?"**
Background location tracking. Analytics service. Automated backups. Metrics and monitoring.
Knowing your own gaps is a strength — say them before you're asked.

---

## 13. Glossary

| Term | Plain meaning |
|---|---|
| **API Gateway** | One front door that checks who you are and forwards you on |
| **Service discovery** | Services look each other up by name instead of a hardcoded address |
| **JWT** | A signed ticket proving who you are; the server needn't remember you |
| **BCrypt** | Deliberately slow password hashing, so guessing is expensive |
| **WebSocket** | A connection that stays open so the server can push without being asked |
| **Message queue** | A postbox — the sender doesn't wait for the receiver |
| **Transactional outbox** | Save the event with the data, publish it after, so neither is lost |
| **Geofence** | A virtual boundary; here, 50 m around a delivery point |
| **Migration** | A versioned SQL file that upgrades the database schema |
| **Idempotent** | Doing it twice has the same effect as doing it once |
| **Docker container** | An app plus everything it needs, packaged to run anywhere |
| **Schema (Postgres)** | A namespace inside a database, like a folder for tables |

---

## 14. Numbers worth memorising

| | |
|---|---|
| Backend services running | **10** (+ gateway + Eureka) |
| REST endpoints | **54** |
| Database schemas | **10** |
| Event types | **6** |
| Trip statuses | **7** |
| User roles | **4** |
| Containers in production | **16** |
| Automated tests | **35** |
| Access token lifetime | **15 minutes** |
| Refresh token lifetime | **7 days** |
| BCrypt cost factor | **12** |
| Login rate limit | **10/minute per IP** |
| Account lockout | **5 failed attempts** |
| Geofence radius | **50 metres** |
| GPS ping interval | **~2 seconds** |

---

## 15. If you remember only five things

1. **A dispatcher assigns a trip, a driver drives it with GPS streaming live, photos prove
   delivery.** That's the product.
2. **Ten services, each owning one subject and its own database schema**, behind one gateway
   that handles authentication.
3. **Synchronous HTTP when an answer is needed now; asynchronous events when it isn't** —
   which is why a notification outage doesn't stop dispatching.
4. **Short access tokens, rotating refresh tokens, role checks at the gateway** — and reuse of
   a stolen token revokes the whole family.
5. **Name your own gaps first.** Background location, analytics, backups and monitoring aren't
   done. Saying so before you're asked reads as engineering judgement, not weakness.
