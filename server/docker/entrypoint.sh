#!/bin/sh
set -e

if [ -n "$POSTGRES_HOST" ]; then
  echo "[server] waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT:-5432}..."
  export PGPASSWORD="${POSTGRES_PASSWORD:-}"
  until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; do
    sleep 2
  done
fi

echo "[server] running migrations..."
npm run migration:run

echo "[server] starting api..."
exec node dist/main.js
