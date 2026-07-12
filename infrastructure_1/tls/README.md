# TLS reverse proxy (nginx)

HTTPS terminates at an nginx reverse proxy that forwards to the API gateway over
the internal Docker network. In dev we use a **self-signed** certificate.

## One-time setup (dev)

```bash
cd infrastructure_1/tls
./generate-cert.sh          # writes certs/fleettrack.{crt,key}  (gitignored)
cd ..
docker compose up -d reverse-proxy
```

Then reach the stack over HTTPS at:

- Admin portal API / gateway: `https://localhost` (port 443)
- Plain `http://localhost` → 301 redirect to HTTPS

Browsers will warn about the self-signed cert — accept it for local testing, or
import `certs/fleettrack.crt` into your OS/browser trust store.

## Notes

- The proxy sets `X-Forwarded-For` / `X-Forwarded-Proto`, so the gateway's per-IP
  login throttle sees the real client IP.
- WebSocket (`/ws`) upgrades are proxied correctly.
- HSTS is emitted here (and by the gateway) — effective now that traffic is HTTPS.

## Production

1. Replace the self-signed cert with a real one:
   - **Let's Encrypt** (swap nginx for Caddy for auto-renew, or add certbot), or
   - a **corporate/CA-issued** cert, or
   - terminate TLS at a cloud load balancer and point it at the gateway.
2. Stop publishing the gateway's `8080` port to the host (route only via the proxy).
3. Point the mobile app and admin portal base URLs at `https://<your-domain>`.
