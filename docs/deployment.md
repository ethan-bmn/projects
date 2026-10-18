# Production deployment

`docker-compose.production.yaml` runs the Nuxt app, PostgreSQL 18, a one-shot
migration/owner seed job, ChartDB, and its SVG export worker. It is a
standalone production stack with its own database volume. The local
`docker-compose.yaml` remains available for development.

The app image builds with Bun 1.3.14 and Node 24, then runs the compiled Nitro
server as a non-root user. Database credentials are URL-encoded by the container
entrypoint, so production does not need a manually constructed `DATABASE_URL`.
Owner credentials are given only to the initialization job. The session secret
is given only to the app. The Abby key is stored in PostgreSQL; these secrets
are never Docker build arguments.

## First deployment

Use a server with Docker Engine and Docker Compose. Your existing reverse
proxy or hosting platform provides domains, HTTPS certificates, and public
routing. Configure its routes as described below. PostgreSQL and the SVG
worker have no published host ports. App and ChartDB ports bind only to
`127.0.0.1`, for access by a proxy running on the host.

From the repository directory on the server:

```sh
cp .env.production.example .env.production
chmod 600 .env.production
```

Edit `.env.production` and set:

- `NUXT_PUBLIC_CHARTDB_URL` to the browser-facing HTTPS URL of your ChartDB route.
  Adjust `APP_PORT` and `CHARTDB_PORT` if ports 3000 or 8080 are already occupied.
- `POSTGRES_PASSWORD` to a strong database password.
- `NUXT_OWNER_EMAIL` and either `NUXT_OWNER_PASSWORD_HASH` or `NUXT_OWNER_PASSWORD`.
  The plain password must contain 12–1024 characters. To generate a scrypt hash
  without installing Bun on the server, use the command below.
- `NUXT_SESSION_PASSWORD` to a random secret of at least 32 characters.

Quote hashes and passwords in single quotes in the environment file to
preserve `$` characters.

```sh
# These commands do not start the production services.
docker build --target database -t abby-projects-database .
docker run --rm -it --entrypoint node abby-projects-database scripts/hash-owner-password.mjs
docker run --rm node:24-bookworm-slim node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

docker compose --env-file .env.production -f docker-compose.production.yaml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yaml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yaml ps --all
```

The database must become healthy before `db-init` applies all migrations and
creates the owner if absent, preserving an existing account. The app starts only after that job exits
successfully and the diagram worker is healthy. `db-init` remaining in the
`Exited (0)` state is expected. `/health` checks the app's database connection.

For Abby synchronization, sign in and open **Paramètres → Connexion Abby** after
initialization; see [the synchronization setup](../README.md#abby-client-synchronization). When
upgrading, transfer your previous `NUXT_ABBY_API_KEY` value to this row and remove
it from `.env.production`. Key changes take effect on the next sync without a restart.

Visit your app domain at `/auth` and sign in. Open the public ChartDB URL in a
new tab and complete any authentication configured by your proxy before using
the embedded editor. The SVG worker accesses ChartDB privately and does not
use the proxy login.
Import and save a ChartDB JSON file, then verify SVG and PDF exports.

If startup fails, inspect the relevant logs:

```sh
docker compose --env-file .env.production -f docker-compose.production.yaml logs --tail=100 db-init app chartdb-export
```

## Updates and persistence

Back up PostgreSQL before updating. Pull your code changes and rerun the same
`up -d --build` command. The initialization job applies new migrations before
the new app starts. Keep `NUXT_SESSION_PASSWORD` stable to preserve sessions;
changing it signs everyone out. Edit account credentials in **Paramètres → Compte**;
the initialization job preserves them during updates. For account recovery, set
the owner credentials in `.env.production` and run
`docker compose --env-file .env.production -f docker-compose.production.yaml run --rm db-init bun scripts/seed-owner.ts --update`.
Changing `POSTGRES_*` does
not change users/passwords in an existing PostgreSQL volume.

The production volume starts empty; it does not import your development data.
If you need existing clients and projects, transfer a PostgreSQL backup before
using the production app. Database data lives in a named volume and survives
container replacements and ordinary `down`.
Avoid `down --volumes` unless you intend to delete those volumes.

For example, on a Linux server, create a database backup with the configured
database user and name (the examples use the template defaults):

```sh
docker compose --env-file .env.production -f docker-compose.production.yaml exec -T postgres pg_dump -U abby_projects -d abby_projects -Fc > abby-projects.dump
```

Store backups outside the server and verify that they can be restored. ChartDB's
browser workspace uses browser storage; the saved project JSON lives in
PostgreSQL and is included in the database backup.

## Reverse proxy routing

For a proxy running on the server host, route the app domain to
`http://127.0.0.1:3000` and the ChartDB domain to `http://127.0.0.1:8080` (or your
configured host ports). For a proxy running in Docker, attach it to the
`abby-projects-production_default` network and use `http://app:3000` and
`http://chartdb:80` as upstreams. Hosting platforms that attach services to their
own proxy network can route directly to those same container ports.

To attach the two browser-facing services to a pre-existing proxy network, use
an additional Compose file, replacing `your-proxy-network` with its actual name:

```yaml
# docker-compose.proxy.yaml
services:
  app:
    networks: [default, proxy]
  chartdb:
    networks: [default, proxy]

networks:
  proxy:
    external: true
    name: your-proxy-network
```

Include it after the production file on deployment commands:

```sh
docker compose --env-file .env.production -f docker-compose.production.yaml -f docker-compose.proxy.yaml up -d --build
```

Pass the original `Host` and `X-Forwarded-Proto: https` headers to Nuxt. Configure
authentication for the ChartDB domain in your proxy, and keep the database and
export worker private. Use HTTPS for both domains because the app's production
session cookies are secure and its ChartDB iframe cannot load an HTTP editor
from an HTTPS page. Give SVG/PDF export requests an upstream timeout of at least
90 seconds because the ChartDB worker may take up to 80 seconds to export.

References: [Compose startup dependencies](https://docs.docker.com/compose/how-tos/startup-order),
[Nuxt deployment](https://nuxt.com/docs/getting-started/deployment), and
[Compose networks](https://docs.docker.com/reference/compose-file/networks/).
