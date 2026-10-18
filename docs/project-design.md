# Clients and Project Specifications

## Purpose

Build a private workspace for one owner with exactly one login account. Import clients from the owner's Abby account and attach multiple projects to each client, each with its own specifications. Public registration, invitations, and additional accounts are outside the scope. Owner authentication, daily/manual Abby synchronization, client segmentation, and project creation/editing are implemented.

## Database Setup

`compose.yaml` provides PostgreSQL 18 for local development with a persistent named volume, a readiness health check, and a localhost-only port. `.env.example` documents connection and seed configuration. SQL migrations live in `database/migrations/`, with a checksum ledger in `schema_migrations`. `bun run db:migrate` applies pending migrations; `bun run db:seed` also applies them before creating or updating the owner. See the README for startup commands.

## Core Workflow

1. Sign in securely.
2. Import or refresh clients from Abby.
3. Select a client and view their projects.
4. Create a project and edit its specifications independently of other projects.
5. Refresh client information without overwriting project data.

## Data Model

The owner, client, synchronization, and project tables are implemented. A project's specification is stored as structured JSONB on its project row.

| Entity | Main fields | Relationships |
| --- | --- | --- |
| Owner account | Singleton `id = 1`, email, password hash, timestamps | The sole owner login |
| Abby sync state | Singleton `id`, last successful sync | Tracks the owner's Abby import |
| Client | UUID `id`, unique `(kind, abby_id)`, business/individual type, name, commercial name, emails, active flag and sync timestamps | Future projects reference the stable local ID |
| Project | UUID `id`, `client_id`, name, JSONB specification, timestamps | Belongs to exactly one client |

The specification contains multiline text for contexte métier, contexte technique, objectifs, enjeux, contraintes métiers, contraintes techniques, architecture logicielle, architecture DB, outils et frameworks, and planning. Contexte métier, contexte technique, contraintes techniques, architecture DB, and planning are optional (`null` when empty); the other sections are required. Names allow 200 characters and each section allows 20,000 characters. The API validates the shape and text values before writing.

Use local IDs for project relationships and a unique constraint on `clients(kind, abby_id)` so repeated imports update existing clients and IDs from different Abby entity types stay distinct. `projects.client_id` references `clients.id` with `ON DELETE RESTRICT`; the customer/project lookup is indexed. All clients and projects belong to the same private workspace; per-record account ownership fields are unnecessary. Archive clients rather than removing their projects during synchronization.

The `user` table's primary key is constrained to `1`, permitting at most one account. Use the quoted SQL identifier `"user"` in queries. Seed it from `NUXT_OWNER_EMAIL` and either `NUXT_OWNER_PASSWORD_HASH` or `NUXT_OWNER_PASSWORD` in `.env`. Plain passwords are hashed before storage. Login reads the database and does not fall back to environment credentials. Normal initialization preserves existing credentials; `bun run db:seed --update` explicitly resets them from the environment for recovery. The authenticated `/settings` page edits account credentials after verifying the current password and renews the active session. It also manages the Abby key and the shared contract provider profile. There is no account creation endpoint or default login credential.

## Authentication and Access

`/auth` provides the login form; successful login redirects to `/`. `app/middleware/auth.global.ts` refreshes the session before every navigation and redirects unauthenticated visitors to `/auth`. It also redirects signed-in visitors from `/auth` to `/`. The index is rendered on request rather than prerendered.

The server verifies the owner's password with scrypt and issues an encrypted, HttpOnly session cookie with an eight-hour lifetime. Server middleware protects application API routes and rejects cross-origin mutations. Login accepts JSON and is limited to ten attempts per minute per address on a single server instance. The login and session-management endpoints are the only API exceptions. Future endpoints must retain this protection.

Session validation checks the owner's identity and password hash version against PostgreSQL. Updating the database credentials invalidates old sessions on their next validation. Recovery means updating `.env` seed credentials and rerunning `bun run db:seed`. Changing `.env` without reseeding does not change the account. Logout clears the browser cookie; copied sealed cookies remain usable until expiry or credential rotation because there is no server-side session revocation store. Production requires HTTPS; a shared rate limiter is needed if deployed on multiple server instances.

## Abby Integration

Abby's [authentication documentation](https://docs.abby.fr/api/authentification) specifies HTTPS requests with a Bearer API key. Configure the owner's key as a server-side environment secret, outside public Nuxt configuration, browser responses, and logs. One Abby connection serves the whole workspace; per-user connection management is unnecessary.

The [clients documentation](https://docs.abby.fr/api/clients) provides paginated `/organizations` and `/contacts` endpoints. Each organization becomes a business client. A standalone contact becomes an individual client. Contacts linked to an organization are represented only by their organization, deduplicated by organization ID. Embedded active organizations missing from the organization list are represented using their ID/name, with other fields empty; contacts linked to archived organizations are excluded. Both sources must finish successfully before any client data changes. Keep project specifications local; client refreshes must never replace them.

The authentication guide and embedded API schema list different base URLs. The integration defaults to `https://api.app-abby.com`; `NUXT_ABBY_API_BASE_URL` also accepts `https://api.abby.fr`. The API key is stored in the singleton `abby_settings` row (`id = 1`, `api_key`) and read only by the server; browser responses expose only whether it is configured. Both sources use `archived=false`, a 20-second request timeout, and a shared five-minute import limit. Authentication failures, rate limits, invalid responses, and network errors produce safe French messages.

The server checks at startup and hourly, importing when the last success is at least 24 hours old, with a one-hour retry delay after failure. `POST /api/clients/sync` provides the same import manually behind owner authentication and origin checks. A PostgreSQL transaction lock prevents overlap; all client writes and success metadata commit atomically after every page has been retrieved. Missing clients are kept as inactive records. Failed fetches preserve client data and the last successful timestamp. `GET /api/clients` returns paginated active clients and safe sync metadata.

`GET /api/clients?kind=organization|individual|all` filters both rows and pagination totals. The French UI offers all clients, businesses, and individuals. Migration `005_client_segmentation.sql` retains existing business UUIDs and makes the expanded import due. Joining an organization makes an individual row inactive; leaving it reactivates the same individual UUID. Future project references remain attached to their original local client.

## Implementation and Verification

Customer pages at `/clients/:clientId` list projects and link to the creation form. `/clients/:clientId/projects/:projectId` displays the specification and supports editing. The editor warns before discarding unsaved changes. Protected APIs provide customer/project reads, project creation (`POST`), and full specification updates (`PUT`). Every project lookup/update is scoped by both local project and customer IDs; inactive customers retain project access.

The project page lazy-loads jsPDF for a browser-side **Exporter en PDF** action.
The export uses saved data, embeds locally bundled Public Sans regular/bold TTF
fonts, wraps text on A4 pages, keeps headings with their first content line, and
adds page numbers. Optional empty sections remain visible as unfilled. Fonts are
served from the app; no project data is uploaded to a PDF service. Font licensing
and the pinned source revision are recorded in `public/fonts/pdf/`.

`bun run test` runs Vitest unit, PostgreSQL integration, and authenticated HTTP tests using temporary databases and an isolated Nuxt server. Tests cover authentication, synchronization, segmentation, multiple projects per customer, optional DB architecture, required sections, foreign keys, scoped updates, and preservation through Abby refreshes. No tests call the real Abby API. Continue running `bun run lint`, `bun run typecheck`, and `bun run build`.
