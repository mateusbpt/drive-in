#!/usr/bin/env bash
# Quick environment check before bringing anything up.
set -euo pipefail

echo "== Drive-In & Popcorn — environment check =="

command -v docker >/dev/null || { echo "MISSING: docker"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "MISSING: docker compose v2"; exit 1; }
echo "OK: docker"

[ -f .env ] || { echo "MISSING: .env (copy it from .env.example)"; exit 1; }
echo "OK: .env exists"

# The `tr` is not decoration: an .env saved on Windows carries CRLF, and sourcing
# it as-is leaves a carriage return glued to every value. A token with a trailing
# \r is rejected by whatever receives it, and the error never mentions the .env.
# shellcheck disable=SC1091
set -a; . <(tr -d '\r' < ./.env); set +a

for var in LIVEKIT_API_KEY LIVEKIT_API_SECRET SESSION_SECRET; do
  [ -n "${!var:-}" ] || { echo "MISSING: $var is empty in .env"; exit 1; }
done
echo "OK: required variables filled in"

# Domains only exist in production. Locally there is nothing to resolve.
if [ -n "${DOMAIN_APP:-}" ] || [ -n "${DOMAIN_LIVEKIT:-}" ]; then
  IP=$(curl -s --max-time 5 ifconfig.me || echo "")
  echo "public IP of this machine: ${IP:-not detected}"
  for d in "${DOMAIN_LIVEKIT:-}" "${DOMAIN_APP:-}"; do
    [ -n "$d" ] || continue
    R=$(getent hosts "$d" | awk '{print $1}' | head -1 || echo "")
    if [ "$R" = "$IP" ]; then
      echo "OK: $d -> $R"
    else
      echo "WARNING: $d -> ${R:-no record} (expected $IP)"
    fi
  done
fi

echo "== Done. If everything is OK: pnpm infra:up =="
