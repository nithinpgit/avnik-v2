#!/bin/sh
set -e
cd /app
STAMP=node_modules/.docker-deps-ready
if [ ! -f "$STAMP" ] || [ ! -f package-lock.json ] || [ package-lock.json -nt "$STAMP" ]; then
  echo "[meet-mediaserver] npm ci (fresh or package-lock.json updated)..."
  npm ci
  touch "$STAMP"
fi
exec "$@"
