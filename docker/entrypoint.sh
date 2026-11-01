#!/bin/sh
set -eu

echo 'Applying database migrations and seeders...'
# The seed command applies pending migrations before checking the owner account.
# Any failure stops startup; existing owner credentials are preserved.
bun scripts/seed-owner.ts

echo 'Database initialization complete. Starting application...'
exec "$@"
