# Abby Projects

This project provides a private workspace with one secure account for its owner, importing clients from Abby and managing multiple projects per client, with specifications stored for each project. Public registration and additional accounts are outside the scope.

See [the project design](docs/project-design.md) for the data model, access controls, and synchronization behavior. PostgreSQL runs locally through Docker Compose. Owner login uses a database account seeded from `.env`. Abby clients are synchronized daily; their projects and specifications remain local.

Each project can store one contract. Apply migration `008_project_contract.sql` with `bun run db:migrate`, then open a project and choose **Créer le contrat**. The editor follows the Markdown templates in [`templates/`](templates/), prefills available client data, and shows the variables for the selected services alongside a clause preview. The main contract is [`templates/contract_template.md`](templates/contract_template.md); the GDPR agreement and hosting appendix are maintained there as [`templates/gdpr_subcontracting_agreement_template.md`](templates/gdpr_subcontracting_agreement_template.md) and [`templates/hosting_appendix_template.md`](templates/hosting_appendix_template.md). Drafts can be saved before all fields are complete. Upload the accepted quote as a PDF (maximum 5 MiB); the data-processing annex becomes mandatory when processing on the client's behalf is selected. Once the active variables, options, and checks are complete, export the contract: jsPDF renders it using the specification PDF's Public Sans fonts and purple page styling; pdf-lib appends every original quote page, preserving its dimensions. Password-protected or unreadable quote PDFs must be exported as readable PDFs before upload. Contracts and quote attachments are stored locally with the project and are preserved when specifications or Abby client details change.

Contract creation and editing open a dedicated page at `/clients/:clientId/projects/:projectId/contract`. Saving or cancelling returns to the project, where the contract status and PDF export remain available. Leaving the editor with unsaved changes prompts for confirmation.

The updated template's G0–G8 setup sheet drives the editor's service choices and conditional fields. Export includes only the retained clauses and annexes, with recalculated numbering, and requires the applicable checks. Older drafts preserve their values and quote but must be reviewed under the new choices before export. See [the contract generator](docs/contract-generator.md) for configuration and upgrade behavior.

Migration `009_client_billing_address.sql` adds a structured `billing_address` column to `clients`. Synchronization imports Abby's billing address for both organizations and individual contacts, including the street, complement, postal code, city, state, and country. New contracts prefill the address from this local record; saved contracts keep their original values when a client moves. The migration makes the next automatic import due so existing clients receive their addresses.

Uploading a quote also reads all its pages locally with PDF.js and prefills the detected quote reference and issue date in the identity section. Both remain editable. Dates are normalized to `DD/MM/YYYY`; validity and expiry dates are excluded. Use **Lire la référence et la date du PDF** to extract the values again from an already attached quote. Scanned PDFs without a text layer or unrecognized formats require manual entry; the attachment is still retained.

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
2. Run `bun run db:migrate` to create the singleton `abby_settings` row (migration `011_abby_settings.sql`).
3. Set `abby_settings.api_key` for `id = 1` using your private database connection, then start `bun run dev`.
4. Sign in and click **Synchroniser les clients** to import immediately.

For example, run this SQL through your database administration tool, replacing the placeholder with your key:

```sql
UPDATE abby_settings
SET api_key = 'your-abby-api-key', updated_at = now()
WHERE id = 1;
```

The key is stored only in PostgreSQL and read by the server for each synchronization.
Changes take effect on the next manual or scheduled sync without restarting the app.
Set `api_key` to an empty string to disable automatic synchronization. The client list
receives only a configured flag, never the key. Protect database access and backups
because they contain this credential. When upgrading, copy your existing
`NUXT_ABBY_API_KEY` into this row before removing it from your environment; that
environment variable is no longer used.

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
The `#6867f6` header displays the white document title and Ethan BAUMANN EI's business
details at the top-right. Section bands and compact continuation headers aid reading.
Long text wraps and continues across pages; empty sections are omitted and the
remaining sections are numbered consecutively. The bundled Public Sans fonts
preserve French accents and ligatures
(see `public/fonts/pdf/OFL.txt`). PDF generation does not upload project text to
an external service and exports the saved specification.

### Database diagrams and WBS planning

Run `bun run db:migrate` to add diagram storage to existing projects. Start the
local ChartDB editor and SVG renderer with
`docker compose --profile diagrams up -d --build --wait chartdb chartdb-export`.
With Docker in WSL, run:

```powershell
wsl --exec sh -lc 'cd /mnt/c/Users/Ethan/Desktop/Dev/projects && docker compose --profile diagrams up -d --build --wait chartdb chartdb-export'
```

ChartDB is available at `http://localhost:8080`, bound to the local machine with
analytics disabled. Set `CHARTDB_PORT` and `NUXT_PUBLIC_CHARTDB_URL` together to
change its address. In **Architecture DB**, open ChartDB in a new tab or show its
embedded editor. Export the diagram as JSON from ChartDB and import that file
into the project, then save. The app previews the tables and relationships and
keeps the original JSON; download it to reopen or modify it in ChartDB. ChartDB's
browser workspace and project storage are separate: changes reach the project
when you import and save the JSON. Imports support up to 50 tables, 60 fields per
table, 200 relationships, and 500 Ko per file.

On a saved project, choose **Exporter le SVG avec ChartDB** under **Architecture DB**
to download the database diagram as an SVG image. The local `chartdb-export` service
opens the saved JSON in an isolated browser and uses ChartDB's native SVG export,
including its field and relationship styling. It closes the browser workspace
after each export and only permits requests to the local ChartDB instance. The
app endpoint requires the owner's session and checks that the project belongs
to the customer. Empty architectures cannot be exported. Concurrent exports
return a retry message. Set `CHARTDB_EXPORT_PORT` and `NUXT_CHARTDB_EXPORT_URL`
together if port 8081 is unavailable. The worker's dependency and lockfile live
in `tools/chartdb-export/`; its Playwright version must match its Docker image.

In **Planning**, select **Ajouter une phase**, then add named tasks and subtasks.
Use the arrow controls to reorder siblings; removing a task also removes its
descendants after confirmation. The WBS supports 100 tasks and six levels.
Both diagrams are optional, coexist with existing text, and appear in the saved
project and PDF even without text. PDF export includes ChartDB's native database
SVG, rendered as a high-resolution image to preserve its embedded HTML labels;
the local ChartDB services must be running for projects with a database diagram.
Large database schemas also include readable table details. The PDF draws WBS
tasks as vectors, keeps task groups together when they fit on a page, and repeats
parent tasks with a “suite” label when a group continues on the next page so
subtasks remain connected.

## Production

The complete production stack is defined in
[`docker-compose.production.yaml`](docker-compose.production.yaml): Nuxt,
PostgreSQL, automatic migrations and owner setup, ChartDB, and its SVG export
worker. Your existing proxy or hosting platform handles HTTPS. Copy
`.env.production.example` to `.env.production`, set the public ChartDB URL and
credentials, then run:

```bash
docker compose --env-file .env.production -f docker-compose.production.yaml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yaml up -d --build
```

See [the deployment guide](docs/deployment.md) for proxy routing, password
generation, first startup, backups, and updates.
The local development stack uses `docker-compose.yaml`.

To build and preview without Docker:

```bash
bun run build
bun run preview
```

## Renovate integration

Install [Renovate GitHub app](https://github.com/apps/renovate/installations/select_target) on your repository and you are good to go.
