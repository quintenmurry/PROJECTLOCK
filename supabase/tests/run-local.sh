#!/usr/bin/env bash
# Runs the RLS/tenant-isolation tests against a throwaway local Postgres (no Supabase needed).
# Requires PostgreSQL 15+ client and server binaries on PATH (or set PGBIN).
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(dirname "$(command -v postgres || echo /usr/lib/postgresql/16/bin/postgres)")}"
TMP="$(mktemp -d)"; PORT="${PGPORT_TEST:-5499}"
trap '"$PGBIN/pg_ctl" -D "$TMP/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP" -l "$TMP/log" start >/dev/null
sleep 1
P="psql -h $TMP -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -d postgres"
$P -f tests/00_local_shim.sql
for f in migrations/*.sql; do $P -f "$f"; done
$P -f tests/01_tenant_isolation.sql | grep -E 'PASSED|FAIL'
