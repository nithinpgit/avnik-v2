#!/bin/sh
set -e
cd /app
STAMP=node_modules/.docker-deps-ready
# Re-install when lockfile changes (e.g. new deps like ioredis) — stale named volumes skip npm ci otherwise.
if [ ! -f "$STAMP" ] || [ ! -f package-lock.json ] || [ package-lock.json -nt "$STAMP" ]; then
  echo "[meet-backend] npm ci (fresh or package-lock.json updated)..."
  npm ci
  touch "$STAMP"
fi
exec "$@"
