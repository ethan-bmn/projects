# Production deployment

The single `docker-compose.yaml` runs the Nuxt app, PostgreSQL 18,
ChartDB, and its SVG export worker for both development
and production. All services start without profiles. The default project name
remains `abby-projects`, preserving the existing local database volume.

The app image builds with Bun 1.3.14 and Node 24, then runs the compiled Nitro
server as a non-root user. Database credentials are URL-encoded by the container
entrypoint, so production does not need a manually constructed `DATABASE_URL`.
Owner credentials and the session secret are given to the app. The Abby key is
stored in PostgreSQL; these secrets
are never Docker build arguments.

## First deployment

Use a server with Docker Engine and Docker Compose. Your existing reverse
proxy or hosting platform provides domains, HTTPS certificates, and public
routing. Configure its routes as described below. PostgreSQL and the SVG
worker have no published host ports. App and ChartDB expose container ports
3000 and 80 to a container proxy without reserving host ports.

From the repository directory on the server:

```sh
cp .env.example .env.production
chmod 600 .env.production
```

Edit `.env.production` and set:

- `NUXT_PUBLIC_CHARTDB_URL` to the browser-facing HTTPS URL of your ChartDB route.
  `APP_PORT` and `CHARTDB_PORT` apply only with the optional host-port file below.
- `POSTGRES_PASSWORD` to a strong database password.
- `NUXT_OWNER_EMAIL` and either `NUXT_OWNER_PASSWORD_HASH` or `NUXT_OWNER_PASSWORD`.
  The plain password must be non-empty and at most 1024 characters. To generate a scrypt hash
  without installing Bun on the server, use the command below.
- `NUXT_SESSION_PASSWORD` to a random secret of at least 32 characters.

The 32-character requirement belongs to session encryption, not the owner's
login password. If logs show `Password string too short (min 32 characters
required)`, generate a new session secret with the command below, set it in
`.env.production`, and recreate the app container. Reseeding the owner alone
does not fix that error. The app entrypoint rejects a short session secret
before starting the server.

Quote hashes and passwords in single quotes in the environment file to
preserve `$` characters.

```sh
# These commands do not start the production services.
docker build --target database -t abby-projects-database .
docker run --rm -it --entrypoint node abby-projects-database scripts/hash-owner-password.mjs
docker run --rm node:24-bookworm-slim node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build --wait
docker compose --env-file .env.production ps --all
```

The database and diagram worker must become healthy before the app starts.
On every app container start, `docker/entrypoint.sh` runs the seed command,
which applies pending migrations and creates the owner if absent. Existing
account settings are preserved. Initialization must succeed before the HTTP
server starts; failures appear in the app logs. `/health` checks the app's
database connection. No host database access or manual migration command is needed.

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
docker compose --env-file .env.production logs --tail=100 app chartdb-export
```

## Updates and persistence

SMTP delivery and DocuSign are configured from the app's settings; see
[sending devis](quote-email.md). Their saved credentials are encrypted using
`NUXT_SESSION_PASSWORD`. Rotating that secret requires re-entering SMTP/DocuSign
credentials and reconnecting DocuSign, in addition to signing everyone out.

Back up PostgreSQL before updating. Pull your code changes and rerun the same
`up -d --build --wait --remove-orphans` command. Rebuilding includes new migrations
and seeder code in the app image; its entrypoint runs them before serving requests.
`--remove-orphans` removes the old `db-init` container when upgrading this setup.
Add a new SQL file in `database/migrations/` for each schema change. Applied
migrations are skipped and their checksums verified; editing an applied migration
stops startup. The owner seeder runs each time and preserves an existing account.
Keep `NUXT_SESSION_PASSWORD` stable to preserve sessions;
changing it signs everyone out. Edit account credentials in **Paramètres → Compte**;
the entrypoint preserves them during updates. For account recovery, set
the owner credentials in `.env.production` and run
`docker compose --env-file .env.production run --rm --no-deps app bun scripts/seed-owner.ts --update`
while PostgreSQL is running.
Set only one of `NUXT_OWNER_PASSWORD` and `NUXT_OWNER_PASSWORD_HASH` before
forcing the seed. The `run` command reads the updated environment file and
overwrites the existing owner's email/password; clients and projects are preserved.
Changing `POSTGRES_*` does
not change users/passwords in an existing PostgreSQL volume.

With the default project name, database data stays in the existing
`abby-projects_postgres_data` volume and survives container replacements and
ordinary `down`. A new host or a different project name creates a separate,
empty volume; restore a PostgreSQL backup there if you need existing data.
Avoid `down --volumes` unless you intend to delete those volumes.

For example, on a Linux server, create a database backup with the configured
database user and name (the examples use the template defaults):

```sh
docker compose --env-file .env.production exec -T postgres pg_dump -U abby_projects -d abby_projects -Fc > abby-projects.dump
```

Store backups outside the server and verify that they can be restored. ChartDB's
browser workspace uses browser storage; the saved project JSON lives in
PostgreSQL and is included in the database backup.

## Reverse proxy routing

For Coolify, use `docker-compose.yaml` alone, assign the app domain to container
port 3000 and the ChartDB domain to container port 80, and set
`NUXT_PUBLIC_CHARTDB_URL` to that ChartDB HTTPS URL. Remove any platform-configured
host port mappings for these services before redeploying. Fixed host ports can
conflict with other services or an earlier deployment still running.

For a proxy running on the server host, enable loopback host ports with:

```sh
docker compose -f docker-compose.yaml -f docker-compose.host.yaml --env-file .env.production up -d --build --wait
```

Include both files in subsequent Compose commands for this installation. Set
`APP_PORT` and `CHARTDB_PORT` if ports 3000 or 8080 are already occupied.
Route the app domain to
`http://127.0.0.1:3000` and the ChartDB domain to `http://127.0.0.1:8080` (or your
configured host ports). For a proxy running in Docker, attach it to the
`abby-projects_default` network and use `http://app:3000` and
`http://chartdb:80` as upstreams. Hosting platforms that attach services to their
own proxy network can route directly to those same container ports.

To attach the two browser-facing services to a pre-existing proxy network, add
the following network configuration to `docker-compose.yaml`, replacing
`your-proxy-network` with its actual name:

```yaml
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

Apply the network configuration with the same deployment command:

```sh
docker compose --env-file .env.production up -d --build --wait
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
For platform-specific domain and port settings, see
[Coolify Compose applications](https://coolify.io/docs/applications/builds/docker-compose).
