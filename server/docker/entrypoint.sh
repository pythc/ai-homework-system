#!/bin/sh
set -e

if [ -n "$POSTGRES_HOST" ]; then
  echo "[server] waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT:-5432}..."
  export PGPASSWORD="${POSTGRES_PASSWORD:-}"
  until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; do
    sleep 2
  done
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[server] running migrations..."
  npm run migration:run
fi

MODE="${SERVER_APP_PROFILE:-api}"
if [ "$MODE" = "worker" ]; then
  echo "[server] starting worker..."
  exec node dist/worker.js
fi

echo "[server] starting http profile: ${MODE} ..."
exec node dist/main.js
