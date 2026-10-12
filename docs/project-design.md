# Clients and Project Specifications

## Purpose

Build a private workspace for one owner with exactly one login account. Import clients from the owner's Abby account and attach multiple projects to each client, each with its own specifications. Public registration, invitations, and additional accounts are outside the scope. PostgreSQL-backed owner login, global route protection, and daily/manual Abby client synchronization are implemented. Project and specification management remain planned.

## Database Setup

`compose.yaml` provides PostgreSQL 18 for local development with a persistent named volume, a readiness health check, and a localhost-only port. `.env.example` documents connection and seed configuration. SQL migrations live in `database/migrations/`, with a checksum ledger in `schema_migrations`. `bun run db:migrate` applies pending migrations; `bun run db:seed` also applies them before creating or updating the owner. See the README for startup commands.

## Core Workflow

1. Sign in securely.
2. Import or refresh clients from Abby.
3. Select a client and view their projects.
4. Create a project and edit its specifications independently of other projects.
5. Refresh client information without overwriting project data.

## Proposed Data Model

The owner, client, and sync tables are implemented. Projects and specifications below remain a proposed design.

| Entity | Main fields | Relationships |
| --- | --- | --- |
| Owner account | Singleton `id = 1`, email, password hash, timestamps | The sole owner login |
| Abby sync state | Singleton `id`, last successful sync | Tracks the owner's Abby import |
| Client | UUID `id`, unique `(kind, abby_id)`, business/individual type, name, commercial name, emails, active flag and sync timestamps | Future projects reference the stable local ID |
| Project | `id`, `client_id`, title, status, timestamps | Belongs to exactly one client |
| Specification | `id`, `project_id`, title, body, timestamps | Belongs to exactly one project |

Specification fields are a proposed starting point. Confirm whether specifications should be free text, structured requirements, or a mix before building the editor.

Use local IDs for project relationships and a unique constraint on `clients(kind, abby_id)` so repeated imports update existing clients and IDs from different Abby entity types stay distinct. Enforce foreign keys from projects to clients and specifications to projects, and index these references. All clients and projects belong to the same private workspace; per-record account ownership fields are unnecessary. Archive clients rather than removing their projects during synchronization.

The `user` table's primary key is constrained to `1`, permitting at most one account. Use the quoted SQL identifier `"user"` in queries. Seed it from `NUXT_OWNER_EMAIL` and either `NUXT_OWNER_PASSWORD_HASH` or `NUXT_OWNER_PASSWORD` in `.env`. Plain passwords are hashed before storage. Login reads the database and does not fall back to environment credentials. Reseeding updates the same account and preserves unchanged hashes. There is no account creation endpoint or default login credential.

## Authentication and Access

`/auth` provides the login form; successful login redirects to `/`. `app/middleware/auth.global.ts` refreshes the session before every navigation and redirects unauthenticated visitors to `/auth`. It also redirects signed-in visitors from `/auth` to `/`. The index is rendered on request rather than prerendered.

The server verifies the owner's password with scrypt and issues an encrypted, HttpOnly session cookie with an eight-hour lifetime. Server middleware protects application API routes and rejects cross-origin mutations. Login accepts JSON and is limited to ten attempts per minute per address on a single server instance. The login and session-management endpoints are the only API exceptions. Future endpoints must retain this protection.

Session validation checks the owner's identity and password hash version against PostgreSQL. Updating the database credentials invalidates old sessions on their next validation. Recovery means updating `.env` seed credentials and rerunning `bun run db:seed`. Changing `.env` without reseeding does not change the account. Logout clears the browser cookie; copied sealed cookies remain usable until expiry or credential rotation because there is no server-side session revocation store. Production requires HTTPS; a shared rate limiter is needed if deployed on multiple server instances.

## Abby Integration

Abby's [authentication documentation](https://docs.abby.fr/api/authentification) specifies HTTPS requests with a Bearer API key. Configure the owner's key as a server-side environment secret, outside public Nuxt configuration, browser responses, and logs. One Abby connection serves the whole workspace; per-user connection management is unnecessary.

The [clients documentation](https://docs.abby.fr/api/clients) provides paginated `/organizations` and `/contacts` endpoints. Each organization becomes a business client. A standalone contact becomes an individual client. Contacts linked to an organization are represented only by their organization, deduplicated by organization ID. Embedded active organizations missing from the organization list are represented using their ID/name, with other fields empty; contacts linked to archived organizations are excluded. Both sources must finish successfully before any client data changes. Keep project specifications local; client refreshes must never replace them.

The authentication guide and embedded API schema list different base URLs. The integration defaults to `https://api.app-abby.com`; `NUXT_ABBY_API_BASE_URL` also accepts `https://api.abby.fr`. `NUXT_ABBY_API_KEY` remains server-only. Both sources use `archived=false`, a 20-second request timeout, and a shared five-minute import limit. Authentication failures, rate limits, invalid responses, and network errors produce safe French messages.

The server checks at startup and hourly, importing when the last success is at least 24 hours old, with a one-hour retry delay after failure. `POST /api/clients/sync` provides the same import manually behind owner authentication and origin checks. A PostgreSQL transaction lock prevents overlap; all client writes and success metadata commit atomically after every page has been retrieved. Missing clients are kept as inactive records. Failed fetches preserve client data and the last successful timestamp. `GET /api/clients` returns paginated active clients and safe sync metadata.

`GET /api/clients?kind=organization|individual|all` filters both rows and pagination totals. The French UI offers all clients, businesses, and individuals. Migration `005_client_segmentation.sql` retains existing business UUIDs and makes the expanded import due. Joining an organization makes an individual row inactive; leaving it reactivates the same individual UUID. Future project references remain attached to their original local client.

## Implementation and Verification

Next implement projects and specification CRUD. `bun run test` runs Vitest unit, PostgreSQL integration, and authenticated HTTP tests using temporary databases and an isolated Nuxt server. Tests cover authentication, pagination, safe Abby errors, repeated imports, inactive clients, partial fetch/write failures, the daily schedule, and concurrent imports. No tests call the real Abby API. Continue running `bun run lint`, `bun run typecheck`, and `bun run build`.
