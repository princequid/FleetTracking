/* ==========================================================================
   FleetSync Pro — Showcase interactions & content
   --------------------------------------------------------------------------
   Responsibilities
   1.  Architecture explorer (hover/tap a layer -> inspector panel)
   2.  Evaluator Q&A accordions (20 questions) + search
   3.  Engineer follow-up accordions (10 questions) with rich content
   4.  Scroll-reveal animations + animated stat counters + test bars
   5.  Sticky header, scroll-spy, back-to-top, mobile navigation
   All content is authored below and rendered locally — no fetches.
   ========================================================================== */
(function () {
  "use strict";

  // Progressive enhancement: the reveal animation hides .reveal elements via
  // `html.js .reveal` in CSS. Without this class (JS blocked / disabled) every
  // section renders fully visible instead of being stuck invisible.
  document.documentElement.classList.add("js");

  /* ------------------------------------------------------------------
     Small DOM helpers
     ------------------------------------------------------------------ */
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ------------------------------------------------------------------
     Architecture data — keyed by the data-node attribute on each layer
     ------------------------------------------------------------------ */
  var ARCH = {
    admin: {
      title: "Admin Portal & Driver App",
      sub: "React web (Render) · React Native / Expo mobile",
      desc: "The admin portal is a static React bundle built by Vite and hosted on Render — the browser downloads HTML and JavaScript from Render's CDN. The driver app is built with React Native and Expo, streaming GPS positions and uploading proof-of-delivery photos.",
      tags: ["React", "Vite", "React Native", "Expo", "Render"]
    },
    gateway: {
      title: "API Gateway",
      sub: "Caddy TLS · Spring Cloud Gateway · JWT validation",
      desc: "Caddy is the only container facing the internet: it terminates TLS (Let's Encrypt, auto-renewed) and proxies to api-gateway:8080 by container name. The gateway validates every JWT with auth-service, overwrites X-User-Id and X-User-Role from the validated token, then routes by path (lb://service-name) with Eureka load balancing. The /ws/** WebSocket route shares the same TLS certificate and CORS configuration.",
      tags: ["Caddy", "Spring Cloud Gateway", "Eureka", "JWT", "WebSockets (STOMP/SockJS)"]
    },
    microservices: {
      title: "11 Microservices",
      sub: "Spring Boot · each owns its own schema",
      desc: "Eleven Java services, each with its own datasource default_schema and no cross-schema foreign keys. The split buys uneven-load scaling (gps-service takes a ping every 2s from every active driver; vehicle-service handles a few dozen requests an hour), failure isolation, and independent deployment — at the cost of cross-service HTTP calls where a SQL join would have done.",
      tags: ["api-gateway", "auth-service", "trip-service", "driver-service", "vehicle-service", "gps-service", "media-service", "incident-service", "notification-service", "audit-service", "analytics-service (stub)"]
    },
    postgres: {
      title: "PostgreSQL 16",
      sub: "1 instance · 10 schemas · Flyway",
      desc: "One shared instance with ten isolated schemas (auth, driver, vehicle, trip, gps, media, incident, notif, audit, analytics), created by infrastructure_1/db/init/01_create_databases.sql. ACID transactions make the outbox pattern correct; constraints and enums enforce statuses at the database level; Flyway ships versioned migrations with the code that needs them. gps_pings is the first bottleneck at scale.",
      tags: ["ACID", "Schemas", "Enums & constraints", "Flyway"]
    },
    redis: {
      title: "Redis",
      sub: "Latest positions · TTL-based state",
      desc: "Caches the newest position per trip (trip:latest-ping:<tripId>) — an O(1) read with no scan of a growing table. Writes are guarded by isNewerThanCachedLatest so an out-of-order ping cannot make the map jump backwards. Deviation counters expire via a 5-minute TTL with no cleanup code. Hardened with requirepass and loopback-only binding.",
      tags: ["O(1) latest position", "Out-of-order guard", "TTL expiry", "requirepass"]
    },
    rabbitmq: {
      title: "RabbitMQ",
      sub: "Async event bus · durable queues",
      desc: "Transports trip.created / completed / cancelled and incident.reported to notification-service and audit-service. Durable queues with dead-letter queues mean async consumers can be down without losing work. audit-service subscribes with a wildcard consumer, so no producer has any code that mentions auditing. At-least-once delivery is deduplicated by ProcessedEvent tables.",
      tags: ["Outbox → events", "Durable queues", "Wildcard consumer", "ProcessedEvent dedup"]
    },
    minio: {
      title: "MinIO",
      sub: "Object storage · presigned URLs",
      desc: "Proof-of-delivery photos upload directly from the phone using a presigned URL, so images never pass through the API. It runs on its own hostname (fleettrack-storage.duckdns.org) because presigned URLs sign against MinIO's own host — behind a path prefix the signature would fail to validate.",
      tags: ["Presigned URLs", "Offloads the API", "Dedicated hostname"]
    },
    osrm: {
      title: "OSRM",
      sub: "Self-hosted routing · ETAs",
      desc: "Routes trips and recomputes ETAs as drivers move, re-routing on deviation. A fixed 1 GB container with unlimited requests — no per-request cost, no API key to leak, addresses never leave the infrastructure. Trade-offs: no live traffic (free-flow ETAs), stale map data from a point-in-time Geofabrik extract, and an operational graph-build step.",
      tags: ["Unlimited requests", "No API key", "Data privacy", "No live traffic"]
    }
  };

  /* ------------------------------------------------------------------
     Rich-content renderers (shared by accordions)
     ------------------------------------------------------------------ */
  function callout(kind, title, text) {
    var icon = kind === "warn" ? "i-alert" : kind === "danger" ? "i-alert" : kind === "success" ? "i-check-circle" : "i-info";
    return (
      '<div class="callout callout--' + kind + '">' +
      '<svg aria-hidden="true"><use href="#' + icon + '"></use></svg>' +
      "<div><strong>" + title + "</strong><p>" + text + "</p></div>" +
      "</div>"
    );
  }

  function richTable(head, rows) {
    var html =
      '<div class="table-wrap"><table>' +
      "<thead><tr>" + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead>" +
      "<tbody>" + rows.map(function (r) {
        return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
    return html;
  }

  function richList(items, ordered) {
    var tag = ordered ? "ol" : "ul";
    return "<" + tag + ">" + items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</" + tag + ">";
  }

  /* item: { t: 'p'|'ul'|'ol'|'code'|'table'|'callout', ... } */
  function richBody(items) {
    return items.map(function (it) {
      switch (it.t) {
        case "ul": return richList(it.items, false);
        case "ol": return richList(it.items, true);
        case "code": return '<pre class="code-block">' + it.code + "</pre>";
        case "table": return richTable(it.head, it.rows);
        case "callout": return callout(it.kind, it.title, it.text);
        default: return "<p>" + it.html + "</p>";
      }
    }).join("");
  }

  function qaBlock(icon, heading, bodyHtml) {
    return (
      '<div class="qa-block">' +
      '<div class="qa-block-head">' +
      '<svg aria-hidden="true"><use href="#' + icon + '"></use></svg>' +
      heading +
      "</div>" +
      '<div class="qa-block-body">' + bodyHtml + "</div>" +
      "</div>"
    );
  }

  /* ------------------------------------------------------------------
     Evaluator Q&A — 20 questions, grounded in the evaluator document.
     Each answer: professional answer · technical explanation · notes ·
     key takeaway.
     ------------------------------------------------------------------ */
  var EVALUATOR_QA = [
    {
      num: 1, tag: "Problem",
      q: "What real-world problem does FleetSync Pro solve, and why is it better than manual methods?",
      answer: "A delivery company running vans has no reliable idea where they are. The dispatcher's information comes from phone calls to drivers, a paper or spreadsheet log of who took which vehicle, and a photo of a signature that lives on the driver's phone. FleetSync Pro replaces all three with one system: live vehicle positions on a map, a trip lifecycle the system enforces, and proof-of-delivery stored centrally.",
      mechanism: "Why it beats the manual process — three concrete things, not just &ldquo;it's digital&rdquo;:<br><br><strong>Live position</strong> updated roughly every 2 seconds vs the &ldquo;where are you?&rdquo; phone call.<br><strong>No double-booking</strong> — vehicle status is a state machine; an IN_USE vehicle cannot be assigned.<br><strong>Central POD</strong> — photos upload to object storage, attach to the trip, and are retrievable months later.<br><strong>Accountability</strong> — every trip records an ETA and an actual completion time, so &ldquo;was that delivery late?&rdquo; has a definite answer.",
      notes: "If pushed — &ldquo;couldn't a WhatsApp group do most of this?&rdquo; For visibility, partly. Not for the parts that need <strong>enforced state</strong>: WhatsApp cannot stop a dispatcher assigning a van that is already out, cannot tell you the on-time rate across 200 trips, and cannot produce an audit trail of who cancelled what.",
      takeaway: "The value is in the constraints the system enforces, not in the messaging."
    },
    {
      num: 2, tag: "Workflow",
      q: "Explain the complete workflow of a delivery, from trip creation to completion.",
      answer: "Walk it as a story — this is the answer most likely to be asked first. The dispatcher creates the trip in the admin portal, picking a driver, vehicle, origin, destination and any intermediate stops. trip-service validates and reserves: it calls driver-service and vehicle-service to confirm both are available, sets the vehicle to IN_USE so nobody else can take it, and writes the trip with status ASSIGNED. An event is recorded, not sent — in the same database transaction as the trip, a trip.created row is written to an outbox table. The driver's phone picks up the trip and shows it in the app.",
      mechanism: "The driver starts: status moves ASSIGNED &rarr; STARTED &rarr; EN_ROUTE, and the phone streams GPS positions about every 2 seconds. gps-service rejects implausible pings, caches the latest position in Redis, writes it to Postgres, and pushes it over a WebSocket — the dispatcher's map moves in real time, and deviation detection fires if the driver strays. On arrival, a geofence check confirms the driver is within 50 m of the destination and status becomes ARRIVED. The driver photographs the delivery; the photo uploads directly to MinIO using a presigned URL, so the image never passes through the API. trip-service then verifies a POD exists, sets the trip DELIVERED, and releases the vehicle back to AVAILABLE. Downstream, notification-service emails and audit-service records the trail.",
      notes: "If pushed — &ldquo;what if the driver never marks it delivered?&rdquo; The trip stays open and the ETA column shows it as overdue. A reconciliation sweep catches vehicles left stranded by any path that failed to release them.",
      takeaway: "Every transition is enforced: availability is checked before assignment, arrival is verified by geofence, and completion is blocked until proof of delivery exists."
    },
    {
      num: 3, tag: "Architecture",
      q: "Why microservices instead of a monolith? Would you do it again?",
      answer: "In all honesty: partly for the right reasons, partly because the module was about distributed systems — and it is the truthful answer to say so. The reasons that genuinely hold: <strong>uneven load</strong> — gps-service takes a ping every 2 seconds from every active driver while vehicle-service handles a few dozen requests an hour; separated, gps-service scales or throttles alone without starving the fleet screen. <strong>Failure isolation</strong> — notification-service talking to Gmail is the least reliable part of the system; a hung SMTP connection degrades notifications alone. <strong>Independent deployment</strong> — a vehicle-release fix shipped by rebuilding two containers while the other fifteen kept running.",
      mechanism: "Would I do it again? For this size of team and this traffic — no, not eleven services. The honest cost was real: eleven pom.xml files, eleven Dockerfiles, service discovery, cross-service HTTP calls where a SQL join would have done, and a bug that only existed because two services had to agree about one piece of state. I would build a <strong>modular monolith</strong> — one deployable with strict internal module boundaries — and split out gps-service alone, because that is the only component whose load profile actually differs.",
      notes: "Be straight about the trade-off — examiners respect it. Both reasons are named: the ones that genuinely hold, and the one that is about the course.",
      takeaway: "Separation earns its keep only where a component needs to scale, fail, or deploy differently."
    },
    {
      num: 4, tag: "Architecture",
      q: "Why does each service own its own schema instead of sharing tables?",
      answer: "So that a change to one service's tables cannot silently break another service. If trip-service could read vehicle.vehicles directly, renaming a column in vehicle-service breaks trip-service at runtime — with no compiler error and no test failure to warn you. Forcing the access through an API turns that into a contract you can version.",
      mechanism: "One PostgreSQL instance, ten schemas, created by <code class=\"mono\">infrastructure_1/db/init/01_create_databases.sql</code>: fleettrack_auth, driver, vehicle, trip, gps, media, incident, notif, audit, analytics. Each service's datasource sets its own default_schema. There are no cross-schema foreign keys — that is the deliberate part, and it is what makes splitting into separate database servers possible later without a rewrite.",
      notes: "If pushed — &ldquo;so how does trip-service know the vehicle exists?&rdquo; It asks vehicle-service over HTTP (VehicleServiceClient). The trade-off is honest: we gave up referential integrity the database would have enforced for free, and bought the ability to change each service independently. If vehicle-service is down, trip creation fails — which is the correct behaviour, since we cannot verify the vehicle is free.",
      takeaway: "Independence is bought deliberately: an API contract instead of shared tables, and correct failure when a dependency is down."
    },
    {
      num: 5, tag: "Communication",
      q: "When do services talk synchronously, and when asynchronously?",
      answer: "The rule we applied: if the caller cannot proceed without the answer, call it directly. If the caller does not care about the result, publish an event. Synchronous HTTP goes through the gateway with load-balanced service discovery; asynchronous traffic flows through RabbitMQ.",
      mechanism: "<strong>Synchronous (HTTP):</strong> trip-service &rarr; vehicle-service (is this van free?), trip-service &rarr; driver-service (is this driver available?), trip-service &rarr; media-service (does a POD photo exist?), trip-service &rarr; OSRM (route and ETA), gateway &rarr; auth-service (is this token valid?). In each case the caller cannot proceed without the answer.<br><br><strong>Asynchronous (RabbitMQ):</strong> trip.created / trip.completed / trip.cancelled &rarr; notification-service and audit-service (an email failing must never fail a delivery); incident.reported &rarr; notification-service (alerting is a side effect); all events via a wildcard consumer &rarr; audit-service.",
      notes: "A strong point to mention: audit-service is subscribed with a wildcard consumer, so no other service has any code that mentions auditing. That is the whole point of events — you can add a consumer without touching a producer.",
      takeaway: "The decision is made per call: proceed-blocking work is synchronous; side effects are events."
    },
    {
      num: 6, tag: "Reliability",
      q: "RabbitMQ dies while a dispatcher assigns a trip. What happens? Does the trip still get created?",
      answer: "Yes — the trip is created normally, and the event is not lost. This is the Transactional Outbox pattern, and it is the strongest engineering answer in the project.",
      mechanism: "The naive version is broken: <em>save trip, then publish event</em> has two failure modes. Publish inside the transaction, then roll back &rarr; you have announced a trip that does not exist. Publish after commit while the broker is down &rarr; the trip exists but nobody downstream ever hears. Instead, the event is written to an outbox table in the same database transaction as the trip itself:",
      code: "BEGIN\n  INSERT INTO trip.trips        (...)\n  INSERT INTO trip.outbox_event (...)   <span class=\"cm\">-- the event, as a row</span>\nCOMMIT",
      notes: "Both rows commit or neither does — one transaction, so they can never disagree. OutboxPublisherService (<code class=\"mono\">@Scheduled(fixedDelay = 30000)</code>) reads unpublished rows every 30 seconds and pushes them to RabbitMQ, marking each published only after the broker accepts it. With RabbitMQ down, events sit in the outbox and drain when the broker returns — emails and audit records arrive late rather than never.<br><br><strong>If pushed</strong> — &ldquo;isn't 30 seconds slow?&rdquo; For notifications and audit it does not matter; nobody needs the email in under 30s. If it mattered we would publish immediately after commit and keep the sweep as the safety net.<br><strong>If pushed</strong> — &ldquo;why not two-phase commit?&rdquo; XA transactions are slow, poorly supported in practice, and lock resources across two systems. The outbox gets the same guarantee using only a database transaction — which is why it is the standard pattern.",
      takeaway: "One local transaction gives you the broker guarantee: the event cannot be lost, and the trip cannot be announced before it exists."
    },
    {
      num: 7, tag: "GPS",
      q: "How do you stop inaccurate GPS producing wrong vehicle movement?",
      answer: "Two filters, in order — one on the reading itself, one on the movement it implies. Both live in gps-service and run before anything is stored or broadcast.",
      mechanism: "<strong>Filter 1 — reject low-confidence readings</strong> (GpsService.java:41): every ping carries the phone's own accuracy estimate in metres; anything worse than 50 m is discarded outright. This catches the classic urban canyon or covered loading bay case, where the phone reports a position it is not confident about.<br><br><strong>Filter 2 — reject physically impossible movement</strong> (PlausibilityCheckService.java): each ping is compared to the previous using the haversine formula — great-circle distance on a sphere, because straight-line arithmetic on latitude/longitude is wrong (a degree of longitude shrinks away from the equator). Two checks: <code class=\"mono\">TELEPORT_DETECTED</code> — more than 5 km in under 10 seconds; <code class=\"mono\">IMPLAUSIBLE_SPEED</code> — implied speed over 180 km/h.",
      notes: "Why two thresholds and not one: they catch different shapes of error. A jump of 5 km in 9s is 2,000 km/h, so the speed check would catch it too — but a jump of 300 m in 1s is 1,080 km/h and also caught, while a slow drift of 20 m per ping is under both and correctly allowed through, because it might be real.<br><br><strong>If pushed</strong> — &ldquo;what about a driver genuinely on a highway?&rdquo; 180 km/h is deliberately well above any legal road speed, so a real journey never trips it. The cost of a threshold that is too tight is worse than one too loose: rejecting real positions makes the map lie about where the van is.<br><strong>If pushed</strong> — &ldquo;do you smooth the track?&rdquo; No — no Kalman filter, no moving average. We reject bad points rather than smoothing between them. Smoothing would be the next step if tracks still looked jittery.",
      takeaway: "Reject bad data instead of smoothing it — a too-tight filter makes the map lie, which is worse than tolerating jitter."
    },
    {
      num: 8, tag: "WebSockets",
      q: "How does the map update without refreshing? Why that approach?",
      answer: "A WebSocket — specifically STOMP over SockJS. The browser opens one long-lived connection when the map loads and subscribes to position updates; gps-service pushes each accepted ping down that connection. The page never polls and never reloads.",
      mechanism: "Why not polling: with 50 drivers and a 2-second refresh, polling means 30 HTTP requests per minute per open dashboard — each with headers, a TLS record and a database query — and the data is still up to 2 seconds stale. A WebSocket is one connection that stays open, and the update arrives when the event happens rather than when the next poll comes round.<br><br>Why SockJS on top of STOMP: STOMP gives topics and subscriptions — the client subscribes to a specific trip rather than receiving every vehicle's position. SockJS is the fallback layer: if a corporate proxy blocks WebSockets, it degrades to HTTP streaming instead of the map simply not working.",
      notes: "Deployment detail worth mentioning: the socket goes through the same gateway and the same domain as the API (<code class=\"mono\">/ws/**</code> route), so it is covered by the same TLS certificate. Its allowed origins come from CORS_ALLOWED_ORIGINS — the same variable as the REST CORS config — because a mismatch there means the handshake is rejected and the map silently stays frozen.",
      takeaway: "Push beats poll: one persistent connection, updates delivered on the event rather than on a timer."
    },
    {
      num: 9, tag: "Data",
      q: "Why PostgreSQL instead of MongoDB?",
      answer: "Because this data is relational and the correctness requirements are transactional. Trips reference drivers and vehicles; a trip without a valid vehicle is meaningless. That is precisely the shape relational databases exist for.",
      mechanism: "The specific features we depend on: <strong>ACID transactions</strong> — the outbox pattern is only correct because the trip row and the event row commit together; in a database without multi-document transactions the pattern does not work. <strong>Schemas</strong> — ten logical databases in one instance, one server to run and back up, ten isolated namespaces. <strong>Constraints and enums</strong> — vehicle and trip status constrained at the database level, so a bug cannot write a status that does not exist. <strong>Joins and aggregates</strong> — reports like on-time rate and trips per driver are SQL; in a document store this becomes application code or a duplicated aggregate. <strong>Mature migrations</strong> — Flyway runs versioned migrations on startup, so schema changes ship with the code that needs them.",
      notes: "One limitation to acknowledge: <code class=\"mono\">gps_pings</code> is high-volume, append-only, time-ordered data that is never updated — the classic time-series shape. At scale that belongs in TimescaleDB, InfluxDB or a partitioned table. Saying this unprompted shows you chose Postgres rather than defaulted to it.",
      takeaway: "Choose the store for the workload: relational and transactional for the domain, time-series at scale for the ping stream."
    },
    {
      num: 10, tag: "Security",
      q: "Someone sends X-User-Role: ADMIN manually. Why don't they become an admin?",
      answer: "Because the gateway overwrites that header on every request before the request reaches any service. The client's value is discarded, whatever it was.",
      mechanism: "JwtAuthFilter.java:76-81 — after the gateway validates the JWT with auth-service, it mutates the request:",
      code: "var mutatedRequest = exchange.getRequest().mutate()\n        .headers(h -> {\n            h.set(\"X-User-Id\", userId);   <span class=\"cm\">// set, NOT add</span>\n            h.set(\"X-User-Role\", role);   <span class=\"cm\">// value comes from the validated token</span>\n        })\n        .build();",
      notes: "The critical detail is <code class=\"mono\">set</code> rather than <code class=\"mono\">add</code>. add would append, leaving the attacker's value present alongside the real one — and whichever the downstream service read first would decide the outcome. set replaces. The role a service sees always originates from a signed token auth-service verified, never from the wire.<br><br>The second layer — the better half of the answer: services also accept internal service-to-service calls, and the gateway stamps the internal secret on every proxied request, including an ordinary user's. So the secret alone cannot distinguish a genuine internal call from a user's request. VehicleController.isGenuinelyInternal requires <strong>both</strong> conditions:",
      code2: "return internalServiceSecret.equals(internalKey)\n        && (role == null || role.isBlank());   <span class=\"cm\">// a real internal call has NO user role</span>",
      notes2: "A user request always carries X-User-Role; a genuine service-to-service call never does. Requiring the absence of the role is what closes the hole.<br><br><strong>If pushed</strong> — &ldquo;what if someone reaches a service directly, bypassing the gateway?&rdquo; They cannot from outside. Business services use Docker expose, not ports — reachable only on the internal Docker network, never published to the host, which itself exposes only 80 and 443 through Caddy.",
      takeaway: "Never trust a header from the wire: roles come from a signed token, and internal identity is proven by role absence — not by a shared secret alone."
    },
    {
      num: 11, tag: "Security",
      q: "Why two tokens instead of one JWT?",
      answer: "They solve opposite problems, and one token cannot do both. A JWT is fast to check because it is stateless — the gateway verifies the signature without a database lookup. But statelessness means you cannot revoke it: if a token is stolen it is valid until it expires, and nothing server-side stops it. The two-token split resolves the tension.",
      mechanism: "<strong>Access token</strong>: 15 minutes, not stored server-side, used on every API request, not revocable. <strong>Refresh token</strong>: 7 days, stored hashed, used only to obtain a new access token, revocable immediately. A stolen access token is useful for at most 15 minutes; a stolen refresh token is revocable the moment it is used, because refresh tokens are stored and checked.<br><br>The part that impresses — reuse detection: every refresh token carries a familyId (AuthService.java:160). Refreshing rotates the token: the old one is revoked and a new one issued in the same family. If a revoked token is ever presented again, someone is replaying a token that was already spent — the only realistic explanation is theft. The response is not to reject that one request but to revoke the entire family (revokeAllByFamilyId, line 189), logging out every session descended from that login. You cannot tell whether the legitimate user or the attacker is the one being blocked — so you invalidate both and force a fresh login, which only the real user can complete.",
      notes: "Other auth hardening worth naming: BCrypt with cost factor 12, and account lockout after 5 failed attempts for 15 minutes — with the counter incremented atomically in the database, because a read-then-write would let parallel guessing exceed the limit without ever tripping the lock.",
      takeaway: "Fast stateless access + revocable stateful refresh, with family revocation acting as the theft detector."
    },
    {
      num: 12, tag: "Routing",
      q: "Why self-hosted OSRM instead of the Google Directions API?",
      answer: "Cost and request volume. This app does not ask for a route once per trip — it re-routes whenever a driver deviates and recomputes ETAs as they move. That is a continuous stream of routing requests per active driver. On a metered API that is the single largest running cost in the system. Self-hosted OSRM is a fixed 1 GB container and unlimited requests.",
      mechanism: "<strong>Advantages:</strong> no per-request cost and no quota — we can re-route as often as accuracy demands rather than as often as the budget allows; no API key to leak — one less secret in the mobile app; data privacy — customer delivery addresses never leave our infrastructure; works offline from the internet.<br><br><strong>Disadvantages — say these unprompted, it is the stronger answer:</strong> no live traffic — OSRM routes on road geometry and speed limits, so ETAs are &ldquo;free-flowing&rdquo; estimates (in congested traffic they will be optimistic); stale map data — the Ghana extract is a point-in-time download from Geofabrik, and a new road does not appear until the graph is rebuilt; operational burden — the graph is built with osrm-extract, osrm-partition, osrm-customize and the data folder is gitignored, so forgetting that step makes the container crash-loop while the rest of the stack comes up looking fine; no places, geocoding or lane guidance.",
      notes: "If pushed — &ldquo;so would you switch?&rdquo; For ETA quality in a congested city, a hybrid is right: OSRM for the continuous re-routing and deviation checks, and a paid traffic-aware call at trip creation for the customer-facing ETA. That keeps request volume — and therefore the bill — low, while spending money only where accuracy is visible to a customer.",
      takeaway: "Self-hosted routing trades traffic-awareness and freshness for zero marginal cost — a deliberate trade-off a hybrid would refine."
    },
    {
      num: 13, tag: "Deployment",
      q: "Describe exactly how a request travels from the browser or phone to a backend service.",
      answer: "Trace one request end to end. The admin portal is not on our server — it is a static React bundle built by Vite and hosted on Render; the browser downloads the HTML and JavaScript from Render's CDN. The app calls https://fleettrack.duckdns.org — a DuckDNS name whose A record points at our Google Cloud VM's external IP. VITE_API_BASE_URL is baked in at build time, not read at runtime — changing it needs a rebuild, not a restart.",
      mechanism: "Port 443 on the VM reaches Caddy, the only container facing the internet. Caddy terminates TLS with a certificate it obtained and renews automatically from Let's Encrypt, then proxies to api-gateway:8080 over the internal Docker network — by container name, since Docker provides DNS between containers. The gateway authenticates: it calls auth-service to validate the JWT, then overwrites X-User-Id and X-User-Role from the validated token. It routes by path — /trips/** &rarr; lb://trip-service. The lb:// prefix means it asks Eureka which instances are registered and load-balances between them, rather than using a hardcoded address. trip-service handles the request, reading and writing only its own trip schema in the shared PostgreSQL instance, and the response returns back along the same path.",
      notes: "Two routes deliberately skip the gateway, and knowing why is the mark of understanding the design. <strong>Photos</strong> go to fleettrack-storage.duckdns.org &rarr; MinIO: MinIO signs presigned URLs against its own hostname, so behind a path prefix the signature fails to validate — it needs a clean host of its own, and large uploads never pass through the API. <strong>Turn-by-turn routing</strong> goes to fleettrack-routing.duckdns.org &rarr; OSRM: routing during navigation is high-frequency and carries no user data, so putting it through the gateway would add JWT validation to every call for no benefit.",
      takeaway: "One ingress, one TLS domain, one authenticated choke point — with two deliberate exceptions where the gateway adds nothing."
    },
    {
      num: 14, tag: "Contribution",
      q: "Which parts were you responsible for? What decisions did you make and what was hard?",
      answer: "This one is mine to write — nobody can answer it for me. The structure that scores well: name the area &rarr; name a decision you made and the alternative you rejected &rarr; name a bug that was genuinely hard &rarr; say what you learned.",
      mechanism: "Decisions in this codebase with a real &ldquo;why&rdquo;: <strong>vehicle release via a dedicated endpoint</strong> rather than the generic status endpoint — the generic one would let a late-firing reconciliation sweep drag a van out of MAINTENANCE and back into dispatch; a narrow <code class=\"mono\">PUT /vehicles/{id}/release</code> that only does IN_USE &rarr; AVAILABLE puts the rule in the service that owns the data, so no caller has to remember it. <strong>Design tokens in three layers</strong> in the admin portal, where dark mode remaps only the middle layer — any component that hardcodes a colour fails to flip, making the mistake visible instead of tolerable. <strong>The accuracy filter before the plausibility filter</strong> in gps-service — reject cheaply on a single reading before the more expensive comparison against history.",
      notes: "Bugs that make good &ldquo;what was hard&rdquo; answers — symptom &rarr; what I assumed &rarr; what it actually was &rarr; how I proved it: <strong>Vehicles never returned to the fleet</strong> — completing a trip never released the vehicle, so every successful delivery permanently shrank the dispatchable fleet; it looked like a display bug because the vehicle was on screen, just wrong. <strong>A dark-mode contrast bug</strong> — --color-white is a surface token, and used as text on a navy fill it measured 1.46:1 in dark mode; the fix was conceptual, not cosmetic. <strong>A stale-jar false positive</strong> — I grepped the deployed jar for a string, found it, and concluded the fix was live, but the old code contained that same string; the real proof was reading the compiled constant pool. <strong>The ETA column overlapping the Actions column</strong> — white-space: nowrap on a 146px column where the content measured 203px.",
      takeaway: "The story is the reasoning: decisions with rejected alternatives, bugs with proof, and the lesson extracted — not just a list of what I did."
    },
    {
      num: 15, tag: "Scaling",
      q: "Which component breaks first, and how do you fix it?",
      answer: "The gps_pings table in PostgreSQL — by a wide margin. Do the arithmetic out loud; it is the most convincing thing you can do. 10,000 drivers &times; 1 ping / 2 seconds = 5,000 writes/second. 5,000 &times; 3,600 &times; 8-hour shift &asymp; 144 million rows per day. Everything else is comfortable at that scale. This is not.",
      mechanism: "Why it breaks before anything else: it is not the raw insert rate — Postgres can take 5,000 simple inserts a second on decent hardware. It is that the table is unpartitioned, so every insert also updates indexes over a table growing by 144 million rows a day. Index maintenance degrades, autovacuum falls behind, and query latency on the live map — which reads the same table — climbs with it.",
      notes: "Fixes, cheapest first: <strong>1)</strong> Partition gps_pings by day or week and drop old partitions instead of deleting rows — dropping a partition is instant, DELETE on 144M rows is not; add a retention policy. <strong>2)</strong> Batch on the client — one request with 15 pings every 30 seconds instead of 15 requests; same data, one-fifteenth of the HTTP and transaction overhead (on the roadmap). <strong>3)</strong> Separate reads from writes — the live map does not need Postgres at all; serve it entirely from Redis and let Postgres be the historical archive. <strong>4)</strong> Move the time-series data to a store built for it — TimescaleDB is a Postgres extension, the least disruptive change. <strong>5)</strong> Scale gps-service horizontally — stateless, so easy — but only after the above, since more instances writing to one unpartitioned table makes the real problem worse.<br><br>The second bottleneck, if they ask: the WebSocket fan-out. One dispatcher watching all 10,000 vehicles is 5,000 messages a second to one browser, which no browser will render. That is a product problem before an engineering one — the map should stream only vehicles in the current viewport.",
      takeaway: "Find the real bottleneck with arithmetic, then fix in order of cost — partitioning and retention beat raw insert speed."
    },
    {
      num: 16, tag: "Reliability",
      q: "What happens to GPS data and POD photos when the phone goes offline?",
      answer: "The two cases are genuinely different, and one of them is a known gap. Naming it yourself is worth more than a confident wrong answer. <strong>Photos — handled properly. GPS — not handled.</strong>",
      mechanism: "<strong>Photos:</strong> services/mediaService_3.js implements a persistent retry queue backed by a JSON file on the device (ft_upload_queue.json), so it survives the app being closed and the phone being restarted. The details that matter in a real queue: a cap of 50 items, oldest dropped first — without a cap, a driver with no signal for a shift grows a file that is fully read and re-serialised on every capture; 3 retries, then the entry is dropped — entries that exhausted retries were previously kept forever; an overlap guard — retries run on mount and on every foreground, so two overlapping runs would upload the same photo twice. Proof of delivery is therefore safe: a photo taken in a dead zone goes out when signal returns.<br><br><strong>GPS:</strong> pings are lost. hooks/useDriverLocationTracker.js:31 catches the failure and discards it; store/gpsQueueStore_2.js was intended to be the queue but is a stub — a single comment line. A driver through a tunnel leaves a gap in the recorded track that is never filled.",
      notes: "What I would build, and why it is not merely copying the photo queue: GPS is higher-volume and lower-value-per-item. A 30-minute dead zone is ~900 pings, so it needs a ring buffer with a hard cap and it should batch on flush rather than replaying 900 individual requests. Because each ping carries its own recordedAt, the server orders correctly on arrival — the map back-fills the missing segment rather than showing a teleport.<br><br>A second, related gap worth owning: tracking uses Location.watchPositionAsync, which is foreground-only. If the driver switches to WhatsApp or locks the phone, tracking stops. Production would need startLocationUpdatesAsync with a TaskManager background task and a persistent notification.",
      takeaway: "Durability is per-data-type: the photo queue is a real, capped, retrying queue; the GPS path is a documented stub with a concrete plan."
    },
    {
      num: 17, tag: "Security",
      q: "What vulnerabilities were found, and how were they fixed?",
      answer: "We ran a structured audit across the portal, backend, infrastructure, CI and documentation. Roughly 40 issues were found and fixed. The ones worth presenting:",
      mechanism: "",
      notes: "Still open, and you should say so: JWT_SECRET and the Google Maps Android key are in git history and need rotating; purging the Maps key from history is what currently keeps the CI secret scan red. There are also no automated backups.<br><br>The security posture that was already right: BCrypt cost 12, atomic failed-attempt counting, refresh-token rotation with family revocation, rate limiting, JWT validated at the gateway, and TLS everywhere via Caddy.",
      takeaway: "Audit, fix, verify — and report what is still open, because claiming coverage of an open gap destroys credibility."
    },
    {
      num: 18, tag: "Limitations",
      q: "What is missing, why, and what would you build with one more month?",
      answer: "Missing, ranked by how much they would actually hurt in production. <strong>No backups</strong> — zero; if the VM's disk fails, every trip, photo and audit record is gone; not built because it needs somewhere to put them and a tested restore. <strong>Offline GPS queue and background tracking</strong> — tracking stops when the driver leaves the app. <strong>No observability</strong> — no metrics, no structured logs, no alerting; diagnosis is docker compose logs, and we would find out about an outage from a user. <strong>gps_pings is unpartitioned</strong> with no retention policy. <strong>analytics-service is an unimplemented stub</strong> — no pom.xml, no main class; its schema exists, nothing writes to it, and it is deliberately not deployed. <strong>No push notifications by default</strong> — in-app polling covers the current need. <strong>Single point of failure</strong> — one VM, one Postgres, no replica.",
      mechanism: "With one extra month, in order: <strong>Week 1 — backups.</strong> pg_dump plus a MinIO mirror to Cloud Storage on a cron, and a tested restore — an untested backup is not a backup; highest value per hour, because it converts an unrecoverable failure into an inconvenient one. <strong>Week 2 — background GPS and the offline queue.</strong> The feature is called live tracking and it currently stops when the driver locks their phone. <strong>Week 3 — observability.</strong> Actuator plus Micrometer plus Prometheus, and alerting on service health — you cannot operate what you cannot see. <strong>Week 4 — partition gps_pings, add retention, and batch pings from the client.</strong>",
      notes: "Note that none of these are features. They are all the difference between a system that demos and a system that runs — which is the point worth making.",
      takeaway: "Prioritise by production harm, not by demo appeal — availability and recoverability outrank features."
    },
    {
      num: 19, tag: "Testing",
      q: "What automated tests exist? What is well covered, what is not?",
      answer: "Backend — 42 JUnit 5 tests with Mockito and AssertJ. <strong>Vehicle release:</strong> 7 tests — IN_USE &rarr; AVAILABLE only; MAINTENANCE / DECOMMISSIONED / AVAILABLE never overwritten; idempotency; missing and null ids. <strong>Trip lifecycle:</strong> 6 tests — release on complete and on cancel; a vehicle-service outage must not fail a completed delivery; the reconciliation sweep frees stranded vehicles and skips vehicles on live trips. <strong>Trip authorization:</strong> 4 tests — role enforcement on trip endpoints. <strong>Auth and email:</strong> the rest — security fixes from the audit.",
      mechanism: "Frontend — Playwright with axe-core, across three viewports (desktop 1440, tablet 768, mobile Pixel 7): route smoke tests, horizontal-overflow and tap-target checks, and WCAG 2.1 AA auditing in both light and dark themes.<br><br>Well tested: the vehicle-release rule — deliberately, because it has two opposite failure modes. Not releasing strands vehicles; releasing too eagerly puts an unroadworthy van back into dispatch. The parameterised test over the other statuses exists specifically to stop a future &ldquo;simplification&rdquo; back to a blanket status write.",
      notes: "Weakly tested — say this plainly: <strong>no integration tests</strong> — everything is unit-level with mocked collaborators, and nothing verifies that trip-service and vehicle-service actually work together over HTTP; Testcontainers is the right tool and the biggest single gap. <strong>No mobile tests at all.</strong> The Playwright specs run with the API down — deliberately, since that exercises the loading, empty and error states, which are the most neglected surface — but that means they structurally cannot catch data-dependent bugs; the ETA-column overflow was exactly such a bug, and it had to be measured directly against the built stylesheet instead.<br><br>A worked example of testing done right: when the vehicle release moved to a dedicated endpoint, three existing tests failed correctly. A fourth still passed, but only because it stubbed an exception on a method the code no longer called, so it was asserting nothing. A test that cannot fail is worse than no test, because it reports confidence it does not have. That one was rewritten to genuinely exercise the outage path.",
      takeaway: "A test that cannot fail is worse than no test — it reports confidence it does not have."
    },
    {
      num: 20, tag: "Architecture",
      q: "Looking back, what would you change?",
      answer: "Give one answer with real reasoning rather than three shallow ones. The change: eleven services was too many. I would build a modular monolith and split out gps-service alone.",
      mechanism: "The evidence is a bug this project actually had: completed trips never returned their vehicle to the fleet, so every successful delivery permanently shrank the dispatchable fleet. The reason that bug was possible is architectural: one piece of state — is this van in use — had to be kept consistent across two services with no shared transaction. trip-service commits the trip; vehicle-service owns the status; nothing makes the second happen if the first succeeds. In a monolith that is one transaction and the bug cannot exist.<br><br>What it cost to fix properly across a service boundary: release after commit on both the complete and cancel paths; a dedicated endpoint enforcing IN_USE &rarr; AVAILABLE so a late call cannot pull a van out of MAINTENANCE; a scheduled reconciliation sweep for when vehicle-service is briefly unreachable; thirteen tests to hold all of it in place. That is a lot of machinery for one boolean. It is the correct machinery given the architecture — but it is a cost the architecture created.",
      notes: "What I would keep: gps-service genuinely deserves to be separate — its write volume is three orders of magnitude above anything else, and it is the one component whose scaling story is different. That is the real test for a service boundary — not &ldquo;is this a different noun?&rdquo; but &ldquo;does this need to scale, fail, or deploy differently?&rdquo; Vehicles and trips do not. GPS does.<br><br>Final reflection: I would rather have made this mistake and understood why than have guessed right without the reasoning.",
      takeaway: "The real test of a service boundary is different scaling, failure, or deployment needs — not a different noun."
    }
  ];

  /* The security-audit findings table for question 17 */
  EVALUATOR_QA[16].mechanism =
    '<div class="table-wrap"><table><thead><tr><th>Finding</th><th>Risk</th><th>Fix</th></tr></thead><tbody>' +
    "<tr><td>Redis had no password</td><td>An unauthenticated Redis is a well-known remote-code-execution primitive via CONFIG SET</td><td>--requirepass, plus loopback-only binding</td></tr>" +
    "<tr><td>Internal secret alone treated a request as internal</td><td>The gateway stamps that secret on every proxied request, so a user request could be mistaken for a service call</td><td>Require the secret <em>and</em> the absence of X-User-Role</td></tr>" +
    "<tr><td>Internal services published to the host</td><td>Anyone reaching the host could bypass the gateway and its JWT check</td><td>expose instead of ports; HOST_BIND=127.0.0.1 for the rest</td></tr>" +
    "<tr><td>Redis and Postgres OOM-killed under their own limits</td><td>Postgres was killed mid-transaction; restart: unless-stopped masked it as a blip</td><td>Raised caps above each engine's working set; Redis maxmemory below its cgroup cap so it evicts rather than dies</td></tr>" +
    "<tr><td>Trip cancellation had no confirmation</td><td>One mis-click permanently cancelled a live delivery and notified the driver</td><td>Confirmation dialog, matching the already-guarded path</td></tr>" +
    "<tr><td>Dark-mode contrast failures (multiple)</td><td>Accessibility — one measured 1.46:1 against a 4.5:1 requirement</td><td>Correct semantic tokens; verified with axe-core</td></tr>" +
    "<tr><td>Dashboard counted every driver as active</td><td>d.active was read where the DTO field is isActive — undefined, falsy, but counted</td><td>Corrected against the actual DTO</td></tr>" +
    "<tr><td>Metrics rendered with no backing API</td><td>Driver stats showed a hardcoded 0 for fields that do not exist on the DTO, reading as a measurement</td><td>Removed; genuinely-null values render as an em-dash with an explanatory sub-line</td></tr>" +
    "</tbody></table></div>";

  /* ------------------------------------------------------------------
     Engineer follow-ups — 10 questions with rich formatting.
     ------------------------------------------------------------------ */
  var ENGINEER_QA = [
    {
      num: "B1", tag: "Outbox",
      q: "Why is the outbox only in trip-service?",
      blocks: [
        { h: "Short answer", icon: "i-message", body: [
          { t: "p", html: "Because trip-service is the only service where losing an event loses information nothing else can reconstruct. A trip's lifecycle transitions are the source of truth for notifications, audit and analytics." }
        ]},
        { h: "The others are reconstructible", icon: "i-refresh", body: [
          { t: "p", html: "The other publishers emit events that are either already durable elsewhere or reconstructible: incident-service writes the incident to its own table first, so a lost event costs an email, not the record." }
        ]},
        { h: "The honest part", icon: "i-info", body: [
          { t: "callout", kind: "info", title: "Incremental adoption, not exhaustive analysis", text: "The outbox is real work — a table, a publisher, a scheduled sweep — and we applied it where the cost of loss was highest. If incident alerts became business-critical, incident-service should get one too. What we should not claim is that the current split came from an exhaustive analysis." }
        ]}
      ]
    },
    {
      num: "B2", tag: "Redis",
      q: "Why Redis rather than querying Postgres for every GPS update?",
      blocks: [
        { h: "Short answer", icon: "i-zap", body: [
          { t: "p", html: "Because the access pattern is &ldquo;give me the newest row per trip&rdquo;, which is one of the worst queries you can ask a growing table for. In SQL it is a DISTINCT ON or a window function over a table with millions of rows, run every time a dashboard repaints. In Redis it is a single key, <code class=\"mono\">trip:latest-ping:&lt;tripId&gt;</code>, overwritten on every ping — an O(1) read of the current value with no scan." }
        ]},
        { h: "Correctness detail", icon: "i-check-circle", body: [
          { t: "p", html: "Pings can arrive out of order, so the write is guarded by <code class=\"mono\">isNewerThanCachedLatest</code> — an older ping arriving late must not overwrite a newer cached position and make the map jump backwards." }
        ]},
        { h: "Expiry as a feature", icon: "i-clock", body: [
          { t: "p", html: "Redis is also used for state that should expire on its own: the deviation detector counts consecutive off-route pings with a 5-minute TTL, so a driver who deviates once and returns has that counter disappear without any cleanup code. Expiry as a feature is something Postgres does not give you for free." }
        ]}
      ]
    },
    {
      num: "B3", tag: "Events",
      q: "How do you prevent duplicate event processing?",
      blocks: [
        { h: "Short answer", icon: "i-database", body: [
          { t: "p", html: "A <code class=\"mono\">ProcessedEvent</code> table in each consuming service — audit-service, notification-service, auth-service and analytics-service each have one. Every event carries a unique id; the consumer records it after processing and skips any id it has already seen." }
        ]},
        { h: "Why this is necessary, not paranoia", icon: "i-bell", body: [
          { t: "p", html: "RabbitMQ guarantees at-least-once delivery. If a consumer processes a message and then crashes before acknowledging it, the broker redelivers. Without deduplication, a driver gets the same &ldquo;trip assigned&rdquo; email twice." }
        ]},
        { h: "Mechanism", icon: "i-terminal", body: [
          { t: "code", code: "<span class=\"kw\">ON_MESSAGE</span>(event):\n  <span class=\"kw\">if</span> exists ProcessedEvent(event.id): <span class=\"cm\">skip</span>\n  <span class=\"kw\">else</span>:\n    do_work(event)\n    insert ProcessedEvent(event.id)   <span class=\"cm\">-- same tx as effects where possible</span>\n    ack(event)" }
        ]},
        { h: "Why deduplication lives in the consumer", icon: "i-info", body: [
          { t: "callout", kind: "info", title: "Only the consumer knows", text: "Only the consumer knows what &ldquo;already done&rdquo; means for its own work. Handling it centrally would require the broker to understand every consumer's side effects." }
        ]}
      ]
    },
    {
      num: "B4", tag: "Data",
      q: "How would you migrate from one Postgres with schemas to separate databases?",
      blocks: [
        { h: "Short answer", icon: "i-database", body: [
          { t: "p", html: "This migration is already most of the way done — and that was the point of the schema split. The hard part of such a migration is normally untangling cross-service joins and foreign keys. We have none — no schema references another — so the steps are mechanical." }
        ]},
        { h: "Steps", icon: "i-list", body: [
          { t: "ol", items: [
            "Stand up a new Postgres instance for the service being moved.",
            "pg_dump that one schema and restore it into the new instance.",
            "Change that service's SPRING_DATASOURCE_URL. Nothing else in the codebase changes.",
            "Redeploy that service alone.",
            "Drop the old schema once you are confident."
          ]}
        ]},
        { h: "What you lose", icon: "i-alert", body: [
          { t: "callout", kind: "warn", title: "Say this unprompted", text: "Cross-service reporting that currently can be done in one SQL statement — even though we avoid it — becomes impossible. And you now have N databases to back up, monitor and patch. That is the real reason not to do this until a service's load actually justifies it." }
        ]}
      ]
    },
    {
      num: "B5", tag: "Security",
      q: "Why authenticate at the gateway rather than in every service?",
      blocks: [
        { h: "Short answer — four reasons, in order of importance", icon: "i-shield", body: [
          { t: "ol", items: [
            "<strong>One implementation to get right.</strong> JWT validation is security-critical code. Eleven copies means eleven chances to make a subtle mistake and eleven places to patch.",
            "<strong>One place to change policy.</strong> Adding a claim or rotating the signing key is a gateway change, not a fleet-wide redeploy.",
            "<strong>Services stay simple.</strong> A service trusts X-User-Role and implements only authorization — what this role may do — not authentication.",
            "<strong>Rejected at the edge.</strong> Unauthenticated traffic is rejected before it can consume a thread or a connection anywhere downstream."
          ]}
        ]},
        { h: "The risk this creates", icon: "i-alert", body: [
          { t: "callout", kind: "danger", title: "A single point of trust", text: "If a service were reachable without going through the gateway, it would trust a forged header completely. That is exactly why business services are expose-only and never published to the host — the network topology enforces what the header alone cannot." }
        ]}
      ]
    },
    {
      num: "B6", tag: "Mobile",
      q: "How would you implement background GPS in Expo?",
      blocks: [
        { h: "What we have now", icon: "i-alert", body: [
          { t: "callout", kind: "warn", title: "Foreground only", text: "Location.watchPositionAsync is foreground only. Lock the phone or switch apps and tracking stops. This is a real gap (Q16)." }
        ]},
        { h: "What it needs", icon: "i-cpu", body: [
          { t: "ul", items: [
            "<code class=\"mono\">Location.startLocationUpdatesAsync</code> with a TaskManager background task, which survives the app leaving the foreground.",
            "A persistent notification — Android requires it for background location, and it is honest anyway: the driver should see that they are being tracked.",
            "<code class=\"mono\">ACCESS_BACKGROUND_LOCATION</code> permission, requested separately and after foreground permission — Android deliberately makes this a second, harder prompt.",
            "Batching — waking the radio for every ping destroys battery; buffer locally and flush every ~30 seconds.",
            "The offline queue (Q16) — background tracking without one just loses data unattended."
          ]}
        ]},
        { h: "The non-technical obstacle", icon: "i-info", body: [
          { t: "callout", kind: "info", title: "OEM battery optimisation", text: "Aggressive OEM battery optimisation on Xiaomi, Huawei and Samsung devices will kill background tasks regardless of what the code does. Real fleet apps ship device-specific instructions telling drivers to exempt the app." }
        ]}
      ]
    },
    {
      num: "B7", tag: "Infrastructure",
      q: "Why Docker Compose instead of Kubernetes?",
      blocks: [
        { h: "Short answer", icon: "i-server", body: [
          { t: "p", html: "Because Kubernetes solves problems we do not have, at a cost we cannot absorb. Kubernetes exists for multi-node scheduling, rolling updates across replicas, self-healing across machines, and autoscaling. We run one VM — on a single node, a scheduler has nothing to schedule." }
        ]},
        { h: "The cost is real", icon: "i-cpu", body: [
          { t: "p", html: "A control plane consuming 1–2 GB of our 8 GB, plus manifests, ingress controllers, secret management and a much steeper failure-diagnosis path. On this machine, k3s would have taken memory directly from the services doing the work." }
        ]},
        { h: "What Compose gives us", icon: "i-check-circle", body: [
          { t: "ul", items: [
            "Declarative service definitions",
            "Dependency ordering with health checks",
            "Resource limits",
            "Restart policies",
            "An internal network"
          ]}
        ]},
        { h: "When we would switch", icon: "i-flag", body: [
          { t: "callout", kind: "success", title: "The honest boundary", text: "The moment we need a second node. Not scale in the abstract, but the point at which &ldquo;which machine does this run on?&rdquo; becomes a question someone has to answer." }
        ]}
      ]
    },
    {
      num: "B8", tag: "Ops",
      q: "How would you monitor microservices in production?",
      blocks: [
        { h: "Today", icon: "i-alert", body: [
          { t: "callout", kind: "danger", title: "Currently nothing", text: "docker compose logs is the only tool — which means we would learn about an outage from a user." }
        ]},
        { h: "Build order", icon: "i-layers", body: [
          { t: "ol", items: [
            "<strong>Health</strong> — Spring Boot Actuator on every service, with /health wired into Compose health checks so a wedged service is restarted rather than left silently broken.",
            "<strong>Metrics</strong> — Micrometer exporting to Prometheus, with Grafana on top. The four that matter here: request rate, error rate, latency percentiles (p95/p99, not averages — an average hides the tail that users feel), and JVM heap per service.",
            "<strong>Logs</strong> — structured JSON with a correlation id propagated from the gateway through every downstream call, so one user's request can be traced across services. Without it, correlating eleven log streams by timestamp is guesswork.",
            "<strong>Tracing</strong> — OpenTelemetry, once &ldquo;which service made this slow?&rdquo; becomes a real question.",
            "<strong>Alerting</strong> — on symptoms users feel (error rate, latency), not on causes (CPU). Alerting on causes produces noise nobody reads."
          ]}
        ]},
        { h: "The domain-specific metric", icon: "i-activity", body: [
          { t: "callout", kind: "info", title: "GPS pings per minute vs active trips", text: "If that ratio drops, tracking is broken — and no generic infrastructure metric would show it. That is the first metric I would add." }
        ]}
      ]
    },
    {
      num: "B9", tag: "Deployment",
      q: "Do you have zero-downtime deployment?",
      blocks: [
        { h: "Today", icon: "i-alert", body: [
          { t: "callout", kind: "warn", title: "We do not have it", text: "docker compose up -d --build stops the old container and starts the new one; that service is unavailable for the tens of seconds a Spring Boot container takes to boot and register with Eureka." }
        ]},
        { h: "Why it does not hurt much yet", icon: "i-info", body: [
          { t: "p", html: "The gateway routes via Eureka, so a service that deregisters cleanly gets no traffic — and it only affects the one service being replaced." }
        ]},
        { h: "What true zero-downtime needs", icon: "i-layers", body: [
          { t: "ul", items: [
            "<strong>More than one instance per service</strong> — the prerequisite, and we have one each.",
            "<strong>Rolling replacement</strong> — start the new instance, wait for it to register and pass health checks, then stop the old one.",
            "<strong>Graceful shutdown</strong> — deregister from Eureka first, finish in-flight requests, then exit. Otherwise the gateway sends requests to a container that is already shutting down."
          ]}
        ]},
        { h: "Backward-compatible migrations — the one people miss", icon: "i-database", body: [
          { t: "callout", kind: "warn", title: "Flyway runs on startup", text: "During a rolling deploy old and new code run against the same schema simultaneously. Every migration must therefore be additive — add a column, deploy code that writes both, backfill, then remove the old column in a later release. A migration that renames a column breaks the still-running old instances." }
        ]}
      ]
    },
    {
      num: "B10", tag: "Resilience",
      q: "If one service becomes unavailable, what still works?",
      blocks: [
        { h: "Short answer", icon: "i-layers", body: [
          { t: "p", html: "The system degrades in proportion to what the failed service owned — that is the payoff for the architecture, so answer it concretely rather than in the abstract." }
        ]},
        { h: "Service availability matrix", icon: "i-database", body: [
          { t: "table",
            head: ["Service down", "What breaks", "What keeps working"],
            rows: [
              ["notification-service", "Emails", "Everything. Events queue in RabbitMQ and are consumed when it returns"],
              ["audit-service", "New audit records", "Everything. Durable queues hold the events"],
              ["media-service", "Photo upload; trips cannot be completed (POD check fails)", "Tracking, trip creation, the map"],
              ["gps-service", "Live map, deviation detection", "Trip creation and completion, the whole admin portal"],
              ["vehicle-service", "Trip creation (cannot verify a vehicle is free); vehicles are not released on completion — the reconciliation sweep repairs this when it returns", "Existing trips, tracking, delivery"],
              ["auth-service", "Everything — the gateway validates every token against it", "Nothing new. Open websockets survive"],
              ["api-gateway", "Everything from outside", "Internal service-to-service calls"],
              ["Postgres", "Everything", "Nothing"]
            ] }
        ]},
        { h: "Summary", icon: "i-alert", body: [
          { t: "callout", kind: "danger", title: "Hard dependencies", text: "auth-service, the gateway and Postgres are hard dependencies — if any of them is down, so is the product. The peripheral services degrade gracefully." }
        ]},
        { h: "Mitigations in place", icon: "i-check-circle", body: [
          { t: "ul", items: [
            "Durable queues with dead-letter queues — async consumers can be down without losing work.",
            "restart: unless-stopped recovers from crashes.",
            "The vehicle-release path is best-effort with a reconciliation sweep, so a transient vehicle-service outage self-heals rather than needing a human."
          ]}
        ]},
        { h: "The mitigation missing", icon: "i-info", body: [
          { t: "callout", kind: "info", title: "Circuit breakers (Resilience4j)", text: "Right now a slow downstream service ties up caller threads until timeout rather than failing fast." }
        ]}
      ]
    }
  ];

  /* ------------------------------------------------------------------
     Accordion rendering
     ------------------------------------------------------------------ */
  function buildEvaluatorItem(qa) {
    var blocks = [];
    blocks.push(qaBlock("i-message", "Professional answer", "<p>" + qa.answer + "</p>"));
    blocks.push(qaBlock("i-cpu", "Technical explanation", qa.mechanism + (qa.code ? '<pre class="code-block">' + qa.code + "</pre>" : "")));
    blocks.push(qaBlock(
      "i-clipboard",
      "Important notes",
      "<p>" + qa.notes + "</p>" +
      (qa.code2 ? '<pre class="code-block">' + qa.code2 + "</pre>" : "") +
      (qa.notes2 ? "<p>" + qa.notes2 + "</p>" : "")
    ));
    blocks.push(qaBlock("i-flag", "Key takeaway", '<div class="callout callout--success"><svg aria-hidden="true"><use href="#i-flag"></use></svg><div><p style="margin:0">' + qa.takeaway + "</p></div></div>"));

    return (
      '<div class="acc-item" data-id="e' + qa.num + '" data-tag="' + qa.tag + '">' +
      '<h3 class="acc-head-wrap" style="margin:0">' +
      '<button class="acc-head" aria-expanded="false" aria-controls="panel-e' + qa.num + '" id="head-e' + qa.num + '">' +
      '<span class="acc-num" aria-hidden="true">' + qa.num + "</span>" +
      '<span class="acc-q"><strong>' + qa.q + '</strong><span class="chip acc-tag">' + qa.tag + "</span></span>" +
      '<span class="acc-toggle" aria-hidden="true"><svg><use href="#i-chevron-down"></use></svg></span>' +
      "</button></h3>" +
      '<div class="acc-panel" id="panel-e' + qa.num + '" role="region" aria-labelledby="head-e' + qa.num + '">' +
      '<div class="acc-panel-inner"><div class="qa-grid">' + blocks.join("") + "</div></div>" +
      "</div></div>"
    );
  }

  function buildEngineerItem(qa) {
    var blocks = qa.blocks.map(function (b) {
      return qaBlock(b.icon || "i-info", b.h, richBody(b.body));
    });
    return (
      '<div class="acc-item" data-id="b' + qa.num.replace("B", "") + '" data-tag="' + qa.tag + '">' +
      '<h3 class="acc-head-wrap" style="margin:0">' +
      '<button class="acc-head" aria-expanded="false" aria-controls="panel-b' + qa.num + '" id="head-b' + qa.num + '">' +
      '<span class="acc-num" aria-hidden="true">' + qa.num + "</span>" +
      '<span class="acc-q"><strong>' + qa.q + '</strong><span class="chip acc-tag">' + qa.tag + "</span></span>" +
      '<span class="acc-toggle" aria-hidden="true"><svg><use href="#i-chevron-down"></use></svg></span>' +
      "</button></h3>" +
      '<div class="acc-panel" id="panel-b' + qa.num + '" role="region" aria-labelledby="head-b' + qa.num + '">' +
      '<div class="acc-panel-inner"><div class="qa-grid">' + blocks.join("") + "</div></div>" +
      "</div></div>"
    );
  }

  function renderAccordions() {
    var qaList = $("#qa-list");
    var engList = $("#engineer-list");
    if (qaList) qaList.innerHTML = EVALUATOR_QA.map(buildEvaluatorItem).join("");
    if (engList) engList.innerHTML = ENGINEER_QA.map(buildEngineerItem).join("");
    updateCounts();
  }

  /* ------------------------------------------------------------------
     Accordion behaviour (event delegation) — supports multiple open.
     ------------------------------------------------------------------ */
  function bindAccordions() {
    document.addEventListener("click", function (e) {
      var head = e.target.closest ? e.target.closest(".acc-head") : null;
      if (!head) return;
      var item = head.closest(".acc-item");
      if (!item) return;
      var open = item.classList.contains("open");
      item.classList.toggle("open", !open);
      head.setAttribute("aria-expanded", String(!open));
    });
  }

  /* ------------------------------------------------------------------
     Search — filters evaluator questions against question + content
     ------------------------------------------------------------------ */
  function updateCounts() {
    var qaTotal = EVALUATOR_QA.length;
    var qaVisible = $$("#qa-list .acc-item").filter(function (el) {
      return !el.classList.contains("hidden");
    }).length;
    var qc = $("#qa-count");
    if (qc) qc.innerHTML = "Showing <b>" + qaVisible + "</b> of <b>" + qaTotal + "</b> evaluator questions";

    var engTotal = ENGINEER_QA.length;
    var ec = $("#engineer-count");
    if (ec) ec.innerHTML = "<b>" + engTotal + "</b> engineer-level follow-ups";
  }

  function bindSearch() {
    var input = $("#qa-search-input");
    if (!input) return;
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var items = $$("#qa-list .acc-item");
      var visible = 0;
      items.forEach(function (el) {
        var haystack = el.textContent.toLowerCase();
        var match = q === "" || haystack.indexOf(q) !== -1;
        el.classList.toggle("hidden", !match);
        if (match) visible++;
      });
      var empty = $("#qa-empty");
      if (empty) empty.classList.toggle("visible", visible === 0);
      updateCounts();
    });
  }

  /* ------------------------------------------------------------------
     Architecture explorer
     ------------------------------------------------------------------ */
  function bindArchitecture() {
    var nodes = $$("#arch-layers .arch-node");
    var titleEl = $("#insp-title");
    var subEl = $("#insp-sub");
    var descEl = $("#insp-desc");
    var tagsEl = $("#insp-tags");
    if (!nodes.length || !descEl) return;

    function select(key, scrollTo) {
      var data = ARCH[key] || ARCH.gateway;
      nodes.forEach(function (n) {
        var active = n.getAttribute("data-node") === key;
        n.classList.toggle("active", active);
        n.setAttribute("aria-expanded", String(active));
      });
      titleEl.textContent = data.title;
      subEl.textContent = data.sub;
      descEl.innerHTML = data.desc;
      tagsEl.innerHTML = data.tags.map(function (t) {
        return '<span class="chip chip--green">' + t + "</span>";
      }).join("");
      if (scrollTo && window.matchMedia("(max-width: 900px)").matches) {
        var inspector = $("#arch-inspector");
        if (inspector) inspector.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    nodes.forEach(function (n) {
      n.addEventListener("click", function () {
        select(n.getAttribute("data-node"), true);
      });
    });

    select("gateway", false);
  }

  /* ------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------ */
  function bindReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     Animated stat counters
     ------------------------------------------------------------------ */
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-count")) || 0;
    var duration = 1400;
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.textContent = val.toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target.toLocaleString("en-US");
    }
    requestAnimationFrame(frame);
  }

  function bindCounters() {
    var nums = $$(".stat-value .num[data-count]");
    if (!("IntersectionObserver" in window)) {
      nums.forEach(function (el) {
        el.textContent = (parseFloat(el.getAttribute("data-count")) || 0).toLocaleString("en-US");
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     Test coverage bars
     ------------------------------------------------------------------ */
  function bindBars() {
    var bars = $$(".bar-fill[data-width]");
    if (!("IntersectionObserver" in window)) {
      bars.forEach(function (b) { b.style.width = b.getAttribute("data-width") + "%"; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.width = entry.target.getAttribute("data-width") + "%";
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    bars.forEach(function (b) { io.observe(b); });
  }

  /* ------------------------------------------------------------------
     Header / scroll-spy / back-to-top
     ------------------------------------------------------------------ */
  function bindHeader() {
    var header = $("#site-header");
    var backTop = $("#back-top");

    var spyIds = $$("#nav-links a").map(function (a) {
      return a.getAttribute("href");
    }).filter(function (h) { return h && h.charAt(0) === "#"; });
    var spySections = spyIds.map(function (id) { return $(id); }).filter(Boolean);
    var links = $$("#nav-links a");

    function onScroll() {
      var y = window.pageYOffset;
      header.classList.toggle("scrolled", y > 8);
      backTop.classList.toggle("visible", y > 600);

      var current = spyIds[0];
      spySections.forEach(function (sec, i) {
        if (sec.getBoundingClientRect().top <= 120) current = spyIds[i];
      });
      links.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === current);
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (backTop) {
      backTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* ------------------------------------------------------------------
     Mobile navigation
     ------------------------------------------------------------------ */
  function bindNav() {
    var toggle = $("#nav-toggle");
    var links = $("#nav-links");
    if (!toggle || !links) return;

    function close() {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  /* ------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------ */
  function bindYear() {
    var el = $("#year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  function init() {
    renderAccordions();
    bindAccordions();
    bindSearch();
    bindArchitecture();
    bindReveal();
    bindCounters();
    bindBars();
    bindHeader();
    bindNav();
    bindYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
