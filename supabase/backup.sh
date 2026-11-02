#!/usr/bin/env bash
# Dumps the Supabase database (app data, sign-in accounts, file metadata) to backups/<date>.sql.gz.
# Runs pg_dump in Docker, so no local Postgres is needed. Usage: ./supabase/backup.sh
# Needs SUPABASE_DB_URL in .env: Supabase → Connect → "Session pooler" connection string, with your database password.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
: "${SUPABASE_DB_URL:?Add SUPABASE_DB_URL to .env (Supabase → Connect → Session pooler)}"

mkdir -p backups
out="backups/$(date +%Y-%m-%d_%H%M).sql.gz"
docker run --rm postgres:18-alpine pg_dump "$SUPABASE_DB_URL" \
  --schema=public --schema=auth --schema=storage --no-owner --no-privileges | gzip > "$out.tmp"
mv "$out.tmp" "$out" # only keep complete dumps
echo "Saved $out ($(du -h "$out" | cut -f1))"
