# Abby Projects

This project provides a private workspace with one secure account for its owner, importing clients from Abby and managing multiple projects per client, with specifications stored for each project. Public registration and additional accounts are outside the scope.

See [the project design](docs/project-design.md) for the data model, access controls, and synchronization behavior. PostgreSQL runs locally through Docker Compose. Owner login uses a database account seeded from `.env`. Abby clients are synchronized daily; their projects and specifications remain local.

## Starter Template

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)

Use this template to get started with [Nuxt UI](https://ui.nuxt.com) quickly.

- [Live demo](https://starter-template.nuxt.dev/)
- [Documentation](https://ui.nuxt.com/docs/getting-started/installation/nuxt)

<a href="https://starter-template.nuxt.dev/" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png">
    <img alt="Nuxt Starter Template" src="https://ui.nuxt.com/assets/templates/nuxt/starter-light.png" width="830" height="466">
  </picture>
</a>

> The starter template for Vue is on https://github.com/nuxt-ui-templates/starter-vue.

## Quick Start

```bash [Terminal]
bun create nuxt@latest -- -t ui
```

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-name=starter&repository-url=https%3A%2F%2Fgithub.com%2Fnuxt-ui-templates%2Fstarter&demo-image=https%3A%2F%2Fui.nuxt.com%2Fassets%2Ftemplates%2Fnuxt%2Fstarter-dark.png&demo-url=https%3A%2F%2Fstarter-template.nuxt.dev%2F&demo-title=Nuxt%20Starter%20Template&demo-description=A%20minimal%20template%20to%20get%20started%20with%20Nuxt%20UI.)

## Setup

Use Bun 1.3.14 (as pinned in `package.json`) and Node.js 24.11.0 or newer in the 24.x series. Install the dependencies:

```bash
bun install
```

Commit `bun.lock` when dependencies change. CI installs with `bun install --frozen-lockfile`.

Run the code checks:

```bash
bun run lint
bun run typecheck
```

### Owner Login

Login reads the single owner account from PostgreSQL. Environment credentials are used only by the seed command. If `.env` already exists, add the authentication entries from `.env.example` without replacing your database settings.

1. Set `NUXT_OWNER_EMAIL` to your email.
2. Set `NUXT_OWNER_PASSWORD` to a password of at least 12 characters, or run `bun run auth:hash` and copy its output into `NUXT_OWNER_PASSWORD_HASH`. Set only one password option. Enclose the value in single quotes to preserve `$` characters. The seed stores a scrypt hash, never a plain password.
3. Set `NUXT_SESSION_PASSWORD` to a random secret of at least 32 characters. For example, generate one with `bun -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Start PostgreSQL, then run `bun run db:seed`. This applies migrations and creates or updates the owner from `.env`.
5. Restart Nuxt and visit `/auth`. Signing in redirects to `/`.

The database enforces at most one owner account and there is no registration endpoint. All other pages use global authentication middleware, and application API routes require an owner session. The server checks the database password hash and stores the session in an encrypted, HttpOnly cookie with an eight-hour lifetime. Production requires HTTPS for secure cookies. Changing `.env` credentials alone does not change login: rerun `bun run db:seed`. Updating the database credentials invalidates old sessions on their next validation. Sign out clears the browser cookie; sealed sessions do not provide server-side revocation of copied cookies.

To apply future schema migrations without changing credentials, run `bun run db:migrate`. Applied migrations are tracked with checksums; add a new SQL file rather than editing an applied migration. Reseeding does not delete clients or projects. Repeating the seed with unchanged credentials preserves the owner row and password hash. PostgreSQL database-user credentials (`POSTGRES_*`) remain separate from your application login.

### Authentication Tests

```bash
bun run test
```

Vitest tests global route middleware and starts an isolated Nuxt production server for HTTP integration tests. Start PostgreSQL before running the suite. Tests read `TEST_DATABASE_URL` (or `DATABASE_URL` from `.env`), create a randomly named temporary database, and remove only that database afterward. The connection needs permission to create databases. Your application owner row is untouched. CI provides a PostgreSQL service.

Coverage includes guest redirects, signed-in navigation, expired sessions, rejected credentials, cookie tampering, API protection, logout, login request limits, idempotent migration/seeding, the single-account constraint, and database credential updates without restarting Nuxt.

## Development Server

### Local PostgreSQL

Use Docker with a Compose version supporting `up --wait`, and start the Docker engine. Docker installed inside WSL also works. Copy the environment template once if `.env` does not already exist:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env`. Set your own `POSTGRES_PASSWORD` in `.env` and update `DATABASE_URL` to match. URL-encode special characters in the URL's credentials. If port 5432 is occupied, change `POSTGRES_PORT` and the URL's port together.

```bash
docker compose config --quiet
docker compose up -d --wait postgres
docker compose ps
```

When using Docker inside WSL, run these commands from the repository directory in WSL:

```bash
cd /mnt/c/Users/Ethan/Desktop/Dev/projects
docker compose up -d --wait postgres
docker compose ps
```

Or invoke Docker from PowerShell through WSL:

```powershell
wsl --exec sh -lc 'cd /mnt/c/Users/Ethan/Desktop/Dev/projects && docker compose up -d --wait postgres'
```

The service uses PostgreSQL 18, binds to `127.0.0.1`, and stores data in a named volume mounted at `/var/lib/postgresql`, following the [official image's PostgreSQL 18 layout](https://hub.docker.com/_/postgres). `DATABASE_URL` connects the Nuxt server and database commands to PostgreSQL. `NUXT_DATABASE_URL` may override it for a deployed Nuxt server. Starting the container alone does not create the owner account; run `bun run db:seed` once your owner credentials are set.

Useful database commands:

```bash
docker compose logs -f postgres
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose down
```

`docker compose down` preserves database data. `docker compose down --volumes` deletes the local database permanently. Initialization variables only apply to an empty volume; changing `.env` does not update existing database users or passwords. These credentials are for local development, not production.

### Nuxt

Start the development server on `http://localhost:3000`:

```bash
bun run dev
```

## Abby client synchronization

1. Create an API key in [Abby integrations](https://my.app-abby.com/settings/integrations).
2. Set `NUXT_ABBY_API_KEY` in your ignored `.env` file. Keep it on the server.
3. Run `bun run db:migrate`, then restart `bun run dev`.
4. Sign in and click **Synchroniser les clients** to import immediately.

`NUXT_ABBY_API_BASE_URL` defaults to `https://api.app-abby.com`, as documented in
[Abby authentication](https://docs.abby.fr/api/authentification). The
[clients API schema](https://docs.abby.fr/api/clients) also lists `https://api.abby.fr`;
if needed, set that alternate host explicitly. HTTPS and these two hosts are enforced.
The integration fetches every page of `GET /organizations` and `GET /contacts`,
using page/limit parameters and a Bearer key. Organizations become business clients
with their legal name, commercial name, and emails. Contacts without an organization
become individual clients with their full name and emails. A contact associated with
an organization is represented by that organization, so multiple people at the same
company produce one business client. An active organization embedded in a contact
is included even if absent from the organization list; its unavailable fields stay empty.
People associated with archived organizations are not imported as individuals.

The server checks for a due import five seconds after startup and every hour thereafter.
Successful imports are at least 24 hours apart; failed automatic imports wait at least
one hour before retrying. Manual imports can run at any time. The server must remain
running for automatic updates; after downtime it catches up at startup.

Clients are upserted by `(kind, abby_id)` while preserving local UUIDs. Business and
individual Abby IDs cannot collide. Only active clients
are fetched; missing/archived clients become inactive locally rather than being deleted.
No client data changes until every page has been fetched and validated. A failed DB
write rolls back the import. PostgreSQL locks prevent simultaneous automatic/manual
imports, including across server instances. The page displays the last successful
sync, failures, and stored clients with pagination and filters for **Tous les clients**,
**Entreprises**, and **Particuliers**. Keys and upstream error bodies
are excluded from browser responses and sync logs.

Migration `004_abby_clients.sql` replaces the previous import table and resets sync
timestamps. Applied SQL migrations remain immutable for checksum verification.
Migration `005_client_segmentation.sql` preserves existing organization UUIDs, adds
the client type and compound identity, and makes the expanded import due. When an
individual joins an organization, their old individual row becomes inactive; it is
reactivated with the same local ID if they become standalone again. Local project
relations are preserved rather than reassigned automatically.

## Projects and specifications

Run `bun run db:migrate` after updating the repository. Select a customer's name
in the client list, then choose **Nouveau projet**. Each customer can have multiple
projects; select a project to read its specification or click **Modifier** to edit it.

Every project has a name (maximum 200 characters) and these multiline sections:
contexte métier, contexte technique, objectifs, enjeux, contraintes métiers,
contraintes techniques, architecture logicielle, architecture DB, outils et frameworks,
planning, périmètre du projet, parties prenantes, besoins fonctionnels, besoins non
fonctionnels, gestion des données, nom de domaine(s) ciblé(s), livrables attendus,
critères de recette, and exploitation et maintenance. Objectives, stakes, business
constraints, software architecture, and tools/frameworks are required; all other
sections are optional. Each allows up to 20,000 characters. Planning is free text
for stages, deliverables, and dates. Optional sections are stored as `null` when
empty; existing projects can be edited to fill the new sections without a migration.

Projects use a foreign key to the customer's stable local UUID. Abby refreshes never
overwrite their names or specifications. Inactive customers' projects remain accessible
at their existing URLs. Customers with projects cannot be deleted from the database.
The editor warns before discarding unsaved changes. Project API routes require the
owner's session, reject cross-origin writes, and scope reads/updates to the customer.

On a saved project's page, choose **Exporter en PDF** to download its cahier des
charges. jsPDF loads on demand and creates an A4 document in the browser with the
customer, project name, update date, all specification sections, and page numbers.
The blue header displays the white document title and Ethan BAUMANN EI's business
details at the top-right. Section bands and compact continuation headers aid reading.
Long text wraps and continues across pages; empty optional sections are marked
as unfilled. The bundled Public Sans fonts preserve French accents and ligatures
(see `public/fonts/pdf/OFL.txt`). PDF generation does not upload project text to
an external service and exports the saved specification.

## Production

Build the application for production:

```bash
bun run build
```

Locally preview production build:

```bash
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Renovate integration

Install [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) on your repository and you are good to go.
