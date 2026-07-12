#!/usr/bin/env bash
# Generates a self-signed TLS certificate for local/dev HTTPS at the reverse proxy.
# The output (certs/) is gitignored — never commit private keys.
#
# Usage:  ./generate-cert.sh
# Then:   docker compose up -d reverse-proxy
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)/certs"
mkdir -p "$DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/fleettrack.key" \
  -out    "$DIR/fleettrack.crt" \
  -subj   "/C=GH/O=FleetTrack Pro/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$DIR/fleettrack.key"
echo "Self-signed certificate written to: $DIR"
echo "  - fleettrack.crt (public certificate)"
echo "  - fleettrack.key (private key — keep secret, never commit)"
