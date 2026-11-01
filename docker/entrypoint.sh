#!/bin/sh
set -eu

session_password=${NUXT_SESSION_PASSWORD:-}
if [ "${#session_password}" -lt 32 ]; then
  echo 'NUXT_SESSION_PASSWORD must contain at least 32 characters for session encryption. This is separate from NUXT_OWNER_PASSWORD.' >&2
  exit 1
fi
unset session_password

echo 'Applying database migrations and seeders...'
# The seed command applies pending migrations before checking the owner account.
# Any failure stops startup; existing owner credentials are preserved.
bun scripts/seed-owner.ts

echo 'Database initialization complete. Starting application...'
exec "$@"
