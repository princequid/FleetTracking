# FleetTrack Pro — Deployment Guide

This deploys the three pieces to **free** hosting:

| Piece | What it is | Where it goes |
|---|---|---|
| **Backend** | 9 Spring Boot services + Postgres + RabbitMQ + Redis + MinIO + OSRM | **One Google Cloud VM** running Docker Compose |
| **Admin portal** | Static React site | **Render** free static hosting |
| **Mobile app** | React Native / Expo | Built to an **APK** via Expo EAS, installed on phones |

> **Excluded from deployment:** `analytics-service` (an unimplemented stub). Nothing references it, so it is simply not run.
>
> **Why not a free-tier VM:** Google Cloud's Always-Free Compute Engine instance (`e2-micro`) has only **1GB RAM** — nowhere near enough for this stack (we saw this exact backend strain even on a 7.7GB local dev machine). Part A below uses a properly-sized VM (`e2-standard-2`, 2 vCPU / 8GB RAM) paid for out of the **$300 / 90-day free trial credit** every new GCP account gets — genuinely free for the trial period, but budget for a small monthly cost (~$50/mo on-demand) or plan to downsize/shut down before the trial ends and billing kicks in for real.

---

## Prerequisites (accounts you create)

1. **Google Cloud** account — https://console.cloud.google.com (new accounts get a $300/90-day free trial credit; a card is required for verification but nothing is charged until the trial ends and you explicitly upgrade).
2. **Render** account — https://render.com (sign in with GitHub).
3. **A domain** — easiest free option is **DuckDNS** (https://duckdns.org). Create **three** names pointing at your VM's IP, e.g. `fleettrack.duckdns.org` (API), `fleettrack-storage.duckdns.org` (storage), and `fleettrack-routing.duckdns.org` (OSRM — the driver app's turn-by-turn/rerouting calls go straight to this, not through the gateway).
4. **GitHub** — your code must be pushed to a repo (Render builds from it).
5. *(Optional, for push notifications)* **Firebase** service‑account JSON.

---

## Part A — Backend on the Google Cloud VM

### A1. Create the VM
1. Google Cloud Console → **Compute Engine → VM instances → Create Instance**.
2. **Name:** `fleettrack-backend` (or anything). **Region/Zone:** any (pick one close to your users).
3. **Machine type:** `e2-standard-2` (2 vCPU, 8GB RAM) — General purpose (E2) family. This is what makes the trial-credit tradeoff worth it; don't drop to `e2-micro`/`e2-small`, they're too small for this stack.
4. **Boot disk:** click Change → **Ubuntu → Ubuntu 22.04 LTS**, size **30GB** is fine.
5. **Firewall:** check **Allow HTTP traffic** and **Allow HTTPS traffic** (this creates the 80/443 firewall rules for you automatically).
6. Create. Note the **External IP** shown in the instance list once it's running.

### A2. Confirm the firewall (only 22, 80, 443 reachable)
GCP's default network already allows SSH (22) via the `default-allow-ssh` rule, and checking the HTTP/HTTPS boxes in A1 added rules for 80/443. Double-check in **VPC network → Firewall** that no other rule opens a broader port range (e.g. `default-allow-all` shouldn't exist on a fresh project). Nothing else needs to be reachable — the Compose file publishes internal ports (Postgres, MinIO, etc.) on the VM's own loopback only (see A6's `HOST_BIND`), so they're never exposed even if you skip this check, but it's worth confirming.

### A3. Point your domains at the VM
In DuckDNS, set **all three** names' IP to the VM's **External IP** from A1:
- `fleettrack.duckdns.org` → VM External IP
- `fleettrack-storage.duckdns.org` → VM External IP
- `fleettrack-routing.duckdns.org` → VM External IP

### A4. Install Docker on the VM
Connect via the Console's **SSH** button (opens a browser terminal, no key setup needed) or your own SSH client if you added a key in A1, then:
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

### A5. Get the code onto the VM
```bash
git clone <YOUR_GITHUB_REPO_URL> fleettrack
cd fleettrack/infrastructure_1
```

### A6. Create the production `.env`
Create `infrastructure_1/.env` inside your clone (it is gitignored — never commit it). **Generate the secrets on the VM** so they never touch a file on your laptop:

```bash
cat > .env <<EOF
# ── Strong secrets (generated fresh on the server) ──
POSTGRES_USER=fleettrack
POSTGRES_PASSWORD=$(openssl rand -hex 20)
POSTGRES_DB=fleettrack
RABBITMQ_USER=fleettrack
RABBITMQ_PASSWORD=$(openssl rand -hex 20)
MINIO_ROOT_USER=fleettrack
MINIO_ROOT_PASSWORD=$(openssl rand -hex 20)
JWT_SECRET=$(openssl rand -hex 48)
INTERNAL_SERVICE_SECRET=$(openssl rand -hex 32)

# ── First admin account (created automatically on auth-service's first boot, only if no
# admin exists yet — see InitialAdminBootstrap. Pick a real password here — there's no
# self-service reset for THIS account unless GMAIL_USERNAME/GMAIL_APP_PASSWORD below are
# also set, since the forgot-password email needs somewhere to send from.) ──
INITIAL_ADMIN_EMAIL=you@yourcompany.com
INITIAL_ADMIN_PASSWORD=$(openssl rand -hex 12)

# ── Public hostnames (your three DuckDNS names) ──
API_DOMAIN=fleettrack.duckdns.org
STORAGE_DOMAIN=fleettrack-storage.duckdns.org
OSRM_DOMAIN=fleettrack-routing.duckdns.org
ACME_EMAIL=you@example.com

# The endpoint baked into presigned photo URLs — must be the public storage domain.
MINIO_EXTERNAL_ENDPOINT=https://fleettrack-storage.duckdns.org

# Browser origin(s) allowed to call the API AND the live-map websocket — your Render
# admin URL (fill after Part B). Drives both the gateway CORS and gps-service's socket.
CORS_ALLOWED_ORIGINS=https://YOUR-ADMIN.onrender.com

# ── Email (Gmail SMTP) — powers password reset, welcome, critical incident alerts,
# daily fleet summary and new-device-login emails. Leave both blank to disable sending
# entirely (auth-service/notification-service log a warning and skip — nothing breaks).
# GMAIL_APP_PASSWORD comes from a Google Account with 2-Step Verification enabled
# (myaccount.google.com/apppasswords), NOT your normal Gmail password.
GMAIL_USERNAME=your.address@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Same Render admin URL as CORS_ALLOWED_ORIGINS above — used inside the emails
# themselves (forgot-password link, "View incident"/"View full dashboard" links).
FRONTEND_URL=https://YOUR-ADMIN.onrender.com
ADMIN_PORTAL_URL=https://YOUR-ADMIN.onrender.com

# Bind all internal service ports (Postgres/Redis/Eureka/MinIO/RabbitMQ/OSRM/gateway) to
# loopback only, so they're never reachable from the public internet — only Caddy's 80/443
# face the world. REQUIRED in production.
HOST_BIND=127.0.0.1
EOF
```
> After Part B you'll come back and set `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, and `ADMIN_PORTAL_URL` to the real Render URL, then re-run the `docker compose ... up -d` command.
>
> You only set `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` — the compose file automatically hands those same values to media-service as its MinIO access/secret key, so they can't drift out of sync.
>
> **Before moving on, replace `INITIAL_ADMIN_EMAIL` with your real email**, and note the generated `INITIAL_ADMIN_PASSWORD` — after `EOF` runs, retrieve it with `grep INITIAL_ADMIN_PASSWORD .env`. That's what you'll log into the admin portal with once the stack is up (A7).

### A6b. Build the OSRM routing data (REQUIRED — the map/route features depend on it)
The `osrm-data/` folder is gitignored (large binaries), so it's NOT in your clone. Without it
the `osrm` container crash-loops and all routing (driver navigation + the admin live route) is
dead — even though the rest of the stack comes up. Generate it once on the VM (Ghana extract,
MLD algorithm to match the compose command):
```bash
cd fleettrack/infrastructure_1
mkdir -p osrm-data && cd osrm-data
wget https://download.geofabrik.de/africa/ghana-latest.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-extract   -p /opt/car.lua /data/ghana-latest.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-partition  /data/ghana-latest.osrm
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-customize  /data/ghana-latest.osrm
cd ..
```
(One-time; takes a few minutes. If your fleet operates outside Ghana, use the matching Geofabrik extract.)

### A7. Launch
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
First build takes a while (it compiles 9 Java services). Then Caddy fetches HTTPS certs automatically (needs the DNS + ports 80/443 working). Confirm the osrm container isn't restarting: `docker compose ps osrm` should show "Up", not a restart loop.

### A8. Verify
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://fleettrack.duckdns.org/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"y"}'
# 400 = healthy (bad creds reached auth). 502/timeout = still starting or DNS/cert not ready yet.

curl -s -o /dev/null -w "%{http_code}\n" "https://fleettrack-routing.duckdns.org/route/v1/driving/-0.186964,5.603717;-0.196964,5.613717?overview=false"
# 200 = OSRM reachable and serving routes. 502/timeout = still starting, DNS/cert not ready, or
# osrm-data was never generated (A6b) — check `docker compose logs osrm` on the VM.
```

---

## Part B — Admin portal on Render

1. Render → **New → Static Site** → connect your GitHub repo.
2. **Root Directory:** `admin-portal_4`
3. **Build Command:** `npm ci && npm run build`
4. **Publish Directory:** `dist`
5. **Environment variable:** `VITE_API_BASE_URL = https://fleettrack.duckdns.org`
6. Add a **rewrite rule** (Render → Redirects/Rewrites): source `/*` → destination `/index.html` → **Rewrite** (so client-side routing works).
7. Deploy. Note the URL, e.g. `https://fleettrack-admin.onrender.com`.
8. **Go back to the VM `.env`**, set `CORS_ALLOWED_ORIGINS=https://fleettrack-admin.onrender.com`, and re-run the `docker compose ... up -d` command from A7.

---

## Part C — Mobile app (APK via Expo EAS)

**First, add a Google Maps Android API key** (REQUIRED — without it the driver map renders blank/gray on a release APK):
1. Google Cloud Console → create a project → enable **"Maps SDK for Android"**.
2. APIs & Services → Credentials → **Create API key**. Restrict it to Android apps with package `com.fleettrack.mobile` (and, once you've built once, the app's SHA-1).
3. In `mobile/app.json`, replace `REPLACE_WITH_GOOGLE_MAPS_ANDROID_API_KEY` with that key. (A Maps *Android* key is a client key restricted by package/signature — safe to ship in the app; it is NOT a server secret.)

Then build:
```bash
cd fleettrack-pro/mobile
# point the app at the public API + routing domains (HTTPS)
cat > .env <<EOF
EXPO_PUBLIC_API_URL=https://fleettrack.duckdns.org
EXPO_PUBLIC_OSRM_URL=https://fleettrack-routing.duckdns.org
EOF
npm i -g eas-cli
eas login          # free Expo account
eas build -p android --profile preview   # uses the "preview" profile in eas.json → installable APK
```
> **`EXPO_PUBLIC_OSRM_URL` is REQUIRED, not optional** — the driver app calls OSRM directly
> (turn-by-turn directions and rerouting when the driver goes off-route), bypassing the
> gateway entirely. If this is left unset, it silently falls back to OSRM's public demo
> server (`router.project-osrm.org`), which is rate-limited and not meant for real app
> traffic — routing/rerouting will work sometimes and then mysteriously stop with no error
> shown. Point it at your own `OSRM_DOMAIN` from Part A instead.

Download the APK from the link and share/install it. (iOS needs an Apple Developer account — Android APK is the free path.)
> Push notifications are disabled by default (no `google-services.json`) and the app runs fine without them — see Part D to enable later.

---

## Part D — Push notifications (optional)

Admin in‑app notifications already work (the bell polls incidents + trip events), and the driver app polls its alerts — **no push needed for those**. Real device push (FCM) is only needed for background notifications, and requires:
1. Firebase console → Project Settings → Service Accounts → **Generate new private key** (JSON).
2. Put it at `fleettrack/backend/notification-service_5/src/main/resources/firebase-service-account.json` **on the VM only** (it is gitignored — never commit it).
3. Rebuild + restart notification-service so it picks up the key: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build notification-service`. (notification-service already runs in the stack by default; without the JSON it just runs with push disabled — safe. For **mobile** push you also need the matching `google-services.json` in `mobile/` and its `app.json` reference restored, then a new EAS build.)

---

## Security checklist before going live
- [ ] `.env` created on the server with **freshly generated** secrets (never the dev defaults).
- [ ] Firewall opens **only** 22, 80, 443.
- [ ] `CORS_ALLOWED_ORIGINS` set to the exact Render admin URL.
- [ ] HTTPS working (Caddy got its certs) for all three domains, including `OSRM_DOMAIN`.
- [ ] `firebase-service-account.json` is **not** in git (`git status` shows it ignored).
- [ ] You've pushed the latest code (with all the security fixes) to GitHub.

## What's intentionally not deployed
- **analytics-service** — unimplemented stub; excluded.
- Real device **push** — optional; see Part D.
